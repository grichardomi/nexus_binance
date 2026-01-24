/**
 * Core TypeScript interfaces for Binance + OpenAI Trading Bot
 */

// Configuration
export interface Config {
  // API Keys
  openaiApiKey: string;
  binanceApiKey: string;
  binanceApiSecret: string;
  botName: string;
  dataDir: string;

  // Trading Configuration
  pairs: string[];
  timeframe: string;
  checkIntervalMs: number;
  maxConcurrentTrades: number;
  paperTrading: boolean;

  // Risk Management
  accountBalance: number; // Fetched from Binance (live) or user-defined (paper)
  stopLossPct: number;
  profitTargetPct: number;
  paperTradingBalance: number; // Default balance for paper trading ($10k)
  maxAdverseMovePct: number; // Additional cut if price moves this much against entry
  maxHoldMinutesAtLoss: number; // Time stop when holding at <=0% P&L

  // Dynamic Position Sizing
  dynamicSizingEnabled: boolean;
  maxRiskPerTrade: number; // Max 10% per trade
  minRiskPerTrade: number; // Min 1% per trade
  kellyFraction: number; // Fraction of Kelly Criterion (0.25 = 1/4)
  riskPerTradePct: number; // Fallback if dynamic sizing disabled

  // Drop Protection
  btcDumpThreshold1h: number;
  volumeSpikeMax: number;
  spreadWideningPct: number;

  // Chop Avoidance (ADX-based regime filtering)
  minADXForEntry: number; // Minimum ADX to avoid choppy markets (20+)
  adxChoppyThreshold: number; // ADX < this = choppy (default 20)
  adxStrongThreshold: number; // ADX > this = strong trend (default 35)

  // Pyramiding Configuration
  pyramidingEnabled: boolean;
  pyramidLevels: number; // 2 levels (L1 + L2)
  pyramidL1TriggerPct: number; // 4.5% profit
  pyramidL2TriggerPct: number; // 8% profit (roughly 4.5% more)
  pyramidAddSizePct: number; // Deprecated: use pyramidAddSizePctL1 and pyramidAddSizePctL2
  pyramidAddSizePctL1: number; // 35% of original position size for L1 add
  pyramidAddSizePctL2: number; // 50% of original position size for L2 add
  pyramidL1ConfidenceMin: number; // 85% AI confidence for L1
  pyramidL2ConfidenceMin: number; // 90% AI confidence for L2
  pyramidErosionCapChoppy: number; // 0.6% max erosion in ranging
  pyramidErosionCapTrend: number; // 0.8% max erosion in trending
  profitLockEnabled: boolean; // Enable profit-lock giveback guard
  profitLockMinGainPct: number; // Minimum gain (fraction) before locking
  profitLockGivebackPct: number; // Fraction of peak allowed to give back

  // Momentum Failure Detection (Conservative AI Exit Replacement)
  momentumFailureEnabled: boolean;
  momentumFailureMinProfit: number; // Only check when profit > this
  momentumFailureLossActivation: number; // Also check when loss below this
  momentum1hFailureThreshold: number; // -0.3% for fast strategies
  momentum4hFailureThreshold: number; // -0.5% for slow strategies
  volumeExhaustionThreshold1h: number; // <0.9× average
  volumeExhaustionThreshold4h: number; // <1.0× average
  htfMomentumWeakening: number; // <0.5% = weak HTF momentum
  priceNearPeakThreshold: number; // >98% of recent high
  momentumFailureRequiredSignals: number; // Require N of 3 signals

  // Underwater Exit Protection (for trades that never profited)
  underwaterExitThresholdPct: number; // -0.8% (exit if loss exceeds this and never profited)
  underwaterExitMinTimeMinutes: number; // 15min min time before underwater exit check

  // AI Configuration
  aiModel: string;
  aiMinConfidence: number;
  aiMaxCallsPerHour: number;
  aiCacheMinutes: number;

  // Cost Analysis
  exchangeFeePct: number;
  slippagePct: number;
  minProfitMultiplier: number;
  minRiskRewardRatio: number;

  // Logging
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  logToFile: boolean;
  logFilePath: string;
}

// Market Data
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  bid: number;
  ask: number;
  price: number;
  volume: number;
  spread: number;
}

export interface MarketData {
  pair: string;
  currentPrice: number;
  bid: number;
  ask: number;
  volume: number;
  candles: Candle[];
  indicators: Indicators;
}

// Technical Indicators
export interface Indicators {
  rsi: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  adx: number;
  volumeRatio: number;
  momentum1h: number;
  momentum4h: number;
  recentHigh: number;
  recentLow: number;
  ema200: number;
}

// AI Decision
export interface AIDecision {
  decision: 'BUY' | 'HOLD';
  confidence: number;
  reasoning: string[];
}

// Pyramid Decision (for L1/L2 adds)
export interface PyramidDecision {
  shouldAdd: boolean;
  level: 1 | 2; // Which level to add
  confidence: number;
  reasoning: string[];
}

// Pyramid Level tracking
export interface PyramidLevel {
  level: 1 | 2; // L1 or L2
  entryPrice: number;
  volume: number; // Size added at this level
  entryTime: number;
  triggerProfitPct: number; // 4.5% for L1, 8% for L2
  aiConfidence: number; // AI confidence when added
  status: 'active' | 'closed';
}

// Position (now supports pyramiding)
export interface Position {
  pair: string;
  // Initial entry (L0)
  entryPrice: number;
  volume: number; // Original L0 volume
  entryTime: number;

  // Stop loss and initial profit target
  stopLoss: number;
  profitTarget: number;

  // Pyramid levels
  pyramidLevels: PyramidLevel[]; // L1 and L2 adds
  totalVolume: number; // L0 + L1 + L2 volumes
  pyramidLevelsActivated: number; // 0, 1, or 2

  // Profit tracking
  currentProfit: number;
  profitPct: number;
  peakProfit: number; // Peak profit reached (for erosion tracking)

  // Erosion protection
  erosionCap: number; // 0.6-0.8% max giveback
  erosionUsed: number; // Current erosion amount

  // Entry metadata
  aiReasoning: string[];
  adx: number; // ADX at entry time (for regime context)
  regime: 'choppy' | 'weak' | 'moderate' | 'strong'; // Market regime

  status: 'open' | 'closed';
  exitPrice?: number;
  exitTime?: number;
  exitReason?: string;
}

// Momentum Failure Detection Result
export interface MomentumFailureResult {
  shouldExit: boolean;
  signals: {
    priceActionFailure: boolean;
    volumeExhaustion: boolean;
    htfBreakdown: boolean;
  };
  signalCount: number;
  reasoning: string[];
}

// Cost Analysis
export interface CostAnalysis {
  feePct: number;
  spreadPct: number;
  slippagePct: number;
  totalCostsPct: number;
  profitTargetPct: number;
  netEdgePct: number;
  costFloorPct: number;
  passesCostFloor: boolean;
  riskRewardRatio: number;
  passesRiskRewardRatio: boolean;
}

// Risk Filter Result
export interface RiskFilterResult {
  pass: boolean;
  reason?: string;
  stage?: number;
}

// Trading Entry
export interface TradeEntry {
  pair: string;
  price: number;
  volume: number;
  aiDecision: AIDecision;
  costs: CostAnalysis;
  timestamp: number;
}

// Trading Exit
export interface TradeExit {
  pair: string;
  exitPrice: number;
  exitReason: string;
  profitPct: number;
  timestamp: number;
}

// Performance Stats
export interface PerformanceStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  expectancy: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
}

// AI Cache Entry
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

// Binance API responses (partial)
export interface BinanceTickerBook {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

export interface BinanceTicker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
}

// Logger interface
export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

// Log Entry
export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

// Activity Feed Entry (for dashboard monitoring)
export interface ActivityFeedEntry {
  timestamp: number;
  pair: string;
  action: 'ENTRY' | 'PYRAMID' | 'EXIT' | 'EROSION_ALERT' | 'UNDERWATER_ALERT' | 'COLLAPSE_ALERT';
  details: {
    price?: number;
    volume?: number;
    profit?: number;
    profitPct?: number;
    reason?: string;
    erosionPct?: number;
    lossPct?: number;
    ageMinutes?: number;
    peakProfit?: number;
    currentProfit?: number;
    peakProfitPct?: number;
    currentProfitPct?: number;
  };
}

// Position Health (for dashboard)
export interface PositionHealth {
  pair: string;
  entryPrice: number;
  currentProfit: number;
  profitPct: number;
  peakProfit: number;
  erosionUsed: number;
  erosionCap: number;
  erosionPct: number;
  holdTimeMinutes: number;
  healthStatus: 'HEALTHY' | 'CAUTION' | 'RISK' | 'ALERT';
  alertMessage?: string;
}
