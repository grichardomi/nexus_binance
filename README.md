# Binance US + OpenAI Trading Bot

An AI-driven cryptocurrency trading bot that uses OpenAI for entry/exit decisions and Binance US API for order execution. Built with TypeScript, featuring multi-stage risk management inspired by NexusMeme's battle-tested patterns.

## Features

✅ **AI-Only Decision Making** - OpenAI analyzes market data and decides BUY/HOLD
✅ **5-Stage Risk Filtering** - Health → Drop Protection → Entry Quality → AI Validation → Cost Floor
✅ **Cost Optimization** - gpt-4o-mini ($0.15/M) with 15min caching = $0.03/day
✅ **Paper Trading Mode** - Test safely before live trading
✅ **Position Management** - Automatic stop loss and profit target monitoring
✅ **Risk Management** - Fixed 5% risk per trade with position sizing
✅ **Structured Logging** - JSON logs + console output
✅ **Performance Tracking** - Win rate, expectancy, profit factor, max drawdown

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Edit `.env` and add your API keys:

```bash
# API Keys (REQUIRED)
OPENAI_API_KEY=sk-proj-your-key
BINANCE_US_API_KEY=your-binance-us-key
BINANCE_US_API_SECRET=your-binance-us-secret

# Optional: Customize trading parameters
KRAKEN_BOT_PAPER_TRADING=true
KRAKEN_BOT_ACCOUNT_BALANCE=1000
KRAKEN_BOT_RISK_PER_TRADE_PCT=0.05
```

### 3. Run the Bot

```bash
npm run dev
```

The bot will:
1. Test API connections
2. **Start the web dashboard** (http://localhost:3001 or next available port)
3. Start the trading loop (every 60 seconds)
4. Fetch BTC/USD and ETH/USD data
5. Analyze with AI and execute trades (paper trading by default)
6. Monitor positions and log performance

### 4. View the Dashboard

Open your browser to the dashboard URL shown in the logs:

```
http://localhost:3001
```

The dashboard shows:
- ⚙️ Bot Status (uptime, mode, pairs)
- 📈 Performance Metrics (win rate, expectancy, profit factor)
- 💰 P&L Summary (profit, loss, drawdown)
- 🤖 AI Stats (calls, cache hit rate, estimated cost)
- 📍 Open Positions (real-time)
- 📝 Recent Trades (last 10 closed)
- 📋 Live Logs (auto-scrolling)

## Architecture

### Core Components

**1. BinanceClient** - Binance US API integration
- Public endpoints: klines, ticker book/24h
- Private endpoints: Account balance, market orders, order status
- Rate limiting: 100ms between requests, exponential backoff on 429
- USD and USDT support with basic pair mapping

**2. IndicatorCalculator** - Technical indicators
- RSI(14) - Overbought/oversold detection
- MACD - Momentum divergence
- ADX - Trend strength (weak <20, moderate 20-40, strong >40)
- Volume ratio - Current vs SMA(20)
- Momentum - 1h and 4h percentage change
- Recent High/Low - Last 20 candles

**3. RiskManager** - 5-stage risk filtering
- **Stage 1**: Health checks (API limits, degraded mode)
- **Stage 2**: Drop protection (BTC dump <-1.5%, volume panic >3x, spread widening >0.5%)
- **Stage 3**: Entry quality (no local tops, no extreme RSI, minimum momentum)
- **Stage 4**: AI validation (confidence ≥70%)
- **Stage 5**: Cost validation (profit ≥3× costs, RR ≥2:1)

**4. OpenAIDecisionMaker** - AI prompt engineering
- 700-token entry prompt with market context
- Regime-aware guidance (ranging/weak/moderate/strong)
- 15-minute response caching (85%+ hit rate)
- Cost tracking: ~$0.0003 per call, $0.03/day

**5. PositionTracker** - Trade management
- Position tracking (open/closed)
- Automatic stop loss/profit target monitoring
- Performance statistics (win rate, expectancy, profit factor)
- JSON persistence to `./data/positions.json`

**6. TradingBot** - Main orchestrator
- Runs trading loop every 60 seconds
- Processes BTC/USD and ETH/USD
- Integrates all components

## Configuration

All settings in `.env`:

```bash
# Trading
KRAKEN_BOT_PAIRS=BTC/USD,ETH/USD
KRAKEN_BOT_TIMEFRAME=15m
KRAKEN_BOT_CHECK_INTERVAL_MS=60000
KRAKEN_BOT_MAX_CONCURRENT_TRADES=2
KRAKEN_BOT_PAPER_TRADING=true

# Risk Management
KRAKEN_BOT_ACCOUNT_BALANCE=1000
KRAKEN_BOT_RISK_PER_TRADE_PCT=0.05
KRAKEN_BOT_STOP_LOSS_PCT=0.05
KRAKEN_BOT_PROFIT_TARGET_PCT=0.10

# Drop Protection
KRAKEN_BOT_BTC_DUMP_THRESHOLD_1H=-0.015
KRAKEN_BOT_VOLUME_SPIKE_MAX=3.0
KRAKEN_BOT_SPREAD_WIDENING_PCT=0.005

# AI
KRAKEN_BOT_AI_MODEL=gpt-4o-mini
KRAKEN_BOT_AI_MIN_CONFIDENCE=70
KRAKEN_BOT_AI_MAX_CALLS_PER_HOUR=300
KRAKEN_BOT_AI_CACHE_MINUTES=15

# Costs
KRAKEN_BOT_EXCHANGE_FEE_PCT=0.002
KRAKEN_BOT_SLIPPAGE_PCT=0.001
KRAKEN_BOT_MIN_PROFIT_MULTIPLIER=3.0
KRAKEN_BOT_MIN_RISK_REWARD_RATIO=2.0

# Logging
KRAKEN_BOT_LOG_LEVEL=info
KRAKEN_BOT_LOG_TO_FILE=true
KRAKEN_BOT_LOG_FILE_PATH=./logs/trading.log
```

## Usage

### Paper Trading (Recommended First)

```bash
# Test the bot without real money
KRAKEN_BOT_PAPER_TRADING=true npm run dev

# Run for 7+ days to validate performance
# Watch logs: tail -f logs/trading.log
```

### Live Trading

```bash
# Only after validating paper trading
KRAKEN_BOT_PAPER_TRADING=false npm run dev

# Start with small account ($100-500)
# Monitor first 24 hours closely
```

### Build for Production

```bash
npm run build
npm start
```

## Performance Targets

Based on NexusMeme patterns (65-70% win rate with similar AI system):

| Metric | Target | Good | Excellent |
|--------|--------|------|-----------|
| Win Rate | 55-60% | 60-65% | 65-70% |
| Expectancy | +1.5% | +2.0% | +3.0% |
| Profit Factor | 1.8 | 2.0 | 2.5+ |
| Max Drawdown | <15% | <10% | <8% |
| Daily Trades | 2-5 | 3-6 | 4-8 |
| AI Cost | $0.03/day | $0.05/day | $0.10/day |

## Logs

Two log types:

1. **Console** - Real-time trading decisions and alerts
2. **File** (`./logs/trading.log`) - Complete audit trail with timestamps

Example log output:

```
[2024-01-08T10:15:30.123Z] INFO   AI Decision: BTC/USD - BUY (85% confidence)
[2024-01-08T10:15:30.456Z] INFO   Trade Entry: BTC/USD - OPEN
[2024-01-08T10:15:45.789Z] DEBUG  [OPEN] BTC/USD
  entryPrice: 90000.00
  currentPrice: 90450.50
  profitPct: 0.50
  profitUSD: 50.00
  stopLoss: 87000.00
  profitTarget: 99000.00
```

## Monitoring

Check bot health:

```bash
# View recent logs
tail -50f logs/trading.log

# View position performance
cat data/positions.json | jq '.closed[-5:]'

# Export trades to CSV
npm run export-csv
```

## Troubleshooting

### Issue: API connection failed

**Solution**: Verify API keys in `.env` are correct and have proper permissions.

```bash
# Test Kraken API
curl https://api.kraken.com/0/public/Ticker?pair=XBTUSD
```

### Issue: AI confidence too low (no trades)

**Solution**: Lower the confidence threshold gradually:

```bash
KRAKEN_BOT_AI_MIN_CONFIDENCE=65  # Was 70
```

### Issue: Too many losing trades

**Solution**: Increase confidence threshold:

```bash
KRAKEN_BOT_AI_MIN_CONFIDENCE=75  # Was 70
```

### Issue: Never hits profit targets

**Solution**: Adjust profit target or stop loss:

```bash
KRAKEN_BOT_PROFIT_TARGET_PCT=0.08   # Was 0.10 (8% instead of 10%)
KRAKEN_BOT_STOP_LOSS_PCT=0.03       # Was 0.05 (3% instead of 5%)
```

## Files

```
src/
├── index.ts                   # Main bot orchestrator + trading loop
├── config.ts                  # Configuration loader
├── BinanceClient.ts           # Binance API integration
├── IndicatorCalculator.ts     # Technical indicators (RSI, MACD, ADX)
├── RiskManager.ts             # 5-stage risk filtering
├── OpenAIDecisionMaker.ts      # AI prompts + caching
├── PositionTracker.ts         # Trade tracking + P&L
└── utils/
    ├── types.ts              # TypeScript interfaces
    └── logger.ts             # Structured logging

data/                          # Trade data and positions
├── positions.json             # Open/closed trades
└── trades.csv                 # Exported trades (optional)

logs/                          # Log files
└── trading.log               # Complete audit trail

.env                          # Configuration (NEVER commit)
.env.example                  # Template
package.json
tsconfig.json
```

## Safety Features

✅ **Paper Trading** - Test without risking real money
✅ **Max Position** - Only 2 concurrent trades (1 BTC, 1 ETH)
✅ **Hard Stops** - 5% stop loss on every trade
✅ **Rate Limiting** - 100ms between API calls
✅ **Cost Validation** - Profit must be 3× costs minimum
✅ **Risk-Reward Gate** - Minimum 2:1 risk-reward ratio
✅ **Graceful Shutdown** - Ctrl+C closes positions and exits cleanly

## Cost Analysis

**Estimated Daily Costs** (paper trading):

- API calls: ~100/day × $0.0003 = **$0.03/day**
- Kraken orders: $0 (paper trading)
- **Total: ~$1/month for development/testing**

**Live Trading** (with real orders):

- AI: $0.03/day
- Kraken fees: ~0.2% per trade = variable
- **Example**: 5 trades/day × $1000 × 0.2% = $10/day

## Next Steps

1. ✅ Copy `.env.example` → `.env`, add API keys
2. ✅ Run `npm install`
3. ✅ Run `npm run dev` in paper trading mode
4. ✅ Monitor for 7+ days (validate 55%+ win rate)
5. ✅ Tune AI confidence threshold based on results
6. ✅ Switch to live trading with small capital ($100-500)
7. ✅ Monitor first 24 hours continuously
8. ✅ Scale up gradually as confidence grows

## Support

Check logs for errors:
```bash
grep ERROR logs/trading.log
```

Monitor performance:
```bash
npm run export-csv  # Export trades to CSV for analysis
```

## License

MIT

## Disclaimer

This bot is provided as-is for educational purposes. Cryptocurrency trading involves risk. Start with paper trading and small amounts. Always do your own research before putting real money at risk.
# nexusu
# nexus_binance
