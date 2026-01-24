# NexusMeme Claude Skills Framework

This directory contains custom Claude Code skills designed to improve the development experience for NexusMeme.

## 📚 Available Skills

### 🎯 nexus-context
**Dynamic Context Loading** - Automatically loads relevant code context based on feature area

**Use cases**:
- Working on bot management → Auto-loads UnifiedBotManager, bot API endpoints, status components
- Working on trading strategies → Auto-loads StrategyPresets, DynamicStrategyProcessor
- Working on AI calibration → Auto-loads AICalibrator, IsotonicRegression, metrics dashboard
- Working on database → Auto-loads DatabaseConnectionManager, schema files
- Working on deployment → Auto-loads LeaderElection, Railway configs

**How it works**: Detects keywords in your messages and proactively loads the right files and context to save you time.

---

### 🎨 trading-dashboard-ux
**Trading Platform Design Patterns** - Create distinctive, production-grade trading interfaces

**Design principles**:
- Financial terminal aesthetics (Bloomberg, TradingView)
- High-contrast data presentation (green/red for wins/losses)
- Dark mode as primary theme
- Monospace fonts for tabular data
- Real-time updates without jarring re-renders

**Key patterns**:
- Bot status cards with live detection
- High-density trade tables
- Metrics dashboards with sparklines
- Multi-column responsive grids
- Orchestrated entrance animations

**Typography**:
- UI: Space Grotesk, DM Sans, General Sans
- Data: JetBrains Mono, Roboto Mono, IBM Plex Mono
- Headlines: Clash Display, Cabinet Grotesk, Sohne

**Color system**:
- Profit/Loss: Green (#10b981) / Red (#ef4444)
- Status: Blue (active), Amber (warning), Gray (inactive), Orange (conflict)
- Dark mode base: Slate palette (900/800/700)

---

### 📱 mobile-trading
**Mobile-First Trading Interfaces** - Optimize for trading on the go

**Mobile-first principles**:
- Design for 375px-428px screens first
- Minimum 44x44px touch targets (iOS HIG)
- Bottom-aligned actions (thumb-friendly)
- Expandable cards (show essentials, hide details)
- Sticky headers and bottom nav

**Key patterns**:
- Vertical bot cards with expand/collapse
- 3-column trade tables (mobile) vs 8+ columns (desktop)
- Bottom sheet modals (easier to reach)
- Sticky action buttons
- Pull-to-refresh, swipe actions, long-press

**Performance**:
- Memoize components (mobile has less CPU)
- Lazy load heavy components (charts)
- Virtual scrolling for long lists
- Optimize images with Next.js Image

**Navigation**:
- Desktop: Horizontal nav bar
- Mobile: Bottom tab bar (thumb-friendly)
- Hamburger menu for secondary nav

---

### 📊 ai-metrics-viz
**AI Metrics Visualization** - Beautiful, informative AI calibration dashboards

**Visualization principles**:
- Data > Decoration (clarity first)
- Color as data encoding (green/amber/red)
- Progressive disclosure (hero metrics → details)

**Chart library**: Recharts (React-native API, TypeScript, responsive, small bundle)

**Key components**:
- Progress indicators (0-100 outcomes)
- Win rate gauges (radial charts)
- Performance tables with sparklines
- Cost savings breakdowns (horizontal bars)
- Recent validations feed (timeline)

**Hero metrics pattern**:
- Large, scannable numbers (3xl font size)
- Contextual metadata (trends, targets, icons)
- 4-column grid (responsive: 2 mobile, 4 desktop)

**Real-time updates**:
- Auto-refresh every 30s
- Non-blocking updates (subtle indicator)
- Animated value changes (scale + fade)

**Color coding**:
- Confidence: 75%+ green, 50-75% amber, <50% red
- Performance: Compare to 65% target
- Trends: Up = green, down = red

---

## 🚀 How to Use Skills

### Automatic Activation
Claude will automatically use these skills when you mention relevant topics:

```
You: "The bot status is stuck on checking"
→ Auto-loads: nexus-context (Bot Management)
→ Applies: trading-dashboard-ux patterns

You: "Add a mobile view for the bot dashboard"
→ Auto-loads: nexus-context (Frontend/UI)
→ Applies: mobile-trading + trading-dashboard-ux patterns

You: "Make the AI metrics dashboard look better"
→ Auto-loads: nexus-context (AI Calibration + Frontend)
→ Applies: ai-metrics-viz + trading-dashboard-ux patterns
```

### Manual Invocation
Reference skills explicitly in your messages:

```
You: "Using the mobile-trading skill, optimize the trade table for phones"
You: "Apply trading-dashboard-ux patterns to create a new metrics card"
You: "Use ai-metrics-viz to add a win rate gauge component"
```

### Combining Skills
Skills work together for comprehensive solutions:

```
You: "Create a mobile-responsive AI calibration dashboard"
→ Uses: nexus-context + ai-metrics-viz + mobile-trading + trading-dashboard-ux
```

---

## 📖 Skill Reference

### Quick Links

**Context Loading**:
- [nexus-context/skill.md](skills/nexus-context/skill.md) - Feature-based context detection

**Design & UX**:
- [trading-dashboard-ux/skill.md](skills/trading-dashboard-ux/skill.md) - Trading platform aesthetics
- [mobile-trading/skill.md](skills/mobile-trading/skill.md) - Mobile-first patterns
- [ai-metrics-viz/skill.md](skills/ai-metrics-viz/skill.md) - Data visualization

### Best Practices

**When working on frontend**:
1. Start with mobile-trading (mobile-first approach)
2. Apply trading-dashboard-ux (aesthetics and patterns)
3. Use ai-metrics-viz for charts/metrics

**When working on features**:
1. Let nexus-context load relevant files
2. Reference CLAUDE.md for architectural decisions
3. Test on both mobile and desktop

**When in doubt**:
- Check the skill documentation
- Reference the cookbooks (frontend aesthetics)
- Ask Claude to apply specific patterns

---

## 🎯 Example Workflows

### Workflow 1: Add Mobile Navigation
```
You: "Add a mobile-friendly bottom navigation bar"

Claude:
1. Loads nexus-context (Frontend/UI)
2. Applies mobile-trading patterns (bottom tab bar)
3. Applies trading-dashboard-ux (color system, dark mode)
4. Implements with proper touch targets (44x44px)
5. Tests responsive breakpoints
```

### Workflow 2: Create Metrics Dashboard
```
You: "Create a dashboard for AI calibration metrics"

Claude:
1. Loads nexus-context (AI Calibration)
2. Applies ai-metrics-viz patterns:
   - Hero metrics (profit, win rate, trades)
   - Progress indicator (0-100 outcomes)
   - Win rate gauge (radial chart)
   - Performance table (sparklines)
3. Applies trading-dashboard-ux (color coding, typography)
4. Applies mobile-trading (responsive grid, expandable cards)
```

### Workflow 3: Fix Bot Status Display
```
You: "Bot status shows 'checking' forever"

Claude:
1. Loads nexus-context (Bot Management):
   - BotCardWithLiveStatus.tsx
   - BotStatusCard.tsx
   - Status detection logic
2. Identifies issue (early return preventing detection)
3. Fixes status flow
4. Applies trading-dashboard-ux (status badge patterns)
5. Tests on mobile (touch targets, visibility)
```

---

## 🔧 Customization

### Adding New Skills

Create a new skill directory:
```
.claude/skills/your-skill-name/
└── skill.md
```

Structure your skill.md:
```markdown
# Your Skill Name

**Purpose**: One-line description

**When to use**: Specific use cases

---

## Core Principles
- Principle 1
- Principle 2

## Patterns
### Pattern 1
Description and code examples

### Pattern 2
Description and code examples

## Key Takeaways
✅ Do this
❌ Don't do this
```

### Modifying Existing Skills

Skills are living documents - update them as patterns evolve:

1. Edit the relevant `skill.md` file
2. Test the updated patterns in practice
3. Document learnings and anti-patterns
4. Commit changes with clear descriptions

---

## 📚 Additional Resources

### Claude Code Documentation
- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code)
- [Skills Guide](https://docs.claude.com/en/docs/claude-code/skills)

### Frontend Design Resources
- [Frontend Aesthetics Cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb)
- [Claude Code Frontend Design Plugin](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design)

### NexusMeme Documentation
- [CLAUDE.md](../CLAUDE.md) - Comprehensive development guide
- [package.json](../package.json) - Available scripts and dependencies
- [.env.example](../.env.example) - Environment configuration

---

## 🤝 Contributing

Skills improve through use and iteration. When you discover new patterns or anti-patterns:

1. Update the relevant skill.md
2. Add examples from real NexusMeme code
3. Document what works and what doesn't
4. Share learnings in commit messages

---

## 📝 Changelog

### 2024-01-XX - Initial Framework
- Created nexus-context skill (dynamic context loading)
- Created trading-dashboard-ux skill (trading platform design)
- Created mobile-trading skill (mobile-first patterns)
- Created ai-metrics-viz skill (data visualization)
- Established skills framework structure

---

**Last Updated**: 2024-01-XX
**Maintained By**: Development Team
