import { logger } from './utils/logger';
import { Position, PerformanceStats } from './utils/types';

/**
 * Dynamic Position Sizer
 * Auto-adjusts stake amount based on:
 * - AI confidence (higher confidence = bigger positions)
 * - Historical win rate (proven winners compound larger)
 * - Kelly Criterion (optimal position sizing for edge)
 * - Risk of ruin protection (never over-leverage)
 */
export class DynamicPositionSizer {
  private accountBalance: number;
  private totalTrades: number = 0;
  private totalWins: number = 0;
  private totalLosses: number = 0;
  private avgWinPct: number = 0.025; // 2.5% average win
  private avgLossPct: number = 0.015; // 1.5% average loss

  // Safety caps
  private readonly MAX_RISK_PER_TRADE = 0.10; // Never risk >10% of balance
  private readonly MIN_RISK_PER_TRADE = 0.01; // Never risk <1% of balance
  private readonly KELLY_FRACTION = 0.25; // Use 1/4 Kelly to reduce variance
  private readonly MIN_AI_CONFIDENCE = 50;
  private readonly MAX_AI_CONFIDENCE = 95;

  constructor(initialBalance: number) {
    this.accountBalance = initialBalance;
  }

  /**
   * Update account balance (syncs with actual Binance balance)
   */
  updateBalance(newBalance: number): void {
    if (newBalance !== this.accountBalance) {
      logger.info(`Account balance updated: $${this.accountBalance.toFixed(2)} → $${newBalance.toFixed(2)}`);
      this.accountBalance = newBalance;
    }
  }

  /**
   * Get current account balance
   */
  getBalance(): number {
    return this.accountBalance;
  }

  /**
   * Update performance history from closed trades
   */
  updatePerformance(stats: PerformanceStats): void {
    this.totalTrades = stats.totalTrades;
    this.totalWins = stats.winningTrades;
    this.totalLosses = stats.losingTrades;

    if (this.totalTrades > 0) {
      // Calculate historical averages
      this.avgWinPct = this.totalWins > 0 ? stats.totalProfit / (this.totalWins * this.accountBalance) : 0.025;
      this.avgLossPct = this.totalLosses > 0 ? stats.totalLoss / (this.totalLosses * this.accountBalance) : 0.015;

      logger.debug('Position sizer updated', {
        totalTrades: this.totalTrades,
        winRate: `${(this.getWinRate() * 100).toFixed(1)}%`,
        avgWin: `${(this.avgWinPct * 100).toFixed(2)}%`,
        avgLoss: `${(this.avgLossPct * 100).toFixed(2)}%`,
      });
    }
  }

  /**
   * Calculate Kelly Criterion position size
   * Kelly % = (Win% × AvgWin% - Loss% × AvgLoss%) / AvgWin%
   */
  private calculateKellyFraction(): number {
    if (this.totalTrades === 0) {
      // No history, use conservative default
      return 0.05; // 5% risk
    }

    const winRate = this.getWinRate();
    const lossRate = 1 - winRate;

    // Kelly formula
    const kellyPct = (winRate * this.avgWinPct - lossRate * this.avgLossPct) / this.avgWinPct;

    // Clamp to valid range
    const safeFraction = Math.max(0.01, Math.min(0.10, kellyPct));
    const fractionalKelly = safeFraction * this.KELLY_FRACTION; // Use 1/4 Kelly

    logger.debug('Kelly calculation', {
      winRate: `${(winRate * 100).toFixed(1)}%`,
      kellyPct: `${(kellyPct * 100).toFixed(2)}%`,
      safeFraction: `${(safeFraction * 100).toFixed(2)}%`,
      fractionalKelly: `${(fractionalKelly * 100).toFixed(2)}%`,
    });

    return fractionalKelly;
  }

  /**
   * Get current win rate
   */
  getWinRate(): number {
    if (this.totalTrades === 0) return 0.5; // Neutral assumption
    return this.totalWins / this.totalTrades;
  }

  /**
   * Calculate dynamic position size based on:
   * - Kelly Criterion (base sizing)
   * - AI confidence (scale up/down)
   * - Account growth (compound profits)
   * - Risk of ruin (never exceed max risk)
   */
  calculateRiskPerTrade(aiConfidence: number, _stopLossPct?: number): number {
    // Base risk from Kelly
    const kellyRisk = this.calculateKellyFraction();

    // Confidence multiplier (50% AI confidence = 0.5x, 95% = 1.9x)
    const confidenceNormalized = (aiConfidence - this.MIN_AI_CONFIDENCE) /
                                  (this.MAX_AI_CONFIDENCE - this.MIN_AI_CONFIDENCE);
    const confidenceMultiplier = 0.5 + confidenceNormalized * 1.5; // Maps to 0.5x - 2.0x

    // Combined risk
    let riskPerTrade = kellyRisk * confidenceMultiplier;

    // Safety bounds
    riskPerTrade = Math.max(this.MIN_RISK_PER_TRADE, Math.min(this.MAX_RISK_PER_TRADE, riskPerTrade));

    logger.debug('Risk calculation', {
      aiConfidence,
      kellyRisk: `${(kellyRisk * 100).toFixed(2)}%`,
      confidenceMultiplier: `${confidenceMultiplier.toFixed(2)}x`,
      finalRisk: `${(riskPerTrade * 100).toFixed(2)}%`,
    });

    return riskPerTrade;
  }

  /**
   * Calculate optimal position size
   * Size = (Account Balance × Risk%) / Stop Loss %
   */
  calculatePositionSize(
    aiConfidence: number,
    currentPrice: number,
    stopLossPct: number
  ): { sizeUSD: number; sizeAsset: number; riskUSD: number } {
    const riskPerTrade = this.calculateRiskPerTrade(aiConfidence, stopLossPct);
    const riskUSD = this.accountBalance * riskPerTrade;
    const sizeUSD = riskUSD / stopLossPct; // How much to invest to risk exactly riskUSD
    const sizeAsset = sizeUSD / currentPrice;

    logger.debug('Position size', {
      balance: `$${this.accountBalance.toFixed(2)}`,
      riskUSD: `$${riskUSD.toFixed(2)}`,
      sizeUSD: `$${sizeUSD.toFixed(2)}`,
      sizeAsset: sizeAsset.toFixed(8),
      confidence: `${aiConfidence}%`,
    });

    return {
      sizeUSD,
      sizeAsset,
      riskUSD,
    };
  }

  /**
   * Check if adding position would exceed max concurrent risk
   * (useful if managing multiple positions simultaneously)
   */
  canAddPosition(openPositions: Position[], newRiskUSD: number): boolean {
    const currentOpenRisk = openPositions.reduce((sum, pos) => {
      const riskAmount = Math.abs(pos.entryPrice - pos.stopLoss) * pos.totalVolume;
      return sum + riskAmount;
    }, 0);

    const totalRisk = currentOpenRisk + newRiskUSD;
    const maxOpenRisk = this.accountBalance * 0.05; // Max 5% of account at risk

    if (totalRisk > maxOpenRisk) {
      logger.warn('Max concurrent risk exceeded', {
        currentRisk: `$${currentOpenRisk.toFixed(2)}`,
        newRisk: `$${newRiskUSD.toFixed(2)}`,
        total: `$${totalRisk.toFixed(2)}`,
        max: `$${maxOpenRisk.toFixed(2)}`,
      });
      return false;
    }

    return true;
  }

  /**
   * Get position sizing summary
   */
  getSummary(): {
    balance: number;
    winRate: number;
    totalTrades: number;
    kellyFraction: string;
  } {
    return {
      balance: this.accountBalance,
      winRate: this.getWinRate(),
      totalTrades: this.totalTrades,
      kellyFraction: `${(this.calculateKellyFraction() * 100).toFixed(2)}%`,
    };
  }
}

export default DynamicPositionSizer;
