import * as http from 'http';
import { PositionTracker } from './PositionTracker';
import { OpenAIDecisionMaker } from './OpenAIDecisionMaker';
import DynamicPositionSizer from './DynamicPositionSizer';
import { Config } from './utils/types';
import { logger } from './utils/logger';

/**
 * Simple HTTP server for dashboard
 * Serves HTML UI + JSON API endpoints
 */
export class DashboardServer {
  private server: http.Server | null = null;
  private port: number;
  private positionTracker: PositionTracker;
  private aiDecisionMaker: OpenAIDecisionMaker;
  private positionSizer: DynamicPositionSizer;
  private config: Config;
  private botStartTime: number = Date.now();
  private maxPortAttempts: number = 10;
  private portAttempt: number = 0;
  private botName: string;

  constructor(
    positionTracker: PositionTracker,
    aiDecisionMaker: OpenAIDecisionMaker,
    positionSizer: DynamicPositionSizer,
    config: Config,
    port: number = 3001
  ) {
    this.positionTracker = positionTracker;
    this.aiDecisionMaker = aiDecisionMaker;
    this.positionSizer = positionSizer;
    this.config = config;
    this.port = port;
    this.botName = config.botName || 'Trading Bot';
  }

  /**
   * Start dashboard server with automatic port fallback
   */
  start(): void {
    this.portAttempt = 0;
    this.attemptListen();
  }

  /**
   * Attempt to listen on current port
   */
  private attemptListen(): void {
    if (this.portAttempt >= this.maxPortAttempts) {
      logger.error('Dashboard: Failed to find available port after 10 attempts');
      return;
    }

    const currentPort = this.port + this.portAttempt;

    try {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(currentPort, '0.0.0.0', () => {
        logger.info(`✅ Dashboard ready on http://localhost:${currentPort}`);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`Port ${currentPort} in use, trying ${currentPort + 1}...`);
          this.server?.close();
          this.server = null;
          this.portAttempt++;
          setTimeout(() => this.attemptListen(), 100);
        } else {
          logger.error(`Dashboard error: ${err.message}`);
        }
      });
    } catch (error) {
      logger.error(`Dashboard failed to start: ${error}`);
    }
  }

  /**
   * Handle HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || '/';

    try {
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.getHTML());
      } else if (url === '/api/status') {
        this.respondJSON(res, this.getStatus());
      } else if (url === '/api/positions') {
        this.respondJSON(res, this.getPositions());
      } else if (url === '/api/trades') {
        this.respondJSON(res, this.getTrades());
      } else if (url === '/api/stats') {
        this.respondJSON(res, this.getStats());
      } else if (url === '/api/ai-stats') {
        this.respondJSON(res, this.getAIStats());
      } else if (url === '/api/sizer-stats') {
        this.respondJSON(res, this.getSizerStats());
      } else if (url === '/api/config') {
        this.respondJSON(res, this.getConfig());
      } else if (url === '/api/position-health') {
        this.respondJSON(res, this.getPositionHealth());
      } else if (url === '/api/activity-feed') {
        this.respondJSON(res, this.getActivityFeed());
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      logger.error(`Dashboard request error: ${error}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Send JSON response
   */
  private respondJSON(res: http.ServerResponse, data: any): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  /**
   * Get bot status
   */
  private getStatus(): any {
    const uptime = Math.floor((Date.now() - this.botStartTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    return {
      status: 'running',
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      mode: this.config.paperTrading ? 'paper_trading' : 'live_trading',
      pairs: this.config.pairs,
      botName: this.botName,
      exchange: 'Binance US',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get open positions
   */
  private getPositions(): any {
    const positions = this.positionTracker.getOpenPositions();
    return {
      count: positions.length,
      positions: positions.map((p) => ({
        pair: p.pair,
        entryPrice: p.entryPrice.toFixed(2),
        currentProfit: p.currentProfit?.toFixed(2) || '0',
        profitPct: p.profitPct?.toFixed(2) || '0',
        stopLoss: p.stopLoss.toFixed(2),
        profitTarget: p.profitTarget.toFixed(2),
        volume: p.volume.toFixed(8),
        entryTime: new Date(p.entryTime).toISOString(),
      })),
    };
  }

  /**
   * Get closed trades
   */
  private getTrades(): any {
    const trades = this.positionTracker.getClosedPositions();
    const recent = trades.slice(-10).reverse();

    return {
      total: trades.length,
      recent: recent.map((t) => ({
        pair: t.pair,
        entryPrice: t.entryPrice.toFixed(2),
        exitPrice: t.exitPrice?.toFixed(2) || 'N/A',
        profitUSD: t.currentProfit?.toFixed(2) || '0',
        profitPct: t.profitPct?.toFixed(2) || '0',
        exitReason: t.exitReason || 'N/A',
        duration: t.exitTime ? `${Math.floor((t.exitTime - t.entryTime) / 60000)}m` : 'N/A',
      })),
    };
  }

  /**
   * Get performance stats
   */
  private getStats(): any {
    const stats = this.positionTracker.getPerformanceStats();

    return {
      totalTrades: stats.totalTrades,
      winningTrades: stats.winningTrades,
      losingTrades: stats.losingTrades,
      winRate: `${stats.winRate.toFixed(1)}%`,
      totalProfit: `$${stats.totalProfit.toFixed(2)}`,
      totalLoss: `$${stats.totalLoss.toFixed(2)}`,
      expectancy: `$${stats.expectancy.toFixed(2)}`,
      profitFactor: stats.profitFactor.toFixed(2),
      maxDrawdown: `$${stats.maxDrawdown.toFixed(2)} (${stats.maxDrawdownPct.toFixed(1)}%)`,
    };
  }

  /**
   * Get AI statistics
   */
  private getAIStats(): any {
    const aiStats = this.aiDecisionMaker.getCostStats();

    return {
      totalCalls: aiStats.totalCalls,
      cacheHitRate: `${aiStats.cacheHitRate}%`,
      cacheSize: aiStats.cacheSize,
      estimatedCostUSD: `$${aiStats.estimatedCostUSD.toFixed(2)}`,
      model: 'gpt-4o-mini',
    };
  }

  /**
   * Get position sizer statistics (Kelly, balance, win rate)
   */
  private getSizerStats(): any {
    const summary = this.positionSizer.getSummary();
    const stats = this.positionTracker.getPerformanceStats();

    return {
      balance: `$${summary.balance.toFixed(2)}`,
      tradingMode: this.config.paperTrading ? 'PAPER' : 'LIVE',
      dynamicSizingEnabled: this.config.dynamicSizingEnabled,
      totalTrades: summary.totalTrades,
      winRate: `${(summary.winRate * 100).toFixed(1)}%`,
      kellyFraction: summary.kellyFraction,
      maxRiskPerTrade: `${(this.config.maxRiskPerTrade * 100).toFixed(1)}%`,
      minRiskPerTrade: `${(this.config.minRiskPerTrade * 100).toFixed(1)}%`,
      averageWinAmount: stats.totalTrades > 0 ? `$${(stats.totalProfit / Math.max(stats.winningTrades, 1)).toFixed(2)}` : 'N/A',
      averageLossAmount: stats.totalTrades > 0 ? `$${(stats.totalLoss / Math.max(stats.losingTrades, 1)).toFixed(2)}` : 'N/A',
    };
  }

  /**
   * Get position health status (erosion monitoring)
   */
  private getPositionHealth(): any {
    const health = this.positionTracker.getPositionHealth();
    return {
      count: health.length,
      positions: health.map((h) => ({
        pair: h.pair,
        entryPrice: h.entryPrice.toFixed(2),
        entryTime: h.entryTime,
        currentProfit: h.currentProfit.toFixed(2),
        profitPct: h.profitPct.toFixed(2),
        peakProfit: h.peakProfit.toFixed(2),
        erosionUsed: h.erosionUsed.toFixed(2),
        erosionCap: (h.erosionCap * 100).toFixed(2),
        erosionPct: h.erosionPct.toFixed(2),
        holdTimeMinutes: h.holdTimeMinutes,
        healthStatus: h.healthStatus,
        alertMessage: h.alertMessage || '',
      })),
    };
  }

  /**
   * Get activity feed (recent trades, pyramids, exits)
   */
  private getActivityFeed(): any {
    const feed = this.positionTracker.getActivityFeed(30);
    return {
      count: feed.length,
      activities: feed.map((a) => ({
        timestamp: new Date(a.timestamp).toISOString(),
        pair: a.pair,
        action: a.action,
        details: {
          price: a.details.price?.toFixed(2) || null,
          volume: a.details.volume?.toFixed(6) || null,
          profit: a.details.profit?.toFixed(2) || null,
          profitPct: a.details.profitPct?.toFixed(2) || null,
          reason: a.details.reason || null,
          erosionPct: a.details.erosionPct?.toFixed(2) || null,
          peakProfit: a.details.peakProfit?.toFixed(2) || null,
          currentProfit: a.details.currentProfit?.toFixed(2) || null,
        },
      })),
    };
  }

  /**
   * Get bot configuration (trading settings)
   */
  private getConfig(): any {
    return {
      tradingMode: this.config.paperTrading ? 'PAPER' : 'LIVE',
      paperTradingBalance: `$${this.config.paperTradingBalance.toFixed(2)}`,
      pairs: this.config.pairs.join(', '),
      checkIntervalMs: `${this.config.checkIntervalMs}ms`,
      stopLossPct: `${(this.config.stopLossPct * 100).toFixed(2)}%`,
      profitTargetPct: `${(this.config.profitTargetPct * 100).toFixed(2)}%`,
      dynamicSizing: {
        enabled: this.config.dynamicSizingEnabled,
        kellyFraction: `${(this.config.kellyFraction * 100).toFixed(1)}%`,
        maxRiskPerTrade: `${(this.config.maxRiskPerTrade * 100).toFixed(1)}%`,
        minRiskPerTrade: `${(this.config.minRiskPerTrade * 100).toFixed(1)}%`,
      },
      pyramiding: {
        enabled: this.config.pyramidingEnabled,
        levels: this.config.pyramidLevels,
        l1TriggerPct: `${(this.config.pyramidL1TriggerPct * 100).toFixed(2)}%`,
        l2TriggerPct: `${(this.config.pyramidL2TriggerPct * 100).toFixed(2)}%`,
        addSizePct: `${(this.config.pyramidAddSizePct * 100).toFixed(0)}%`,
        addSizePctL1: `${(this.config.pyramidAddSizePctL1 * 100).toFixed(0)}%`,
        addSizePctL2: `${(this.config.pyramidAddSizePctL2 * 100).toFixed(0)}%`,
        l1ConfidenceMin: `${this.config.pyramidL1ConfidenceMin}%`,
        l2ConfidenceMin: `${this.config.pyramidL2ConfidenceMin}%`,
      },
      chopAvoidance: {
        minADXForEntry: this.config.minADXForEntry,
        adxChoppyThreshold: this.config.adxChoppyThreshold,
        adxStrongThreshold: this.config.adxStrongThreshold,
      },
      aiValidation: {
        model: this.config.aiModel,
        minConfidence: `${this.config.aiMinConfidence}%`,
        maxCallsPerHour: this.config.aiMaxCallsPerHour,
        cacheMinutes: this.config.aiCacheMinutes,
      },
    };
  }

  /**
   * Get HTML dashboard
   */
  private getHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.botName} Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 28px; margin-bottom: 30px; display: flex; align-items: center; gap: 10px; }
    .status-badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; }
    .card h2 { font-size: 14px; text-transform: uppercase; color: #94a3b8; margin-bottom: 15px; letter-spacing: 0.5px; }
    .stat { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .stat-label { color: #94a3b8; font-size: 13px; }
    .stat-value { font-size: 18px; font-weight: 600; color: #f1f5f9; }
    .stat-green { color: #10b981; }
    .stat-red { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #0f172a; padding: 12px; text-align: left; color: #94a3b8; font-weight: 600; border-bottom: 1px solid #334155; }
    td { padding: 12px; border-bottom: 1px solid #334155; }
    tr:hover { background: rgba(100, 116, 139, 0.1); }
    .error { color: #ef4444; }
    .success { color: #10b981; }
    .loading { color: #94a3b8; }
    .refresh-info { color: #94a3b8; font-size: 12px; margin-top: 15px; }
    .json-viewer { background: #0f172a; border: 1px solid #334155; border-radius: 4px; padding: 12px; margin-top: 10px; font-family: monospace; font-size: 11px; color: #10b981; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; }
    .json-toggle { display: inline-block; background: #334155; color: #e2e8f0; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 10px; }
    .json-toggle:hover { background: #475569; }
    .hidden { display: none; }
    .health-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .health-healthy { background: #10b981; color: white; }
    .health-caution { background: #f59e0b; color: white; }
    .health-risk { background: #ef4444; color: white; }
    .health-alert { background: #8b5cf6; color: white; }
    .erosion-bar {
      display: inline-block;
      height: 6px;
      border-radius: 3px;
      background: #334155;
      overflow: hidden;
      width: 100px;
      margin: 0 5px;
      vertical-align: middle;
    }
    .erosion-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #f59e0b 70%, #ef4444 100%);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 ${this.botName} <span class="status-badge" id="status">LOADING</span></h1>

    <div class="grid">
      <div class="card">
        <h2>Bot Status</h2>
        <div class="stat">
          <span class="stat-label">Exchange</span>
          <span class="stat-value" id="exchange">Binance US</span>
        </div>
        <div class="stat">
          <span class="stat-label">Mode</span>
          <span class="stat-value" id="mode">📄 PAPER</span>
        </div>
        <div class="stat">
          <span class="stat-label">Uptime</span>
          <span class="stat-value" id="uptime">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Pairs</span>
          <span class="stat-value" id="pairs">BTC, ETH</span>
        </div>
      </div>

      <div class="card">
        <h2>Performance</h2>
        <div class="stat">
          <span class="stat-label">Win Rate</span>
          <span class="stat-value" id="winRate">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Expectancy</span>
          <span class="stat-value stat-green" id="expectancy">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Profit Factor</span>
          <span class="stat-value" id="profitFactor">--</span>
        </div>
      </div>

      <div class="card">
        <h2>P&L Summary</h2>
        <div class="stat">
          <span class="stat-label">Total Profit</span>
          <span class="stat-value stat-green" id="totalProfit">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Total Loss</span>
          <span class="stat-value stat-red" id="totalLoss">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Max Drawdown</span>
          <span class="stat-value stat-red" id="maxDrawdown">--</span>
        </div>
      </div>

      <div class="card">
        <h2>AI Statistics</h2>
        <div class="stat">
          <span class="stat-label">API Calls</span>
          <span class="stat-value" id="aiCalls">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Cache Hit Rate</span>
          <span class="stat-value" id="cacheHitRate">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Est. Cost</span>
          <span class="stat-value" id="estimatedCost">--</span>
        </div>
      </div>

      <div class="card">
        <h2>Position Sizer</h2>
        <div class="stat">
          <span class="stat-label">Balance</span>
          <span class="stat-value" id="sizerBalance">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Kelly Fraction</span>
          <span class="stat-value" id="kellyFraction">--</span>
        </div>
        <div class="stat">
          <span class="stat-label">Dynamic Sizing</span>
          <span class="stat-value" id="dynamicSizing">--</span>
        </div>
        <div class="json-toggle" onclick="toggleJSON('sizer')">📋 View Raw JSON</div>
        <div class="json-viewer hidden" id="sizerJSON"></div>
      </div>

      <div class="card">
        <h2>Open Positions</h2>
        <div class="stat">
          <span class="stat-label">Active Trades</span>
          <span class="stat-value" id="openCount">0</span>
        </div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 20px;" id="positionDetails">No open positions</div>
      </div>
    </div>

    <div class="card">
      <h2>📋 Configuration</h2>
      <div style="font-size: 13px; color: #e2e8f0; line-height: 2;">
        <strong>Trading Settings:</strong><br>
        Mode: <span id="configMode">--</span> | Pairs: <span id="configPairs">--</span><br><br>
        <strong>Dynamic Position Sizing:</strong><br>
        Enabled: <span id="configDynamic">--</span> | Kelly: <span id="configKelly">--</span> | Max Risk: <span id="configMaxRisk">--</span><br><br>
        <strong>Pyramiding:</strong><br>
        Enabled: <span id="configPyramidEnabled">--</span> | L1: <span id="configL1">--</span> | L2: <span id="configL2">--</span><br>
        Add Sizes: L1 <span id="configAddL1">--</span> | L2 <span id="configAddL2">--</span><br><br>
        <strong>Chop Avoidance:</strong><br>
        Min ADX: <span id="configMinADX">--</span> | Strong ADX: <span id="configStrongADX">--</span><br><br>
        <strong>AI Validation:</strong><br>
        Model: <span id="configModel">--</span> | Min Confidence: <span id="configConfidence">--</span>
      </div>
      <div class="json-toggle" onclick="toggleJSON('config')">📋 View Raw JSON</div>
      <div class="json-viewer hidden" id="configJSON"></div>
    </div>

    <div class="card">
      <h2>📊 Position Health Monitor</h2>
      <table id="healthTable">
        <thead>
          <tr>
            <th>Pair</th>
            <th>Entry Time</th>
            <th>Entry Price</th>
            <th>Current P&L</th>
            <th>Peak P&L</th>
            <th>Erosion</th>
            <th>Hold Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="healthBody">
          <tr><td colspan="8" class="loading">No open positions</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>📈 Activity Feed (Recent 30)</h2>
      <table id="feedTable">
        <thead>
          <tr>
            <th>Time</th>
            <th>Pair</th>
            <th>Action</th>
            <th>Price</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody id="feedBody">
          <tr><td colspan="5" class="loading">Loading activities...</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Recent Trades (Last 10)</h2>
      <table id="tradesTable">
        <thead>
          <tr>
            <th>Pair</th>
            <th>Entry</th>
            <th>Exit</th>
            <th>P&L</th>
            <th>%</th>
            <th>Duration</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody id="tradesBody">
          <tr><td colspan="7" class="loading">Loading trades...</td></tr>
        </tbody>
      </table>
    </div>

    <div class="refresh-info">🔄 Updates every 5 seconds</div>
  </div>

  <script>
    let lastSizerStats = {};
    let lastConfig = {};

    function toggleJSON(type) {
      const element = document.getElementById(type + 'JSON');
      element.classList.toggle('hidden');
    }

    async function updateDashboard() {
      try {
        const [status, positions, trades, stats, aiStats, sizerStats, config, positionHealth, activityFeed] = await Promise.all([
          fetch('/api/status').then(r => r.json()),
          fetch('/api/positions').then(r => r.json()),
          fetch('/api/trades').then(r => r.json()),
          fetch('/api/stats').then(r => r.json()),
          fetch('/api/ai-stats').then(r => r.json()),
          fetch('/api/sizer-stats').then(r => r.json()),
          fetch('/api/config').then(r => r.json()),
          fetch('/api/position-health').then(r => r.json()),
          fetch('/api/activity-feed').then(r => r.json()),
        ]);

        // Store for JSON viewer
        lastSizerStats = sizerStats;
        lastConfig = config;

        // Status
        document.getElementById('status').textContent = '✅ RUNNING';
        document.getElementById('status').style.background = '#10b981';
        document.getElementById('exchange').textContent = status.exchange || 'Binance US';
        document.getElementById('uptime').textContent = status.uptime;
        const isLive = status.mode === 'live_trading' || config.tradingMode === 'LIVE';
        document.getElementById('mode').textContent = isLive ? '🔴 LIVE' : '📄 PAPER';
        document.getElementById('pairs').textContent = Array.isArray(status.pairs) ? status.pairs.join(', ') : status.pairs;

        // Performance
        document.getElementById('winRate').textContent = stats.winRate;
        document.getElementById('expectancy').textContent = stats.expectancy;
        document.getElementById('profitFactor').textContent = stats.profitFactor;

        // P&L
        document.getElementById('totalProfit').textContent = stats.totalProfit;
        document.getElementById('totalLoss').textContent = stats.totalLoss;
        document.getElementById('maxDrawdown').textContent = stats.maxDrawdown;

        // AI
        document.getElementById('aiCalls').textContent = aiStats.totalCalls;
        document.getElementById('cacheHitRate').textContent = aiStats.cacheHitRate;
        document.getElementById('estimatedCost').textContent = aiStats.estimatedCostUSD;

        // Position Sizer
        document.getElementById('sizerBalance').textContent = sizerStats.balance;
        document.getElementById('kellyFraction').textContent = sizerStats.kellyFraction;
        document.getElementById('dynamicSizing').textContent = sizerStats.dynamicSizingEnabled ? '✅ ON' : '❌ OFF';
        document.getElementById('sizerJSON').textContent = JSON.stringify(sizerStats, null, 2);

        // Configuration
        document.getElementById('configMode').textContent = config.tradingMode;
        document.getElementById('configPairs').textContent = config.pairs;
        document.getElementById('configDynamic').textContent = config.dynamicSizing.enabled ? '✅' : '❌';
        document.getElementById('configKelly').textContent = config.dynamicSizing.kellyFraction;
        document.getElementById('configMaxRisk').textContent = config.dynamicSizing.maxRiskPerTrade;
        document.getElementById('configPyramidEnabled').textContent = config.pyramiding.enabled ? '✅' : '❌';
        document.getElementById('configL1').textContent = config.pyramiding.l1TriggerPct + ' (min conf: ' + config.pyramiding.l1ConfidenceMin + ')';
        document.getElementById('configL2').textContent = config.pyramiding.l2TriggerPct + ' (min conf: ' + config.pyramiding.l2ConfidenceMin + ')';
        document.getElementById('configAddL1').textContent = config.pyramiding.addSizePctL1;
        document.getElementById('configAddL2').textContent = config.pyramiding.addSizePctL2;
        document.getElementById('configMinADX').textContent = config.chopAvoidance.minADXForEntry;
        document.getElementById('configStrongADX').textContent = config.chopAvoidance.adxStrongThreshold;
        document.getElementById('configModel').textContent = config.aiValidation.model;
        document.getElementById('configConfidence').textContent = config.aiValidation.minConfidence;
        document.getElementById('configJSON').textContent = JSON.stringify(config, null, 2);

        // Positions
        document.getElementById('openCount').textContent = positions.count;
        if (positions.count > 0) {
          let posHTML = '';
          for (const p of positions.positions) {
            posHTML += p.pair + ': $' + p.entryPrice + ' (P&L: ' + p.profitPct + '%)' + '<br>';
          }
          document.getElementById('positionDetails').innerHTML = posHTML;
        }

        // Position Health table
        const healthBody = document.getElementById('healthBody');
        if (positionHealth.positions && positionHealth.positions.length > 0) {
          let healthHTML = '';
          for (const h of positionHealth.positions) {
            const erosionPct = parseFloat(h.erosionPct);
            const capPct = parseFloat(h.erosionCap);
            const erosionRatio = Math.min(100, (erosionPct / capPct) * 100);
            const statusClass = 'health-' + h.healthStatus.toLowerCase();
            const entryDate = new Date(h.entryTime);
            const entryTimeStr = entryDate.toLocaleDateString() + ' ' + entryDate.toLocaleTimeString();
            healthHTML += '<tr>' +
              '<td><strong>' + h.pair + '</strong></td>' +
              '<td><small>' + entryTimeStr + '</small></td>' +
              '<td>$' + h.entryPrice + '</td>' +
              '<td class="' + (parseFloat(h.currentProfit) >= 0 ? 'success' : 'error') + '">$' + h.currentProfit + '</td>' +
              '<td>$' + h.peakProfit + '</td>' +
              '<td>' +
                '<div class="erosion-bar" title="' + erosionPct.toFixed(1) + '% / ' + capPct.toFixed(1) + '%">' +
                  '<div class="erosion-fill" style="width: ' + erosionRatio + '%"></div>' +
                '</div>' +
                '<small>' + erosionPct.toFixed(1) + '%</small>' +
              '</td>' +
              '<td>' + h.holdTimeMinutes + 'm</td>' +
              '<td><span class="health-badge ' + statusClass + '">' + h.healthStatus + '</span></td>' +
            '</tr>';
          }
          healthBody.innerHTML = healthHTML;
        } else {
          healthBody.innerHTML = '<tr><td colspan="8" class="loading">No open positions</td></tr>';
        }

        // Activity Feed table
        const feedBody = document.getElementById('feedBody');
        if (activityFeed.activities && activityFeed.activities.length > 0) {
          let feedHTML = '';
          for (const a of activityFeed.activities) {
            const timeStr = new Date(a.timestamp).toLocaleTimeString();
            let detailsStr = '';
            if (a.action === 'ENTRY' || a.action === 'PYRAMID') {
              detailsStr = 'Price: $' + a.details.price + ' | Vol: ' + a.details.volume;
            } else if (a.action === 'EXIT') {
              detailsStr = 'P&L: ' + a.details.profit + ' (' + a.details.profitPct + '%) | Reason: ' + a.details.reason;
            } else if (a.action === 'EROSION_ALERT') {
              detailsStr = 'Gave back ' + a.details.erosionPct + '% of peak profit';
              if (a.details.peakProfit) {
                detailsStr += ' (peak: $' + a.details.peakProfit + ')';
              }
            }
            const actionClass = a.action === 'EXIT' ? 'success' : (a.action === 'EROSION_ALERT' ? 'error' : '');
            const priceDisplay = a.action === 'EROSION_ALERT' || a.action === 'UNDERWATER_ALERT' ? '-' : a.details.price;
            feedHTML += '<tr>' +
              '<td>' + timeStr + '</td>' +
              '<td><strong>' + a.pair + '</strong></td>' +
              '<td>' + a.action + '</td>' +
              '<td>' + priceDisplay + '</td>' +
              '<td class="' + actionClass + '"><small>' + detailsStr + '</small></td>' +
            '</tr>';
          }
          feedBody.innerHTML = feedHTML;
        } else {
          feedBody.innerHTML = '<tr><td colspan="5" class="loading">No activities yet</td></tr>';
        }

        // Trades table
        const tbody = document.getElementById('tradesBody');
        if (trades.recent && trades.recent.length > 0) {
          let tradeHTML = '';
          for (const t of trades.recent) {
            const profitClass = parseFloat(t.profitUSD) >= 0 ? 'success' : 'error';
            const percentClass = parseFloat(t.profitPct) >= 0 ? 'success' : 'error';
            tradeHTML += '<tr>' +
              '<td>' + t.pair + '</td>' +
              '<td>$' + t.entryPrice + '</td>' +
              '<td>$' + t.exitPrice + '</td>' +
              '<td class="' + profitClass + '">' + t.profitUSD + '</td>' +
              '<td class="' + percentClass + '">' + t.profitPct + '%</td>' +
              '<td>' + t.duration + '</td>' +
              '<td>' + t.exitReason + '</td>' +
            '</tr>';
          }
          tbody.innerHTML = tradeHTML;
        } else {
          tbody.innerHTML = '<tr><td colspan="7" class="loading">No closed trades yet</td></tr>';
        }
      } catch (error) {
        console.error('Dashboard error:', error);
        document.getElementById('status').textContent = '❌ ERROR';
        document.getElementById('status').style.background = '#ef4444';
      }
    }

    // Initial load
    updateDashboard();

    // Refresh every 5 seconds
    setInterval(updateDashboard, 5000);
  </script>
</body>
</html>`;
  }

  /**
   * Stop the dashboard server
   */
  stop(): void {
    if (this.server) {
      this.server.close(() => {
        logger.info('Dashboard server stopped');
      });
      this.server = null;
    }
  }
}

export default DashboardServer;
