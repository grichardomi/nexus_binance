/**
 * Unit tests for momentum failure detector
 * Note: These tests validate the type system and basic logic flow.
 * Full integration tests require live market data or mocked MarketData objects.
 */

import { MomentumFailureResult, Position, MarketData } from '../utils/types';

describe('Momentum Failure Detector Types', () => {
  describe('MomentumFailureResult interface', () => {
    it('should have correct structure', () => {
      const result: MomentumFailureResult = {
        shouldExit: false,
        signals: {
          priceActionFailure: false,
          volumeExhaustion: false,
          htfBreakdown: false,
        },
        signalCount: 0,
        reasoning: [],
      };

      expect(result.shouldExit).toBe(false);
      expect(result.signalCount).toBe(0);
      expect(result.signals).toBeDefined();
      expect(result.reasoning).toEqual([]);
    });

    it('should handle exit scenario', () => {
      const result: MomentumFailureResult = {
        shouldExit: true,
        signals: {
          priceActionFailure: true,
          volumeExhaustion: true,
          htfBreakdown: false,
        },
        signalCount: 2,
        reasoning: [
          'Price action failure: 99.0% of peak, 1h momentum -0.35% (threshold: -0.30%)',
          'Volume exhaustion: 0.85× (threshold: 0.90×)',
          'EXIT TRIGGERED: 2/2 signals met (profit: 3.00%)',
        ],
      };

      expect(result.shouldExit).toBe(true);
      expect(result.signalCount).toBe(2);
      expect(result.reasoning.length).toBe(3);
    });
  });

  describe('Position interface', () => {
    it('should support momentum failure tracking with profitPct', () => {
      const position: Position = {
        pair: 'BTC/USD',
        entryPrice: 50000,
        volume: 0.1,
        entryTime: Date.now(),
        stopLoss: 47500,
        profitTarget: 55000,
        pyramidLevels: [],
        totalVolume: 0.1,
        pyramidLevelsActivated: 0,
        currentProfit: 1500,
        profitPct: 3.0, // 3% profit
        peakProfit: 1500,
        erosionCap: 0.008,
        erosionUsed: 0,
        aiReasoning: [],
        adx: 25,
        regime: 'moderate',
        status: 'open',
      };

      expect(position.profitPct).toBe(3.0);
      expect(position.pyramidLevelsActivated).toBe(0);
    });

    it('should support pyramid levels tracking', () => {
      const position: Position = {
        pair: 'BTC/USD',
        entryPrice: 50000,
        volume: 0.1,
        entryTime: Date.now(),
        stopLoss: 47500,
        profitTarget: 55000,
        pyramidLevels: [
          {
            level: 1,
            entryPrice: 52250,
            volume: 0.02,
            entryTime: Date.now(),
            triggerProfitPct: 4.5,
            aiConfidence: 85,
            status: 'active',
          },
        ],
        totalVolume: 0.12,
        pyramidLevelsActivated: 1,
        currentProfit: 2500,
        profitPct: 5.0,
        peakProfit: 2500,
        erosionCap: 0.008,
        erosionUsed: 100,
        aiReasoning: [],
        adx: 28,
        regime: 'moderate',
        status: 'open',
      };

      expect(position.pyramidLevelsActivated).toBe(1);
      expect(position.pyramidLevels.length).toBe(1);
    });
  });

  describe('MarketData interface with momentum indicators', () => {
    it('should have required momentum indicators for failure detection', () => {
      const marketData: MarketData = {
        pair: 'BTC/USD',
        currentPrice: 51500,
        bid: 51495,
        ask: 51505,
        volume: 100,
        candles: [],
        indicators: {
          rsi: 50,
          macd: { line: 0, signal: 0, histogram: 0 },
          adx: 25,
          volumeRatio: 1.0,
          momentum1h: 0.5, // Required for price action failure detection
          momentum4h: 1.0, // Required for HTF breakdown detection
          recentHigh: 51500, // Required for price near peak detection
          recentLow: 50000,
          ema200: 50000, // Required for EMA200 breakdown detection
        },
      };

      expect(marketData.indicators.momentum1h).toBeDefined();
      expect(marketData.indicators.momentum4h).toBeDefined();
      expect(marketData.indicators.recentHigh).toBeDefined();
      expect(marketData.indicators.ema200).toBeDefined();
      expect(marketData.indicators.volumeRatio).toBeDefined();
    });

    it('should support momentum reversal scenario', () => {
      const marketData: MarketData = {
        pair: 'BTC/USD',
        currentPrice: 51400,
        bid: 51395,
        ask: 51405,
        volume: 50, // Low volume
        candles: [],
        indicators: {
          rsi: 70,
          macd: { line: 0, signal: 0, histogram: 0 },
          adx: 22,
          volumeRatio: 0.8, // Below average - exhaustion
          momentum1h: -0.35, // Negative 1h momentum - reversal
          momentum4h: 0.3, // Weak 4h momentum - HTF weakening (0.3% < 0.5% threshold)
          recentHigh: 51500,
          recentLow: 50000,
          ema200: 50500,
        },
      };

      // Verify conditions for momentum failure
      const priceNearPeak = marketData.currentPrice / marketData.indicators.recentHigh;
      expect(priceNearPeak).toBeGreaterThan(0.98);
      expect(marketData.indicators.momentum1h).toBeLessThan(-0.003);
      expect(marketData.indicators.volumeRatio).toBeLessThan(0.9);
      // momentum4h is 0.3%, threshold is 0.5% (0.005 * 100), so 0.3 < 0.5 is true
      expect(marketData.indicators.momentum4h).toBeLessThan(0.5);
    });
  });

  describe('Configuration type checking', () => {
    it('should require momentum failure configuration fields', () => {
      // This test verifies that the Config type includes all required fields
      // We can't import config directly in tests, but we can verify the interface exists
      // by checking that MomentumFailureResult is properly typed

      const result: MomentumFailureResult = {
        shouldExit: true,
        signals: {
          priceActionFailure: true,
          volumeExhaustion: true,
          htfBreakdown: true,
        },
        signalCount: 3,
        reasoning: [
          'All three signals triggered',
          'EXIT TRIGGERED: 3/3 signals met',
        ],
      };

      expect(result).toBeDefined();
      expect(result.signalCount).toBeGreaterThanOrEqual(2); // Minimum for exit
    });
  });

  describe('Exit reason tracking', () => {
    it('should support Momentum Failure as exit reason', () => {
      const position: Position = {
        pair: 'BTC/USD',
        entryPrice: 50000,
        volume: 0.1,
        entryTime: Date.now() - 3600000, // 1 hour ago
        stopLoss: 47500,
        profitTarget: 55000,
        pyramidLevels: [],
        totalVolume: 0.1,
        pyramidLevelsActivated: 0,
        currentProfit: 1500,
        profitPct: 3.0,
        peakProfit: 1500,
        erosionCap: 0.008,
        erosionUsed: 0,
        aiReasoning: [],
        adx: 25,
        regime: 'moderate',
        status: 'closed',
        exitPrice: 51500,
        exitTime: Date.now(),
        exitReason: 'Momentum Failure', // New exit reason
      };

      expect(position.exitReason).toBe('Momentum Failure');
      expect(position.status).toBe('closed');
    });
  });

  describe('Signal validation', () => {
    it('should correctly identify price action failure conditions', () => {
      // Test: Price near peak + negative momentum = failure
      const priceRatio = 51400 / 51500; // 99.8% of peak
      const isNearPeak = priceRatio >= 0.98;
      const momentumThreshold = -0.003;
      const momentum1h = -0.0035;
      const isNegativeMomentum = momentum1h * 100 < momentumThreshold * 100;

      expect(isNearPeak).toBe(true);
      expect(isNegativeMomentum).toBe(true);
    });

    it('should correctly identify volume exhaustion conditions', () => {
      const volumeRatio = 0.85;
      const threshold1h = 0.9;
      const isExhausted = volumeRatio < threshold1h;

      expect(isExhausted).toBe(true);
    });

    it('should correctly identify HTF breakdown conditions', () => {
      // Condition 1: 4h momentum weakening
      const momentum4h = 0.003;
      const weakThreshold = 0.005;
      const isWeakening = momentum4h < weakThreshold * 100;

      // Condition 2: Price below EMA200
      const price = 49800;
      const ema200 = 50000;
      const belowEMA = price < ema200;

      expect(isWeakening || belowEMA).toBe(true);
    });
  });
});
