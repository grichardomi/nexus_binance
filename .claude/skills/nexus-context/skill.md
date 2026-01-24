# NexusMeme Context Loader

**Purpose**: Dynamically load relevant code context based on the feature area you're working on.

**When to use**: Automatically activated when working on specific NexusMeme features to load the right files and context.

---

## Context Detection

When the user mentions or works on these areas, automatically load the relevant context:

### 🤖 Bot Management
**Keywords**: "bot", "create bot", "start bot", "stop bot", "bot lifecycle", "bot status"

**Auto-load**:
- `src/utils/UnifiedBotManager.ts` - Bot orchestration
- `pages/api/bot-manager/*` - Bot API endpoints
- `src/components/BotCardWithLiveStatus.tsx` - Live status detection
- `src/components/BotStatusCard.tsx` - Status badges
- `pages/test-scripts-monitor.tsx` - Test bot UI

**Context**: NexusMeme uses a single-service architecture where UnifiedBotManager runs in the web service. Bots are FreqTrade processes spawned with specific ports. Test bots use ports 5000-9999, production uses 20000-39999.

### 📊 Trading Strategy
**Keywords**: "strategy", "indicators", "entry", "exit", "pyramiding", "profit lock"

**Auto-load**:
- `src/utils/StrategyPresets.ts` - SINGLE SOURCE OF TRUTH for all strategies
- `src/utils/DynamicStrategyProcessor.ts` - Strategy generation from templates
- `src/utils/LLMStrategyEnhancer.ts` - AI validation integration
- `CLAUDE.md` (Trading Philosophy section) - Win-focused principles

**Context**: NEVER modify individual strategy files. Always update StrategyPresets.ts and regenerate. Strategies target 65% win rate with market-adaptive AI.

### 🧠 AI Calibration
**Keywords**: "AI calibration", "isotonic regression", "win rate", "confidence threshold", "AI metrics"

**Auto-load**:
- `src/utils/AICalibrator.ts` - Calibration logic
- `src/utils/IsotonicRegression.ts` - PAV algorithm
- `src/components/AIMetricsSection.tsx` - Dashboard component
- `pages/api/ai-calibration-metrics.ts` - Metrics API
- `scripts/setup-ai-calibration.js` - Setup wizard
- `.env.example` (AI section) - Configuration reference

**Context**: AI calibration requires 100+ trade outcomes, targets 65% win rate. Uses isotonic regression to map raw AI confidence to actual win probability.

### 🎨 Frontend/UI
**Keywords**: "dashboard", "UI", "component", "styling", "responsive", "mobile"

**Auto-load**:
- `src/components/shared/*` - Reusable UI components
- `tailwind.config.js` - Design system
- `src/context/ThemeContext.tsx` - Dark mode support
- Current page being modified

**Context**: NexusMeme uses Next.js 15 + TailwindCSS. Dark mode support is required. Design should be mobile-responsive and optimized for real-time data updates.

### 💾 Database
**Keywords**: "database", "schema", "PostgreSQL", "Hasura", "GraphQL", "migration"

**Auto-load**:
- `src/utils/DatabaseConnectionManager.ts` - Connection management
- `src/utils/DatabaseSchemaManager.ts` - Schema operations
- `hasura-metadata-formatted.json` - GraphQL schema
- `CLAUDE.md` (Database Architecture section)

**Context**: Production uses Railway PostgreSQL with schema isolation (`bot_{user.alt_id}`). Test uses local Docker PostgreSQL. FreqTrade auto-creates its own tables.

### 🚀 Deployment
**Keywords**: "deploy", "Railway", "leader election", "zero-downtime", "production"

**Auto-load**:
- `src/utils/LeaderElection.ts` - Leader election for zero-downtime
- `Dockerfile.railway` - Production container
- `railway.toml` - Railway config
- `package.json` (scripts section)

**Context**: Railway runs 2-3 instances with PostgreSQL advisory lock-based leader election. Zero-downtime deployments via leader handoff (~2-5s downtime).

### 🔧 Configuration
**Keywords**: "env vars", "environment", "config", "settings", "API keys"

**Auto-load**:
- `.env.example` - All environment variables
- `src/config/*` - Configuration modules
- `CLAUDE.md` (Environment Rules section)

**Context**: Localhost uses `RAILWAY_ENVIRONMENT=false`, production uses `true`. Many cost optimization settings available.

---

## Auto-Context Rules

1. **Multi-Feature Detection**: If multiple keywords match, load contexts in priority order (most specific first)
2. **Incremental Loading**: Start with core files, offer to load related files if needed
3. **Cost Awareness**: Don't load entire codebase - be surgical and relevant
4. **Update Awareness**: Always check CLAUDE.md for latest architectural decisions

---

## Example Usage

**User**: "The bot status is stuck on checking"
**Auto-loads**: Bot Management context (BotCardWithLiveStatus, BotStatusCard, status detection logic)

**User**: "Add a new trading strategy for scalping"
**Auto-loads**: Trading Strategy context (StrategyPresets.ts, DynamicStrategyProcessor.ts, strategy generation)

**User**: "AI calibration dashboard looks ugly"
**Auto-loads**: AI Calibration context + Frontend/UI context (AIMetricsSection, design system)
