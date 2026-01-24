# Trading Dashboard UX Skill

**Purpose**: Create distinctive, production-grade trading interfaces that prioritize clarity, real-time data visibility, and mobile responsiveness.

**When to use**: When designing or improving trading dashboards, bot cards, trade tables, charts, or any trading-related UI.

---

## Core Design Principles

### 🎯 Trading-First Aesthetics

**Avoid Generic AI Defaults**:
- ❌ Purple gradients and "startup" aesthetics
- ❌ Inter, Roboto, Arial, system fonts
- ❌ Overly playful or consumer-app styling
- ❌ Slow, distracting animations

**Embrace Trading Platform Identity**:
- ✅ Financial terminal aesthetics (Bloomberg, TradingView, MetaTrader)
- ✅ High-contrast data presentation (green/red for wins/losses)
- ✅ Monospace fonts for numbers and data tables
- ✅ Dark mode as primary theme (easier on eyes during long sessions)

---

## Typography Strategy

### Font Families
**Primary (UI Text)**: `'Space Grotesk', 'DM Sans', 'General Sans'` - Modern, technical feel without being generic

**Numbers/Data**: `'JetBrains Mono', 'Roboto Mono', 'IBM Plex Mono'` - Monospace for tabular alignment

**Headlines**: `'Clash Display', 'Cabinet Grotesk', 'Sohne'` - Bold, distinctive headers

### Scale Strategy
- **Extreme contrasts**: 3x+ jumps between headline and body text
- **Example**: 48px headlines → 14px body (3.4x jump)
- **Data tables**: 12-13px for dense information, excellent readability

### Implementation
```css
:root {
  --font-ui: 'Space Grotesk', sans-serif;
  --font-data: 'JetBrains Mono', monospace;
  --font-display: 'Clash Display', sans-serif;

  --text-xs: 0.75rem;   /* 12px - table data */
  --text-sm: 0.875rem;  /* 14px - body */
  --text-base: 1rem;    /* 16px - default */
  --text-lg: 1.125rem;  /* 18px - subheadings */
  --text-2xl: 1.5rem;   /* 24px - section headers */
  --text-4xl: 2.25rem;  /* 36px - page titles */
}
```

---

## Color System

### Trading Color Semantics
**Profit/Loss (Primary Feedback)**:
- 🟢 **Green**: `#10b981` (profit), `#059669` (strong profit), `#d1fae5` (light bg)
- 🔴 **Red**: `#ef4444` (loss), `#dc2626` (strong loss), `#fee2e2` (light bg)
- ⚪ **Neutral**: `#6b7280` (break-even, no change)

**Status Colors**:
- 🟦 **Blue**: `#3b82f6` (running, active, checking)
- 🟨 **Amber**: `#f59e0b` (warning, stopping, transitioning)
- ⚫ **Gray**: `#4b5563` (stopped, inactive)
- 🟠 **Orange**: `#f97316` (conflict, error)
- 🟪 **Purple**: `#8b5cf6` (deploying, special states)

**Dark Mode Base** (Primary):
```css
:root[data-theme="dark"] {
  --bg-primary: #0f172a;      /* slate-900 */
  --bg-secondary: #1e293b;    /* slate-800 */
  --bg-tertiary: #334155;     /* slate-700 */
  --border: #475569;          /* slate-600 */
  --text-primary: #f1f5f9;    /* slate-100 */
  --text-secondary: #cbd5e1;  /* slate-300 */
  --text-muted: #94a3b8;      /* slate-400 */
}
```

**Light Mode** (Secondary):
```css
:root[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;    /* slate-50 */
  --bg-tertiary: #f1f5f9;     /* slate-100 */
  --border: #e2e8f0;          /* slate-200 */
  --text-primary: #0f172a;    /* slate-900 */
  --text-secondary: #334155;  /* slate-700 */
  --text-muted: #64748b;      /* slate-500 */
}
```

### Accent Strategy
**Dominant Color**: Dark slate backgrounds with **sharp green/red accents** for data
**Avoid**: Distributed rainbow palettes, multiple competing accent colors

---

## Layout Patterns

### Dashboard Grid
**Multi-Column Responsive**:
- Desktop (≥1280px): 3-column grid
- Tablet (768-1279px): 2-column grid
- Mobile (<768px): Single column stack

**Card-Based Architecture**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
  <BotCard />
  <MetricsCard />
  <TradesCard />
</div>
```

### Data Density
- **High-density tables**: Essential for serious traders (show max info in min space)
- **Generous padding on cards**: Balance density with breathing room
- **Sticky headers**: Keep column headers visible during scroll

---

## Motion Strategy

### High-Impact Page Load
**One well-orchestrated entrance** with staggered reveals:

```tsx
// Framer Motion example
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

<motion.div variants={container} initial="hidden" animate="show">
  <motion.div variants={item}><BotCard /></motion.div>
  <motion.div variants={item}><MetricsCard /></motion.div>
  <motion.div variants={item}><TradesCard /></motion.div>
</motion.div>
```

### Real-Time Updates
**Subtle, non-distracting**:
- Profit/loss: `pulse` animation on value change (1 cycle only)
- Status changes: `transition-all duration-300` (smooth but fast)
- New trades: Slide in from top with `slide-in-top` keyframe

**Avoid**:
- Continuous animations (distracting during analysis)
- Slow transitions (>500ms)
- Bounces, wiggles, or playful effects

---

## Component Patterns

### Bot Status Card
```tsx
interface BotStatusCardProps {
  status: 'running' | 'stopped' | 'checking' | 'error';
  name: string;
  port: number;
  winRate?: number;
  profit?: number;
}

// Design Features:
// - Large, clear status badge (icon + text)
// - Monospace font for port number
// - Green/red color-coded win rate and profit
// - Compact but scannable layout
```

### Trade Table
```tsx
// Design Features:
// - Zebra striping (subtle, bg-slate-800 vs bg-slate-900)
// - Monospace numbers for alignment
// - Right-aligned numeric columns
// - Sticky header row
// - Green/red row highlights for profit/loss
// - Compact row height (dense data)
// - Sort indicators on column headers
```

### Metrics Dashboard
```tsx
// Design Features:
// - Large hero numbers (profit, win rate, total trades)
// - Progress bars for calibration (0-100 outcomes)
// - Sparklines for trends (mini charts)
// - Color-coded confidence lanes (green/yellow/red zones)
// - Timeframe breakdowns (15m, 1h, 4h tabs)
```

---

## Mobile Optimization

### Touch-First Interactions
- **Minimum tap targets**: 44x44px (iOS guideline)
- **Card-based navigation**: Swipe-friendly layouts
- **Bottom sheet modals**: Easier to reach on mobile
- **Sticky action buttons**: Keep primary actions accessible

### Responsive Typography
```css
/* Fluid type scale */
.text-responsive-xl {
  font-size: clamp(1.5rem, 5vw, 2.25rem);
}
.text-responsive-base {
  font-size: clamp(0.875rem, 2.5vw, 1rem);
}
```

### Mobile Layout Strategy
**Desktop**: Horizontal bot cards with full metrics
**Mobile**: Vertical stack with collapsed details (expand on tap)

**Desktop Trade Table**: 8+ columns
**Mobile Trade Table**: 3-4 essential columns (pair, profit, status)

---

## Background & Atmosphere

### Trading Terminal Feel
**Subtle grid backgrounds**:
```css
.trading-grid-bg {
  background-image:
    linear-gradient(to right, rgba(51, 65, 85, 0.3) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(51, 65, 85, 0.3) 1px, transparent 1px);
  background-size: 20px 20px;
}
```

**Gradient accents** (sparingly):
```css
.hero-gradient {
  background: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.1) 0%,
    rgba(59, 130, 246, 0.1) 100%
  );
}
```

**Depth through layering**:
- Background: `#0f172a` (darkest)
- Cards: `#1e293b` (elevated)
- Hover: `#334155` (interactive)
- Borders: `#475569` (subtle separation)

---

## Implementation Workflow

### Step 1: State Design Intent
Before writing code, explicitly describe:
- Color palette (dominant + accents)
- Typography choices (3 font families max)
- Motion strategy (page load vs real-time updates)
- Mobile-first or desktop-first approach

### Step 2: Build Component Structure
Use semantic HTML + Tailwind utility classes:
```tsx
<div className="bg-slate-800 rounded-lg border border-slate-600 p-6">
  <h2 className="font-display text-2xl text-slate-100 mb-4">
    Bot Performance
  </h2>
  <div className="font-data text-sm text-slate-300">
    <div className="flex justify-between py-2">
      <span>Win Rate:</span>
      <span className="text-green-500">65.2%</span>
    </div>
  </div>
</div>
```

### Step 3: Add Interactivity
Progressive enhancement:
1. Static layout (works without JS)
2. CSS transitions (smooth visual feedback)
3. React state (real-time updates)
4. Framer Motion (orchestrated entrances)

### Step 4: Mobile Polish
Test breakpoints:
- 375px (iPhone SE)
- 768px (iPad portrait)
- 1280px (desktop)

---

## Anti-Patterns to Avoid

❌ **Overloading with animations** - Trading UIs need to be calm and focused
❌ **Hiding critical data on mobile** - Traders need key metrics everywhere
❌ **Slow loading states** - Show skeleton UI immediately, hydrate data async
❌ **Generic card layouts** - Every component should serve a specific trading function
❌ **Ignoring color blindness** - Use icons + text, not just red/green colors
❌ **Tiny touch targets** - Mobile trading requires generous tap areas

---

## Inspiration Sources

**Trading Platforms**:
- TradingView (charting, dark mode, data density)
- Bloomberg Terminal (information hierarchy, monospace data)
- Robinhood (mobile-first, clear profit/loss)
- MetaTrader (bot management, status indicators)

**Design Systems**:
- Tailwind UI (component patterns, responsive design)
- Radix UI (accessible primitives, dark mode)
- Tremor (dashboard components, charts)

**Color Palettes**:
- Nord Theme (calm, professional, dark mode)
- Dracula Theme (high contrast, readable)
- Cyberpunk (technical, futuristic without being gaudy)
