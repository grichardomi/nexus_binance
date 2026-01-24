import OpenAI from 'openai';
import { logger } from './utils/logger';
import { AIDecision, Indicators, CacheEntry, Config, CostAnalysis, PyramidDecision } from './utils/types';

/**
 * OpenAI Decision Maker
 * Handles AI prompts, response parsing, caching, and cost tracking
 * Based on NexusMeme's LLMStrategyEnhancer patterns
 */
export class OpenAIDecisionMaker {
  private client: OpenAI;
  private config: Config;
  private responseCache: Map<string, CacheEntry<AIDecision>> = new Map();
  private totalCallsToday: number = 0;
  private estimatedCostUSD: number = 0;
  private lastDayReset: number = Date.now();

  // Cache TTL (default 15 minutes)
  private readonly CACHE_TTL_MS: number;

  // Cost per 1M tokens (gpt-4o-mini pricing)
  private readonly COST_PER_1M_INPUT = 0.15;
  private readonly COST_PER_1M_OUTPUT = 0.60;

  constructor(config: Config) {
    this.config = config;
    this.CACHE_TTL_MS = config.aiCacheMinutes * 60 * 1000;

    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  /**
   * Build entry decision prompt
   * ~700 tokens per prompt
   */
  private buildEntryPrompt(
    pair: string,
    price: number,
    indicators: Indicators,
    costs: CostAnalysis
  ): string {
    const regime = this.getRegimeFromADX(indicators.adx);
    const volumeTrend = indicators.volumeRatio > 1.0 ? 'increasing' : 'decreasing';

    return `You are an expert cryptocurrency trader analyzing BTC/USD intraday trading opportunities.

Your task: Determine if we should BUY or HOLD on the next candle.

CURRENT MARKET (15min timeframe):
- Pair: ${pair}
- Current Price: $${price.toFixed(2)}
- Market Regime: ${regime} (ADX: ${indicators.adx.toFixed(1)})

MOMENTUM INDICATORS (Most Important):
- 1h Momentum: ${(indicators.momentum1h * 100).toFixed(3)}% (recent trend - PRIMARY signal)
- 4h Momentum: ${(indicators.momentum4h * 100).toFixed(3)}% (longer trend - context)
- Volume: ${indicators.volumeRatio.toFixed(2)}x average (${volumeTrend})

TECHNICAL CONTEXT:
- RSI(14): ${indicators.rsi.toFixed(1)} (overbought >70, oversold <30)
- MACD Histogram: ${indicators.macd.histogram.toFixed(6)} (momentum divergence)
- Price vs Recent High: ${((price - indicators.recentHigh) / indicators.recentHigh * 100).toFixed(2)}%
- Price vs EMA200: ${((price - indicators.ema200) / indicators.ema200 * 100).toFixed(2)}%

COST ANALYSIS (Critical for profitability):
- Exchange Fees: ${(costs.feePct * 100).toFixed(3)}%
- Spread: ${(costs.spreadPct * 100).toFixed(3)}%
- Total Costs: ${(costs.totalCostsPct * 100).toFixed(3)}%
- Profit Target: ${(costs.profitTargetPct * 100).toFixed(2)}%
- Net Edge: ${(costs.netEdgePct * 100).toFixed(2)}% (profit minus costs)
- Risk-Reward: ${costs.riskRewardRatio.toFixed(2)}:1

DECISION RULES (Follow Strictly):
1. Positive 1h momentum is PRIMARY signal - prices rising > secondary concerns
2. Recent momentum (1h) is MORE important than 4h momentum
3. BUY when 1h momentum POSITIVE (>0%) - this indicates upward price movement
4. HOLD when 1h momentum NEGATIVE (≤0%) - do not chase falling prices
5. Secondary caution: Price near top (>1.0%) OR RSI extreme (>85) - only if momentum weak
6. Low volume acceptable if momentum positive - shows early stage of move
7. Focus on EARLY recovery signals - 1h positive when 4h negative = strong entry
8. Cost floor check: If profit < ${(costs.costFloorPct * 100).toFixed(2)}%, we HOLD
9. If risk-reward < 2.0, we HOLD
10. PRIORITY: A positive 1h momentum reading OVERRIDES secondary technical concerns

REGIME-SPECIFIC STRATEGY:
- ${this.getRegimeStrategy(indicators.adx)}

PRIMARY QUESTION: Will ${pair} move UP in the next 1-4 hours with >60% probability?

JSON Response Format (REQUIRED):
{
  "decision": "BUY" or "HOLD",
  "confidence": <number 0-100>,
  "reasoning": ["reason1", "reason2", "reason3"]
}

Focus confidence on probability of upward movement. Respond with ONLY the JSON, no markdown.`;
  }

  /**
   * Determine trading regime from ADX
   */
  private getRegimeFromADX(adx: number): string {
    if (adx < 20) return 'Ranging/Choppy';
    if (adx < 30) return 'Weak Trend';
    if (adx < 40) return 'Moderate Trend';
    return 'Strong Trend';
  }

  /**
   * Get regime-specific strategy guidance
   */
  private getRegimeStrategy(adx: number): string {
    if (adx < 20) {
      return 'RANGING MARKET: Take quick profits (2% target), avoid oversized positions, use RSI divergences';
    } else if (adx < 30) {
      return 'WEAK TREND: Moderate positions (4-5% target), require 1h+4h alignment, watch for breakouts';
    } else if (adx < 40) {
      return 'MODERATE TREND: Let winners run (5-8% target), pyramiding OK if volume > 1.3x, manage inversions';
    } else {
      return 'STRONG TREND: Maximize gains (10%+ target), aggressive pyramiding OK, only exit on reversal signals';
    }
  }

  /**
   * Parse AI response
   */
  private parseResponse(content: string): AIDecision {
    try {
      // Clean markdown formatting
      let jsonStr = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed = JSON.parse(jsonStr);

      return {
        decision: parsed.decision === 'BUY' ? 'BUY' : 'HOLD',
        confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 0)),
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
      };
    } catch (error) {
      logger.warn('Failed to parse AI response', { content, error });
      return {
        decision: 'HOLD',
        confidence: 0,
        reasoning: ['Failed to parse AI response'],
      };
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(pair: string, price: number, indicators: Indicators): string {
    // Cache based on price (rounded to nearest 100) + RSI bucket + volume bucket
    const priceBucket = Math.floor(price / 100) * 100;
    const rsiBucket = Math.floor(indicators.rsi / 5);
    const volumeBucket = Math.floor(indicators.volumeRatio / 0.5);

    return `${pair}:${priceBucket}:${rsiBucket}:${volumeBucket}`;
  }

  /**
   * Check cache for decision
   */
  private getFromCache(cacheKey: string): AIDecision | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > cached.ttlMs) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    logger.debug(`Cache HIT for ${cacheKey}`);
    return cached.data;
  }

  /**
   * Save to cache
   */
  private setCache(cacheKey: string, decision: AIDecision): void {
    this.responseCache.set(cacheKey, {
      data: decision,
      timestamp: Date.now(),
      ttlMs: this.CACHE_TTL_MS,
    });
  }

  /**
   * Make entry decision via OpenAI
   * Cost: ~$0.0003 per call (2000 tokens * $0.15/1M input + $0.60/1M output)
   */
  async decideEntry(
    pair: string,
    price: number,
    indicators: Indicators,
    costs: CostAnalysis
  ): Promise<AIDecision> {
    // Check cache first (85%+ hit rate based on NexusMeme data)
    const cacheKey = this.getCacheKey(pair, price, indicators);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Build prompt
      const prompt = this.buildEntryPrompt(pair, price, indicators, costs);

      // Call OpenAI
      const response = await this.client.chat.completions.create({
        model: this.config.aiModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Low temperature for consistent decisions
        max_tokens: 300,
      });

      // Parse response
      const content = response.choices[0].message.content || '';
      const decision = this.parseResponse(content);

      // Track costs
      this.totalCallsToday++;
      const inputTokens = prompt.length / 4; // Rough estimate
      const outputTokens = 100; // Rough estimate
      const callCost = (inputTokens * this.COST_PER_1M_INPUT + outputTokens * this.COST_PER_1M_OUTPUT) / 1_000_000;
      this.estimatedCostUSD += callCost;

      // Log decision
      logger.logAIDecision(pair, decision.decision, decision.confidence, decision.reasoning);

      // Cache result
      this.setCache(cacheKey, decision);

      return decision;
    } catch (error) {
      logger.logAPIError('OpenAI API', error);
      // Fallback to HOLD on error
      return {
        decision: 'HOLD',
        confidence: 0,
        reasoning: ['AI API error, defaulting to HOLD'],
      };
    }
  }

  /**
   * Get cost statistics
   */
  getCostStats(): {
    totalCalls: number;
    estimatedCostUSD: number;
    cacheHitRate: number;
    cacheSize: number;
  } {
    // Reset daily stats if needed
    const now = Date.now();
    if (now - this.lastDayReset > 86400000) {
      this.totalCallsToday = 0;
      this.estimatedCostUSD = 0;
      this.lastDayReset = now;
    }

    const cacheHitRate = this.totalCallsToday > 0 ? ((this.responseCache.size / this.totalCallsToday) * 100).toFixed(1) : '0';

    return {
      totalCalls: this.totalCallsToday,
      estimatedCostUSD: parseFloat(this.estimatedCostUSD.toFixed(2)),
      cacheHitRate: parseFloat(cacheHitRate),
      cacheSize: this.responseCache.size,
    };
  }

  /**
   * Build pyramid decision prompt
   * ~600 tokens per prompt
   */
  private buildPyramidPrompt(
    pair: string,
    price: number,
    level: 1 | 2,
    currentProfit: number,
    indicators: Indicators
  ): string {
    const levelTrigger = level === 1 ? '4.5%' : '8%';
    const regime = this.getRegimeFromADX(indicators.adx);
    const addSizePct = level === 1
      ? `${(this.config.pyramidAddSizePctL1 * 100).toFixed(0)}%`
      : `${(this.config.pyramidAddSizePctL2 * 100).toFixed(0)}%`;

    return `You are an expert cryptocurrency trader evaluating a pyramid add opportunity.

PYRAMID ADD EVALUATION - Level ${level}:
- Pair: ${pair}
- Current Price: $${price.toFixed(2)}
- Current Profit: ${(currentProfit * 100).toFixed(2)}%
- Level ${level} Trigger: ${levelTrigger}
- Market Regime: ${regime} (ADX: ${indicators.adx.toFixed(1)})

CURRENT INDICATORS:
- 1h Momentum: ${(indicators.momentum1h * 100).toFixed(3)}% (direction trend)
- 4h Momentum: ${(indicators.momentum4h * 100).toFixed(3)}% (longer trend)
- Volume Ratio: ${indicators.volumeRatio.toFixed(2)}x average
- RSI(14): ${indicators.rsi.toFixed(1)}

PYRAMID ADD RULES:
1. ONLY add if profit target has been reached (${levelTrigger})
2. ONLY add if momentum is STILL POSITIVE (not reversing)
3. ONLY add if volume supports continued move (>1.0x)
4. Level ${level} requires VERY HIGH CONFIDENCE (${level === 1 ? '85%' : '90%'})
5. If RSI >80, be cautious (getting extended)
6. If momentum is declining, DECLINE the add

DECISION: Should we add Level ${level} (${addSizePct} size)?

JSON Response Format (REQUIRED):
{
  "shouldAdd": true or false,
  "confidence": <number 0-100>,
  "reasoning": ["reason1", "reason2"]
}

Focus on momentum continuation and strong confirmation. Respond with ONLY JSON, no markdown.`;
  }

  /**
   * Make pyramid add decision via OpenAI
   * Cost: ~$0.0002 per call
   */
  async decidePyramidAdd(
    pair: string,
    price: number,
    level: 1 | 2,
    currentProfit: number,
    indicators: Indicators
  ): Promise<PyramidDecision> {
    try {
      // Build prompt
      const prompt = this.buildPyramidPrompt(pair, price, level, currentProfit, indicators);

      // Call OpenAI
      const response = await this.client.chat.completions.create({
        model: this.config.aiModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 250,
      });

      // Parse response
      const content = response.choices[0].message.content || '';
      const parsed = this.parsePyramidResponse(content);

      // Track costs
      this.totalCallsToday++;
      const inputTokens = prompt.length / 4;
      const outputTokens = 100;
      const callCost = (inputTokens * this.COST_PER_1M_INPUT + outputTokens * this.COST_PER_1M_OUTPUT) / 1_000_000;
      this.estimatedCostUSD += callCost;

      logger.debug(`Pyramid L${level} decision for ${pair}`, {
        shouldAdd: parsed.shouldAdd,
        confidence: parsed.confidence,
      });

      return parsed;
    } catch (error) {
      logger.logAPIError('OpenAI Pyramid API', error);
      // Default to no add on error
      return {
        shouldAdd: false,
        level,
        confidence: 0,
        reasoning: ['AI API error, declining pyramid add'],
      };
    }
  }

  /**
   * Parse pyramid decision response
   */
  private parsePyramidResponse(content: string): PyramidDecision {
    try {
      let jsonStr = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed = JSON.parse(jsonStr);
      const level = parsed.level || (parsed.shouldAdd ? 1 : 0);

      return {
        shouldAdd: parsed.shouldAdd === true,
        level: (level === 2 ? 2 : 1) as 1 | 2,
        confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 0)),
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
      };
    } catch (error) {
      logger.warn('Failed to parse pyramid response', { content, error });
      return {
        shouldAdd: false,
        level: 1,
        confidence: 0,
        reasoning: ['Failed to parse pyramid response'],
      };
    }
  }

  /**
   * Clear cache manually
   */
  clearCache(): void {
    this.responseCache.clear();
    logger.info('AI response cache cleared');
  }
}

export default OpenAIDecisionMaker;
