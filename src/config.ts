import * as dotenv from 'dotenv';
import { Config } from './utils/types';

// Load environment variables from .env file
dotenv.config();

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const binanceApiKey = process.env.BINANCE_US_API_KEY || process.env.KRAKEN_API_KEY;
  const binanceApiSecret = process.env.BINANCE_US_API_SECRET || process.env.KRAKEN_API_SECRET;

  const requiredKeys = [
    { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY },
    { name: 'BINANCE_US_API_KEY (or KRAKEN_API_KEY)', value: binanceApiKey },
    { name: 'BINANCE_US_API_SECRET (or KRAKEN_API_SECRET)', value: binanceApiSecret },
  ];

  // Check for required API keys
  for (const { name, value } of requiredKeys) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }

  // Helper function to parse env vars with defaults
  const getEnv = (key: string, defaultValue?: string): string => {
    const primaryKey = `BINANCE_BOT_${key}`;
    const legacyKey = `KRAKEN_BOT_${key}`;
    return process.env[primaryKey] || process.env[legacyKey] || defaultValue || '';
  };

  const getEnvNumber = (key: string, defaultValue: number): number => {
    const value = getEnv(key);
    return value ? parseFloat(value) : defaultValue;
  };

  const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
    const value = getEnv(key);
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  const config: Config = {
    // API Keys
    openaiApiKey: process.env.OPENAI_API_KEY!,
    binanceApiKey: binanceApiKey!,
    binanceApiSecret: binanceApiSecret!,
    botName: process.env.BINANCE_BOT_NAME || process.env.BOT_NAME || 'Nexus Binance Bot',
    dataDir: process.env.BINANCE_BOT_DATA_DIR || process.env.BOT_DATA_DIR || './data-binance',

    // Trading Configuration
    pairs: getEnv('PAIRS', 'BTC/USD,ETH/USD').split(','),
    timeframe: getEnv('TIMEFRAME', '15m'),
    checkIntervalMs: getEnvNumber('CHECK_INTERVAL_MS', 60000),
    maxConcurrentTrades: getEnvNumber('MAX_CONCURRENT_TRADES', 2),
    paperTrading: getEnvBoolean('PAPER_TRADING', true),

    // Risk Management
    // accountBalance: For PAPER TRADING - user-defined test balance (defaults to $10k)
    //               For LIVE TRADING - fetched from Binance API (override with ACCOUNT_BALANCE_OVERRIDE if needed)
    accountBalance: getEnvNumber('ACCOUNT_BALANCE_OVERRIDE', 0), // 0 = use smart defaults
    stopLossPct: getEnvNumber('STOP_LOSS_PCT', 0.05),
    profitTargetPct: getEnvNumber('PROFIT_TARGET_PCT', 0.10),
    maxAdverseMovePct: getEnvNumber('MAX_ADVERSE_MOVE_PCT', 0.015),
    maxHoldMinutesAtLoss: getEnvNumber('MAX_HOLD_MINUTES_AT_LOSS', 60),

    // Dynamic Position Sizing (auto-scales based on AI confidence + win rate)
    dynamicSizingEnabled: getEnvBoolean('DYNAMIC_SIZING_ENABLED', true),
    maxRiskPerTrade: getEnvNumber('MAX_RISK_PER_TRADE', 0.10), // Max 10% per trade
    minRiskPerTrade: getEnvNumber('MIN_RISK_PER_TRADE', 0.01), // Min 1% per trade
    kellyFraction: getEnvNumber('KELLY_FRACTION', 0.25), // 1/4 Kelly (safer than full Kelly)
    riskPerTradePct: getEnvNumber('RISK_PER_TRADE_PCT', 0.05), // Fallback if dynamic disabled
    paperTradingBalance: getEnvNumber('PAPER_TRADING_BALANCE', 10000), // Default test balance $10k

    // Drop Protection
    btcDumpThreshold1h: getEnvNumber('BTC_DUMP_THRESHOLD_1H', -0.015),
    volumeSpikeMax: getEnvNumber('VOLUME_SPIKE_MAX', 3.0),
    spreadWideningPct: getEnvNumber('SPREAD_WIDENING_PCT', 0.005),

    // Chop Avoidance (ADX-based regime filtering)
    // NOTE: 15m timeframe has naturally lower ADX than 1h (12 on 15m ≈ 20 on 1h)
    minADXForEntry: getEnvNumber('MIN_ADX_FOR_ENTRY', 12),
    adxChoppyThreshold: getEnvNumber('ADX_CHOPPY_THRESHOLD', 12),
    adxStrongThreshold: getEnvNumber('ADX_STRONG_THRESHOLD', 30),

    // Pyramiding Configuration
    pyramidingEnabled: getEnvBoolean('PYRAMIDING_ENABLED', true),
    pyramidLevels: getEnvNumber('PYRAMID_LEVELS', 2),
    pyramidL1TriggerPct: getEnvNumber('PYRAMID_L1_TRIGGER_PCT', 0.045), // 4.5%
    pyramidL2TriggerPct: getEnvNumber('PYRAMID_L2_TRIGGER_PCT', 0.080), // 8%
    pyramidAddSizePct: getEnvNumber('PYRAMID_ADD_SIZE_PCT', 0.35), // Deprecated, kept for backwards compatibility
    pyramidAddSizePctL1: getEnvNumber('PYRAMID_ADD_SIZE_PCT_L1', 0.35), // 35% - aggressive pyramiding L1
    pyramidAddSizePctL2: getEnvNumber('PYRAMID_ADD_SIZE_PCT_L2', 0.50), // 50% - very aggressive L2
    pyramidL1ConfidenceMin: getEnvNumber('PYRAMID_L1_CONFIDENCE_MIN', 85),
    pyramidL2ConfidenceMin: getEnvNumber('PYRAMID_L2_CONFIDENCE_MIN', 90),
    pyramidErosionCapChoppy: getEnvNumber('PYRAMID_EROSION_CAP_CHOPPY', 0.006), // 0.6%
    pyramidErosionCapTrend: getEnvNumber('PYRAMID_EROSION_CAP_TREND', 0.008), // 0.8%
    profitLockEnabled: getEnvBoolean('PROFIT_LOCK_ENABLED', true),
    profitLockMinGainPct: getEnvNumber('PROFIT_LOCK_MIN_GAIN_PCT', 0.006), // 0.6%
    profitLockGivebackPct: getEnvNumber('PROFIT_LOCK_GIVEBACK_PCT', 0.5), // 50% giveback of peak profit

    // Momentum Failure Detection (Conservative AI Exit Replacement)
    momentumFailureEnabled: getEnvBoolean('MOMENTUM_FAILURE_ENABLED', true),
    momentumFailureMinProfit: getEnvNumber('MOMENTUM_FAILURE_MIN_PROFIT', 0.02), // 2%
    momentumFailureLossActivation: getEnvNumber('MOMENTUM_FAILURE_LOSS_ACTIVATION', -0.005), // -0.5%
    momentum1hFailureThreshold: getEnvNumber('MOMENTUM_1H_FAILURE_THRESHOLD', -0.003), // -0.3%
    momentum4hFailureThreshold: getEnvNumber('MOMENTUM_4H_FAILURE_THRESHOLD', -0.005), // -0.5%
    volumeExhaustionThreshold1h: getEnvNumber('VOLUME_EXHAUSTION_THRESHOLD_1H', 0.9),
    volumeExhaustionThreshold4h: getEnvNumber('VOLUME_EXHAUSTION_THRESHOLD_4H', 1.0),
    htfMomentumWeakening: getEnvNumber('HTF_MOMENTUM_WEAKENING', 0.005), // 0.5%
    priceNearPeakThreshold: getEnvNumber('PRICE_NEAR_PEAK_THRESHOLD', 0.98), // 98%
    momentumFailureRequiredSignals: getEnvNumber('MOMENTUM_FAILURE_REQUIRED_SIGNALS', 2),

    // Underwater Exit Protection (for trades that never profited)
    underwaterExitThresholdPct: getEnvNumber('UNDERWATER_EXIT_THRESHOLD_PCT', -0.008), // -0.8%
    underwaterExitMinTimeMinutes: getEnvNumber('UNDERWATER_EXIT_MIN_TIME_MINUTES', 15), // 15 minutes

    // AI Configuration
    aiModel: getEnv('AI_MODEL', 'gpt-4o-mini'),
    aiMinConfidence: getEnvNumber('AI_MIN_CONFIDENCE', 70),
    aiMaxCallsPerHour: getEnvNumber('AI_MAX_CALLS_PER_HOUR', 300),
    aiCacheMinutes: getEnvNumber('AI_CACHE_MINUTES', 15),

    // Cost Analysis
    exchangeFeePct: getEnvNumber('EXCHANGE_FEE_PCT', 0.002),
    slippagePct: getEnvNumber('SLIPPAGE_PCT', 0.001),
    minProfitMultiplier: getEnvNumber('MIN_PROFIT_MULTIPLIER', 3.0),
    minRiskRewardRatio: getEnvNumber('MIN_RISK_REWARD_RATIO', 2.0),

    // Logging
    logLevel: (getEnv('LOG_LEVEL', 'info') as 'error' | 'warn' | 'info' | 'debug'),
    logToFile: getEnvBoolean('LOG_TO_FILE', true),
    logFilePath: getEnv('LOG_FILE_PATH', './logs/trading.log'),
  };

  // Validate risky configurations
  if (!config.paperTrading) {
    console.warn('⚠️  LIVE TRADING MODE ENABLED - Real orders will be placed!');
    console.warn('⚠️  Make sure you have tested this bot thoroughly with paper trading first.');
  }

  if (config.riskPerTradePct > 0.10) {
    console.warn(`⚠️  HIGH RISK: Risk per trade is ${(config.riskPerTradePct * 100).toFixed(1)}% (recommended: 5%)`);
  }

  if (config.pairs.length === 0) {
    throw new Error('No trading pairs configured');
  }

  // Print active configuration
  console.log('\n📋 Trading Bot Configuration:');
  console.log(`  Mode: ${config.paperTrading ? '📄 PAPER TRADING' : '🔴 LIVE TRADING'}`);
  console.log(`  Bot: ${config.botName}`);
  console.log(`  Data Dir: ${config.dataDir}`);
  console.log(`  Pairs: ${config.pairs.join(', ')}`);
  console.log(`  Risk per trade: ${(config.riskPerTradePct * 100).toFixed(1)}%`);
  console.log(`  Stop loss: ${(config.stopLossPct * 100).toFixed(1)}%`);
  console.log(`  Profit target: ${(config.profitTargetPct * 100).toFixed(1)}%`);
  console.log(`  AI Model: ${config.aiModel}`);
  console.log(`  AI Confidence Threshold: ${config.aiMinConfidence}%`);
  console.log(`  Account Balance: $${config.accountBalance.toFixed(2)}`);
  console.log(`  Check Interval: ${(config.checkIntervalMs / 1000).toFixed(0)}s\n`);

  return config;
}

/**
 * Export config instance
 */
export const config = loadConfig();

export default config;
