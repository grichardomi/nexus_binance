import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';
import { Position, PerformanceStats, AIDecision, PyramidLevel, ActivityFeedEntry, PositionHealth, Config } from './utils/types';

/**
 * Position Tracker
 * Tracks open trades, calculates P&L, and persists to JSON files
 */
export class PositionTracker {
  private positions: Map<string, Position> = new Map();
  private closedPositions: Position[] = [];
  private activityFeed: ActivityFeedEntry[] = [];
  private maxActivityFeedSize: number = 100; // Keep last 100 activities
  private dataDir: string = './data';
  private profitLockGivebackPct: number = 0.5; // Max % of peak profit to give back (default 50%)
  private accountBalance: number = 1000; // For drawdown % calculation

  constructor(dataDir: string = './data', profitLockGivebackPct: number = 0.5, accountBalance: number = 1000) {
    this.dataDir = dataDir;
    this.profitLockGivebackPct = profitLockGivebackPct;
    this.accountBalance = accountBalance;
    this.ensureDataDir();
    this.loadPositions();
  }

  /**
   * Update account balance (called when balance changes)
   */
  updateAccountBalance(balance: number): void {
    this.accountBalance = balance;
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Load positions from JSON
   */
  private loadPositions(): void {
    const filePath = path.join(this.dataDir, 'positions.json');

    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.closedPositions = data.closed || [];

        // Load open positions
        const openPositionsData = data.open || [];
        for (const posData of openPositionsData) {
          this.positions.set(posData.pair, posData as Position);
        }

        logger.info(`Loaded ${this.closedPositions.length} closed positions and ${openPositionsData.length} open positions from disk`);
      }
    } catch (error) {
      logger.warn('Failed to load positions from disk', { error });
    }
  }

  /**
   * Save positions to JSON
   */
  private savePositions(): void {
    const filePath = path.join(this.dataDir, 'positions.json');

    try {
      // Convert open positions Map to array
      const openPositions = Array.from(this.positions.values());

      const data = {
        open: openPositions,
        closed: this.closedPositions,
        timestamp: Date.now(),
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Failed to save positions to disk', { error });
    }
  }

  /**
   * Log activity to feed (entries, pyramids, exits, alerts)
   */
  private logActivity(entry: ActivityFeedEntry): void {
    this.activityFeed.push(entry);
    // Keep only last 100 activities to avoid memory bloat
    if (this.activityFeed.length > this.maxActivityFeedSize) {
      this.activityFeed = this.activityFeed.slice(-this.maxActivityFeedSize);
    }
  }

  /**
   * Get recent activity feed (for dashboard)
   */
  getActivityFeed(limit: number = 20): ActivityFeedEntry[] {
    return this.activityFeed.slice(-limit).reverse();
  }

  /**
   * Add new position (with pyramid support)
   */
  addPosition(
    pair: string,
    entryPrice: number,
    volume: number,
    stopLoss: number,
    profitTarget: number,
    aiDecision: AIDecision,
    adx: number = 0,
    regime: 'choppy' | 'weak' | 'moderate' | 'strong' = 'moderate',
    erosionCap: number = 0.008
  ): void {
    if (this.positions.has(pair)) {
      logger.warn(`Position already exists for ${pair}, ignoring new entry`);
      return;
    }

    const position: Position = {
      pair,
      // L0 (initial entry)
      entryPrice,
      volume,
      entryTime: Date.now(),
      stopLoss,
      profitTarget,

      // Pyramid tracking
      pyramidLevels: [],
      totalVolume: volume,
      pyramidLevelsActivated: 0,

      // Profit tracking
      currentProfit: 0,
      profitPct: 0,
      peakProfit: 0,

      // Erosion protection
      erosionCap,
      erosionUsed: 0,

      // Entry metadata
      aiReasoning: aiDecision.reasoning,
      adx,
      regime,
      status: 'open',
    };

    this.positions.set(pair, position);

    // Persist position to disk immediately
    this.savePositions();

    // Log activity to feed
    this.logActivity({
      timestamp: Date.now(),
      pair,
      action: 'ENTRY',
      details: {
        price: entryPrice,
        volume,
      },
    });

    logger.logTradeEntry(pair, 'OPEN', {
      entryPrice,
      volume,
      stopLoss,
      profitTarget,
      aiConfidence: '?',
      adx: adx.toFixed(1),
      regime,
    });
  }

  /**
   * Get position by pair
   */
  getPosition(pair: string): Position | null {
    return this.positions.get(pair) || null;
  }

  /**
   * Get all open positions
   */
  getOpenPositions(): Position[] {
    return Array.from(this.positions.values()).filter((p) => p.status === 'open');
  }

  /**
   * Get all closed positions
   */
  getClosedPositions(): Position[] {
    return this.closedPositions;
  }

  /**
   * Update position with current price (handles pyramid levels)
   */
  updatePosition(pair: string, currentPrice: number): void {
    const position = this.positions.get(pair);
    if (!position) return;

    // Calculate profit for ALL levels (L0 + L1 + L2)
    let totalProfit = 0;
    let totalCost = 0;

    // L0 (initial entry)
    const l0Cost = position.entryPrice * position.volume;
    const l0Profit = (currentPrice - position.entryPrice) * position.volume;
    totalProfit += l0Profit;
    totalCost += l0Cost;

    // L1 + L2
    for (const level of position.pyramidLevels) {
      const levelCost = level.entryPrice * level.volume;
      const levelProfit = (currentPrice - level.entryPrice) * level.volume;
      totalProfit += levelProfit;
      totalCost += levelCost;
    }

    // Update tracking
    position.currentProfit = totalProfit;
    position.profitPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    // Track peak profit for erosion protection
    if (position.currentProfit > position.peakProfit) {
      position.peakProfit = position.currentProfit;
      position.erosionUsed = 0; // Reset erosion when new peak
    } else {
      // Calculate erosion from peak
      position.erosionUsed = position.peakProfit - position.currentProfit;
    }
  }

  /**
   * Add pyramid level (L1 or L2)
   */
  addPyramidLevel(
    pair: string,
    level: 1 | 2,
    entryPrice: number,
    volume: number,
    aiConfidence: number
  ): boolean {
    const position = this.positions.get(pair);
    if (!position) return false;

    // Check max levels
    if (position.pyramidLevelsActivated >= 2) {
      logger.warn(`${pair} already has max pyramid levels (2)`);
      return false;
    }

    // Prevent duplicates
    if (position.pyramidLevels.some((l) => l.level === level)) {
      logger.warn(`${pair} L${level} already exists`);
      return false;
    }

    // Trigger profit stored as fraction (e.g., 0.045 = 4.5%)
    const triggerPct = level === 1 ? 0.045 : 0.08;
    const pyramidLevel: PyramidLevel = {
      level,
      entryPrice,
      volume,
      entryTime: Date.now(),
      triggerProfitPct: triggerPct,
      aiConfidence,
      status: 'active',
    };

    position.pyramidLevels.push(pyramidLevel);
    position.totalVolume += volume;
    position.pyramidLevelsActivated++;

    // Persist position changes
    this.savePositions();

    // Log activity to feed
    this.logActivity({
      timestamp: Date.now(),
      pair,
      action: 'PYRAMID',
      details: {
        price: entryPrice,
        volume,
      },
    });

    logger.info(`[PYRAMID] ${pair} L${level} added at $${entryPrice.toFixed(2)} (${(volume * entryPrice).toFixed(2)} USD)`, {
      addSize: `${volume.toFixed(6)} units`,
      aiConfidence,
    });

    return true;
  }

  /**
   * Check if erosion cap exceeded (profit lock / giveback protection)
   * Closes position if you've given back too much of your peak profit
   *
   * Best practice capital preservation:
   * - givebackRatio = how much of peak profit has been given back (0 to 1+)
   * - profitLockGivebackPct = max allowed giveback (e.g., 0.5 = 50%)
   * - Example: Peak $100 profit, now $60 profit → gave back 40% → OK if threshold is 50%
   */
  checkErosionCap(pair: string): boolean {
    const position = this.positions.get(pair);
    if (!position) return false;

    // Only check if position reached meaningful profit (has peak profit to protect)
    if (position.peakProfit <= 0) return false;

    // Skip erosion cap for trivial peaks (noise on 15m crypto, not real trend moves)
    // Calculate peak as % of total cost - must be at least 1.0% to be meaningful
    const totalCost = position.entryPrice * position.volume +
      position.pyramidLevels.reduce((sum, lvl) => sum + lvl.entryPrice * lvl.volume, 0);
    const peakProfitPct = totalCost > 0 ? (position.peakProfit / totalCost) * 100 : 0;
    if (peakProfitPct < 1.0) {
      return false; // Peak is noise-level volatility — not worth protecting
    }

    // Calculate giveback as ratio of peak profit (0.0 to 1.0+)
    // e.g., peak=$100, erosion=$40 → givebackRatio = 0.4 (40% given back)
    const givebackRatio = position.erosionUsed / position.peakProfit;
    const givebackPct = givebackRatio * 100;

    // Use profitLockGivebackPct threshold (e.g., 0.5 = 50% max giveback)
    const maxGivebackPct = this.profitLockGivebackPct * 100;

    if (givebackRatio > this.profitLockGivebackPct) {
      logger.warn(`[EROSION EXIT] ${pair} gave back ${givebackPct.toFixed(1)}% of peak profit (max: ${maxGivebackPct.toFixed(0)}%)`, {
        peakProfit: `$${position.peakProfit.toFixed(2)}`,
        currentProfit: `$${position.currentProfit.toFixed(2)}`,
        erosion: `$${position.erosionUsed.toFixed(2)}`,
      });

      // Log erosion alert to feed
      this.logActivity({
        timestamp: Date.now(),
        pair,
        action: 'EROSION_ALERT',
        details: {
          erosionPct: parseFloat(givebackPct.toFixed(2)),
          peakProfit: parseFloat(position.peakProfit.toFixed(2)),
          currentProfit: parseFloat(position.currentProfit.toFixed(2)),
        },
      });

      return true;
    }

    return false;
  }

  /**
   * Check if underwater position should be closed (never went positive)
   * Prevents trades from getting stuck if they never profit
   */
  checkUnderwaterExit(pair: string, config: Config): boolean {
    const position = this.positions.get(pair);
    if (!position) return false;

    // Only applies to positions that never went positive
    if (position.peakProfit > 0) return false;

    // Must be underwater
    if (position.currentProfit >= 0) return false;

    // Check time threshold (avoid premature exits from entry slippage)
    const ageMinutes = (Date.now() - position.entryTime) / 60000;
    if (ageMinutes < config.underwaterExitMinTimeMinutes) return false;

    // Check loss threshold
    // lossPct is in percent form (e.g., -0.8 means -0.8%)
    // underwaterExitThresholdPct is in decimal form (e.g., -0.008 means -0.8%)
    // Convert threshold to percent form for correct comparison
    const lossPct = position.profitPct;
    const thresholdPct = config.underwaterExitThresholdPct * 100; // -0.008 → -0.8
    if (lossPct < thresholdPct) {
      logger.warn(`[UNDERWATER EXIT] ${pair} loss (${lossPct.toFixed(2)}%) exceeded threshold (${thresholdPct.toFixed(1)}%)`, {
        lossUSD: `$${Math.abs(position.currentProfit).toFixed(2)}`,
        ageMinutes: ageMinutes.toFixed(1),
        peakProfit: position.peakProfit,
      });

      // Log underwater alert to feed
      this.logActivity({
        timestamp: Date.now(),
        pair,
        action: 'UNDERWATER_ALERT',
        details: {
          lossPct: parseFloat(lossPct.toFixed(2)),
          ageMinutes: parseFloat(ageMinutes.toFixed(1)),
        },
      });

      return true;
    }

    return false;
  }

  /**
   * Check if a profitable trade has collapsed below breakeven
   * Protects against letting winners turn into losers
   * Only fires when peak was meaningful (>= 0.5%) and trade is now underwater
   */
  checkProfitableCollapse(pair: string): boolean {
    const position = this.positions.get(pair);
    if (!position) return false;

    // Must have been meaningfully profitable (peak >= 0.5%)
    const totalCost = position.entryPrice * position.volume +
      position.pyramidLevels.reduce((sum, lvl) => sum + lvl.entryPrice * lvl.volume, 0);
    const peakProfitPct = totalCost > 0 ? (position.peakProfit / totalCost) * 100 : 0;

    // Minimum peak threshold: 0.5% (matches nexusmeme PROFIT_COLLAPSE_MIN_PEAK_PCT)
    if (peakProfitPct < 0.5) return false;

    // Must now be underwater
    if (position.currentProfit >= 0) return false;

    logger.warn(`[PROFITABLE COLLAPSE] ${pair} was profitable (peak ${peakProfitPct.toFixed(2)}%) but breached breakeven`, {
      peakProfit: `$${position.peakProfit.toFixed(2)}`,
      currentProfit: `$${position.currentProfit.toFixed(2)}`,
      profitPct: `${position.profitPct.toFixed(2)}%`,
    });

    this.logActivity({
      timestamp: Date.now(),
      pair,
      action: 'COLLAPSE_ALERT',
      details: {
        peakProfitPct: parseFloat(peakProfitPct.toFixed(2)),
        currentProfitPct: parseFloat(position.profitPct.toFixed(2)),
      },
    });

    return true;
  }

  /**
   * Check if stop loss hit
   */
  checkStopLoss(pair: string, currentPrice: number): boolean {
    const position = this.positions.get(pair);
    if (!position) return false;

    return currentPrice <= position.stopLoss;
  }

  /**
   * Check if profit target hit
   */
  checkProfitTarget(pair: string, currentPrice: number): boolean {
    const position = this.positions.get(pair);
    if (!position) return false;

    return currentPrice >= position.profitTarget;
  }

  /**
   * Check if ready for pyramid L1 add
   */
  isReadyForL1(pair: string, currentProfit: number, l1TriggerPct: number): boolean {
    const position = this.positions.get(pair);
    if (!position) return false;

    // Already has L1
    if (position.pyramidLevelsActivated >= 1) return false;

    // Profit must reach L1 trigger
    return currentProfit >= l1TriggerPct;
  }

  /**
   * Check if ready for pyramid L2 add
   */
  isReadyForL2(pair: string, currentProfit: number, l2TriggerPct: number): boolean {
    const position = this.positions.get(pair);
    if (!position) return false;

    // Must have L1 first
    if (position.pyramidLevelsActivated < 1) return false;

    // Already has L2
    if (position.pyramidLevelsActivated >= 2) return false;

    // Profit must reach L2 trigger
    return currentProfit >= l2TriggerPct;
  }

  /**
   * Close position
   */
  closePosition(pair: string, exitPrice: number, exitReason: string): void {
    const position = this.positions.get(pair);
    if (!position) return;

    position.exitPrice = exitPrice;
    position.exitTime = Date.now();
    position.exitReason = exitReason;
    position.status = 'closed';

    const profitPct = (exitPrice - position.entryPrice) / position.entryPrice;
    position.profitPct = profitPct * 100;
    position.currentProfit = position.volume * profitPct * position.entryPrice;

    // Log trade exit
    logger.logTradeExit(pair, position.profitPct, exitReason);

    // Log activity to feed
    this.logActivity({
      timestamp: Date.now(),
      pair,
      action: 'EXIT',
      details: {
        price: exitPrice,
        profit: position.currentProfit,
        profitPct: position.profitPct,
        reason: exitReason,
      },
    });

    // Move to closed positions
    this.closedPositions.push(position);
    this.positions.delete(pair);

    // Save to disk
    this.savePositions();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    if (this.closedPositions.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalProfit: 0,
        totalLoss: 0,
        expectancy: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        maxDrawdownPct: 0,
      };
    }

    let totalProfit = 0;
    let totalLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let maxDrawdown = 0;
    let cumulativeProfit = 0;
    let peak = 0;

    for (const position of this.closedPositions) {
      const profit = position.currentProfit || 0;

      if (profit > 0) {
        totalProfit += profit;
        winningTrades++;
      } else {
        totalLoss += Math.abs(profit);
        losingTrades++;
      }

      cumulativeProfit += profit;
      if (cumulativeProfit > peak) {
        peak = cumulativeProfit;
      }

      // Cumulative P&L drawdown (how far below peak cumulative profit)
      const drawdown = peak - cumulativeProfit;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const totalTrades = this.closedPositions.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalGain = totalProfit - totalLoss;
    const expectancy = totalTrades > 0 ? totalGain / totalTrades : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    // Calculate drawdown % based on account balance (standard practice)
    const maxDrawdownPct = this.accountBalance > 0 ? (maxDrawdown / this.accountBalance) * 100 : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalProfit,
      totalLoss,
      expectancy,
      profitFactor,
      maxDrawdown,
      maxDrawdownPct,
    };
  }

  /**
   * Log performance snapshot
   */
  logPerformance(): void {
    const stats = this.getPerformanceStats();
    logger.logPerformance({
      totalTrades: stats.totalTrades,
      winRate: `${stats.winRate.toFixed(1)}%`,
      expectancy: `$${stats.expectancy.toFixed(2)}`,
      profitFactor: stats.profitFactor.toFixed(2),
      totalProfit: `$${stats.totalProfit.toFixed(2)}`,
      totalLoss: `$${stats.totalLoss.toFixed(2)}`,
      maxDrawdown: `$${stats.maxDrawdown.toFixed(2)} (${stats.maxDrawdownPct.toFixed(1)}%)`,
    });
  }

  /**
   * Export trades to CSV
   */
  exportToCSV(filePath: string = './data/trades.csv'): void {
    try {
      const rows: string[] = [
        'Pair,EntryTime,ExitTime,EntryPrice,ExitPrice,Volume,ProfitUSD,ProfitPct,ExitReason',
      ];

      for (const position of this.closedPositions) {
        const entryTime = new Date(position.entryTime).toISOString();
        const exitTime = position.exitTime ? new Date(position.exitTime).toISOString() : '';
        const profitUSD = position.currentProfit?.toFixed(2) || '0';
        const profitPct = position.profitPct?.toFixed(2) || '0';

        rows.push(
          `${position.pair},${entryTime},${exitTime},${position.entryPrice.toFixed(2)},${position.exitPrice?.toFixed(2) || ''},${position.volume.toFixed(8)},${profitUSD},${profitPct}%,${position.exitReason || ''}`
        );
      }

      fs.writeFileSync(filePath, rows.join('\n'));
      logger.info(`Exported ${this.closedPositions.length} trades to ${filePath}`);
    } catch (error) {
      logger.error('Failed to export trades to CSV', { error });
    }
  }

  /**
   * Get position health status (for dashboard monitoring)
   */
  getPositionHealth(): PositionHealth[] {
    const health: PositionHealth[] = [];
    const maxGivebackPct = this.profitLockGivebackPct * 100; // e.g., 50%

    for (const position of this.positions.values()) {
      const holdTimeMinutes = (Date.now() - position.entryTime) / 60000;

      // Calculate giveback as % of peak profit (proper relative comparison)
      const givebackPct = position.peakProfit > 0 ? (position.erosionUsed / position.peakProfit) * 100 : 0;

      // Determine health status based on giveback ratio
      let healthStatus: 'HEALTHY' | 'CAUTION' | 'RISK' | 'ALERT' = 'HEALTHY';
      let alertMessage: string | undefined;

      if (givebackPct > maxGivebackPct) {
        healthStatus = 'ALERT';
        alertMessage = `GIVEBACK EXCEEDED: ${givebackPct.toFixed(1)}% of peak (max: ${maxGivebackPct.toFixed(0)}%)`;
      } else if (givebackPct > maxGivebackPct * 0.7) {
        healthStatus = 'RISK';
        alertMessage = `High giveback: ${givebackPct.toFixed(1)}% of ${maxGivebackPct.toFixed(0)}% allowed`;
      } else if (givebackPct > maxGivebackPct * 0.3) {
        healthStatus = 'CAUTION';
        alertMessage = holdTimeMinutes > 240 ? `Long-held position (${holdTimeMinutes.toFixed(0)}min)` : undefined;
      }

      health.push({
        pair: position.pair,
        entryPrice: position.entryPrice,
        entryTime: position.entryTime,
        currentProfit: position.currentProfit,
        profitPct: position.profitPct,
        peakProfit: position.peakProfit,
        erosionUsed: position.erosionUsed,
        erosionCap: this.profitLockGivebackPct, // Now represents giveback threshold
        erosionPct: parseFloat(givebackPct.toFixed(2)),
        holdTimeMinutes: Math.round(holdTimeMinutes),
        healthStatus,
        alertMessage,
      });
    }

    return health;
  }

  /**
   * Clear all positions (careful!)
   */
  clearAll(): void {
    this.positions.clear();
    logger.warn('All positions cleared');
  }
}

export default PositionTracker;
