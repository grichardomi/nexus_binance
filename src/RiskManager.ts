import { logger } from './utils/logger';
import { Indicators, CostAnalysis, RiskFilterResult, Config } from './utils/types';

/**
 * RiskManager implements 5-stage risk filtering to protect capital
 * Based on NexusMeme's battle-tested DropGuard and cost validation patterns
 */
export class RiskManager {
  private config: Config;
  private btcMomentum1h: number = 0;
  private aiCallsLastHour: number = 0;
  private lastAICallReset: number = Date.now();

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Update BTC momentum (used for drop protection on altcoins)
   */
  updateBTCMomentum(momentum: number): void {
    this.btcMomentum1h = momentum;
  }

  /**
   * Track AI calls for rate limiting
   */
  incrementAICallCount(): void {
    const now = Date.now();
    if (now - this.lastAICallReset > 3600000) {
      // Reset every hour
      this.aiCallsLastHour = 0;
      this.lastAICallReset = now;
    }
    this.aiCallsLastHour++;
  }

  /**
   * Determine market regime from ADX
   * Used to filter entries and set profit targets
   */
  getRegime(adx: number): 'choppy' | 'weak' | 'moderate' | 'strong' {
    if (adx < this.config.adxChoppyThreshold) return 'choppy';
    if (adx < 30) return 'weak';
    if (adx < this.config.adxStrongThreshold) return 'moderate';
    return 'strong';
  }

  /**
   * Check if market is too choppy for entry
   * CRITICAL: Avoid trading in ranging markets (ADX < 20)
   */
  isChoppyMarket(adx: number): boolean {
    return adx < this.config.minADXForEntry;
  }

  /**
   * Get erosion cap based on market regime
   * Choppy: 0.6%, Trending: 0.8%
   */
  getErosionCap(regime: 'choppy' | 'weak' | 'moderate' | 'strong'): number {
    if (regime === 'choppy') {
      return this.config.pyramidErosionCapChoppy;
    }
    return this.config.pyramidErosionCapTrend; // Weak, moderate, strong all use trend cap
  }

  /**
   * STAGE 1: Health Checks + Chop Detection
   * Verify API health, rate limits, and market regime
   */
  checkHealthGate(adx?: number): RiskFilterResult {
    // Check AI rate limit
    if (this.aiCallsLastHour >= this.config.aiMaxCallsPerHour) {
      return {
        pass: false,
        reason: `AI rate limit exceeded (${this.aiCallsLastHour}/${this.config.aiMaxCallsPerHour})`,
        stage: 1,
      };
    }

    // Chop avoidance: Block entries in choppy markets (ADX < 20)
    if (adx !== undefined && this.isChoppyMarket(adx)) {
      return {
        pass: false,
        reason: `Choppy market detected (ADX ${adx.toFixed(1)} < ${this.config.minADXForEntry})`,
        stage: 1,
      };
    }

    return { pass: true, stage: 1 };
  }

  /**
   * STAGE 2: Drop Protection (NexusMeme's DropGuard)
   * Block entries when market is crashing or showing panic
   */
  checkDropProtection(
    pair: string,
    ticker: { spread: number } | null,
    indicators: Indicators
  ): RiskFilterResult {
    // BTC dump detection (altcoins follow BTC down)
    if (pair !== 'BTC/USD' && this.btcMomentum1h < this.config.btcDumpThreshold1h) {
      return {
        pass: false,
        reason: `BTC dumping (${(this.btcMomentum1h * 100).toFixed(2)}%)`,
        stage: 2,
      };
    }

    // Volume panic (3x normal = panic selling)
    if (indicators.volumeRatio > this.config.volumeSpikeMax) {
      return {
        pass: false,
        reason: `Volume panic spike (${indicators.volumeRatio.toFixed(2)}x)`,
        stage: 2,
      };
    }

    // Spread widening (liquidity drying up)
    if (ticker && ticker.spread > 0) {
      const spreadPct = ticker.spread / 90000; // Approximate % for typical BTC price
      if (spreadPct > this.config.spreadWideningPct) {
        return {
          pass: false,
          reason: `Spread widening (${(spreadPct * 100).toFixed(3)}%)`,
          stage: 2,
        };
      }
    }

    return { pass: true, stage: 2 };
  }

  /**
   * STAGE 3: Entry Quality
   * Block obvious bad entries before wasting AI calls
   */
  checkEntryQuality(
    price: number,
    indicators: Indicators
  ): RiskFilterResult {
    // Avoid buying at local tops — but ONLY in truly choppy markets
    // Use config threshold (default 12) instead of hardcoded 25
    // NexusMeme allows entries in weak trends with dynamic profit targets
    const isTrending = indicators.adx >= this.config.adxChoppyThreshold;

    // Only block price-at-top if ADX is extremely low (< config threshold)
    // This matches nexusmeme's approach of allowing entries in weak trends
    if (!isTrending && price > indicators.recentHigh * 0.998) {
      return {
        pass: false,
        reason: `Price at local top in choppy market ($${price.toFixed(2)} vs high $${indicators.recentHigh.toFixed(2)}, ADX ${indicators.adx.toFixed(1)})`,
        stage: 3,
      };
    }

    // Avoid extreme overbought (RSI > 85)
    if (indicators.rsi > 85) {
      return {
        pass: false,
        reason: `RSI extreme overbought (${indicators.rsi.toFixed(1)})`,
        stage: 3,
      };
    }

    // Require minimum momentum - but be lenient in weak trends
    // NexusMeme approach: allow entries in low-momentum conditions with tighter profit targets
    // In trending markets: very low threshold (momentum confirmed by ADX)
    // In weak trends: moderate threshold
    // In choppy markets: higher threshold
    const momentumThreshold = isTrending ? 0.001 : (indicators.adx >= 10 ? 0.002 : 0.004);

    const has1hMomentum = indicators.momentum1h > momentumThreshold;
    const hasBothPositive = indicators.momentum1h >= 0 && indicators.momentum4h >= 0; // Changed > to >= for weak trends
    const hasVolumeBreakout = indicators.volumeRatio > 1.2 && indicators.momentum1h >= 0; // Lowered threshold

    const passesEntryGate = has1hMomentum || hasBothPositive || hasVolumeBreakout;

    if (!passesEntryGate) {
      return {
        pass: false,
        reason: `Weak momentum (1h: ${(indicators.momentum1h * 100).toFixed(2)}%, 4h: ${(indicators.momentum4h * 100).toFixed(2)}%, ADX: ${indicators.adx.toFixed(1)})`,
        stage: 3,
      };
    }

    return { pass: true, stage: 3 };
  }

  /**
   * STAGE 4: AI Validation
   * Delegated to OpenAIDecisionMaker - checks confidence threshold
   * This method just documents the stage
   */
  checkAIValidation(confidence: number): RiskFilterResult {
    if (confidence < this.config.aiMinConfidence) {
      return {
        pass: false,
        reason: `AI confidence too low (${confidence}% < ${this.config.aiMinConfidence}%)`,
        stage: 4,
      };
    }

    return { pass: true, stage: 4 };
  }

  /**
   * STAGE 5: Cost Validation
   * Ensure profit is worth the fees and risk
   */
  calculateCosts(
    pair: string,
    _price: number,
    _volume: number,
    profitTarget: number
  ): CostAnalysis {
    // Exchange fees (Binance US defaults around 0.1% per side)
    const feePct = this.config.exchangeFeePct * 2; // Round trip

    // Spread estimation (Binance majors typically 1-3 bps for BTC/ETH)
    // Approximate spread as 2% of ATR or 0.005% for major pairs
    let spreadPct = 0.0005; // 0.005% for liquid pairs
    if (pair === 'BTC/USD' || pair === 'ETH/USD') {
      spreadPct = 0.0003; // Even tighter for major pairs
    }

    // Slippage (market impact on our order size)
    // For conservative sizing: negligible
    const slippagePct = 0.0001;

    // Total costs
    const totalCostsPct = feePct + spreadPct + slippagePct;

    // Cost floor: profit must be 3× costs minimum
    const costFloorPct = totalCostsPct * this.config.minProfitMultiplier;
    const passesCostFloor = profitTarget >= costFloorPct;

    // Risk-reward ratio
    const stopLossPct = this.config.stopLossPct;
    const riskRewardRatio = profitTarget / stopLossPct;
    const passesRiskRewardRatio = riskRewardRatio >= this.config.minRiskRewardRatio;

    // Net edge after costs
    const netEdgePct = profitTarget - totalCostsPct;

    return {
      feePct,
      spreadPct,
      slippagePct,
      totalCostsPct,
      profitTargetPct: profitTarget,
      netEdgePct,
      costFloorPct,
      passesCostFloor,
      riskRewardRatio,
      passesRiskRewardRatio: passesRiskRewardRatio,
    };
  }

  /**
   * STAGE 5: Cost Validation
   * Ensure trade meets cost floor and risk-reward requirements
   */
  checkCostFloor(costs: CostAnalysis): RiskFilterResult {
    // Check cost floor
    if (!costs.passesCostFloor) {
      return {
        pass: false,
        reason: `Profit (${(costs.profitTargetPct * 100).toFixed(2)}%) below cost floor (${(costs.costFloorPct * 100).toFixed(2)}%)`,
        stage: 5,
      };
    }

    // Check risk-reward ratio
    if (!costs.passesRiskRewardRatio) {
      return {
        pass: false,
        reason: `Risk-reward (${costs.riskRewardRatio.toFixed(2)}:1) below minimum (${this.config.minRiskRewardRatio}:1)`,
        stage: 5,
      };
    }

    // Check net edge (profit > costs)
    if (costs.netEdgePct <= 0) {
      return {
        pass: false,
        reason: `No net edge after costs (${(costs.netEdgePct * 100).toFixed(2)}%)`,
        stage: 5,
      };
    }

    return { pass: true, stage: 5 };
  }

  /**
   * Run complete 5-stage risk filtering (with chop avoidance)
   */
  async runFullRiskFilter(
    pair: string,
    price: number,
    indicators: Indicators,
    ticker: { spread: number } | null,
    profitTarget: number
  ): Promise<RiskFilterResult> {
    // Stage 1: Health checks + Chop detection
    const health = this.checkHealthGate(indicators.adx);
    if (!health.pass) {
      logger.logFilterRejection(pair, 'health_check', health.reason);
      return health;
    }

    // Stage 2: Drop protection
    const drop = this.checkDropProtection(pair, ticker, indicators);
    if (!drop.pass) {
      logger.logFilterRejection(pair, 'drop_protection', drop.reason);
      return drop;
    }

    // Stage 3: Entry quality
    const quality = this.checkEntryQuality(price, indicators);
    if (!quality.pass) {
      logger.logFilterRejection(pair, 'entry_quality', quality.reason);
      return quality;
    }

    // Stage 4: AI Validation (done by caller)
    // Stage 5: Cost validation
    const costs = this.calculateCosts(pair, price, 0, profitTarget);
    const costCheck = this.checkCostFloor(costs);
    if (!costCheck.pass) {
      logger.logFilterRejection(pair, 'cost_validation', costCheck.reason);
      return costCheck;
    }

    return { pass: true, stage: 5 };
  }

  /**
   * Validate pyramid add (L1 or L2)
   * Stricter than initial entry: higher AI confidence required
   */
  validatePyramidAdd(
    _pair: string,
    aiConfidence: number,
    level: 1 | 2,
    currentProfit: number,
    targetProfitPct: number
  ): RiskFilterResult {
    // Check AI confidence gates
    const minConfidence = level === 1 ? this.config.pyramidL1ConfidenceMin : this.config.pyramidL2ConfidenceMin;
    if (aiConfidence < minConfidence) {
      return {
        pass: false,
        reason: `L${level} AI confidence (${aiConfidence}%) below minimum (${minConfidence}%)`,
        stage: 4,
      };
    }

    // Check profit has reached trigger
    if (currentProfit < targetProfitPct) {
      return {
        pass: false,
        reason: `Profit (${(currentProfit * 100).toFixed(2)}%) not at L${level} trigger (${(targetProfitPct * 100).toFixed(2)}%)`,
        stage: 3,
      };
    }

    return { pass: true, stage: 4 };
  }

  /**
   * Calculate position size based on account balance and risk
   */
  calculatePositionSize(
    accountBalance: number,
    price: number
  ): { sizeUSD: number; sizeAsset: number; riskUSD: number } {
    const riskUSD = accountBalance * this.config.riskPerTradePct;
    const sizeUSD = riskUSD / this.config.stopLossPct; // Fixed USD size for consistent risk
    const sizeAsset = sizeUSD / price;

    return {
      sizeUSD,
      sizeAsset,
      riskUSD,
    };
  }

  /**
   * Calculate stop loss and profit target prices
   */
  calculateLevels(
    entryPrice: number,
    direction: 'buy' | 'sell' = 'buy'
  ): { stopLoss: number; profitTarget: number } {
    if (direction === 'buy') {
      return {
        stopLoss: entryPrice * (1 - this.config.stopLossPct),
        profitTarget: entryPrice * (1 + this.config.profitTargetPct),
      };
    } else {
      return {
        stopLoss: entryPrice * (1 + this.config.stopLossPct),
        profitTarget: entryPrice * (1 - this.config.profitTargetPct),
      };
    }
  }
}

export default RiskManager;
