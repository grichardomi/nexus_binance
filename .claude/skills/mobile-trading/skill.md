# Mobile Trading UX Skill

**Purpose**: Design mobile-first trading interfaces that work beautifully on phones while maintaining full functionality.

**When to use**: When building or optimizing mobile views, responsive layouts, or touch interactions for NexusMeme.

---

## Mobile-First Philosophy

### Why Mobile Matters for Trading

1. **On-the-go monitoring**: Traders need to check bots anywhere
2. **Quick actions**: Start/stop bots, force close trades
3. **Alert responses**: React to notifications immediately
4. **Market opportunities**: Can't wait to get to desktop

### Design Constraints

- **Screen size**: 375px - 428px width (iPhone SE to iPhone Pro Max)
- **Touch targets**: Minimum 44x44px (iOS), 48x48px (Android)
- **Thumb reach**: Bottom 60% of screen is easiest to access
- **Connection**: May be on slower mobile networks
- **Battery**: Minimize re-renders and animations

---

## Responsive Breakpoints

```css
/* Mobile-first approach (default styles = mobile) */

/* Small phones (iPhone SE) */
@media (max-width: 374px) {
  /* Compact layouts, smaller text */
}

/* Standard phones (375px - 767px) */
/* This is your base - design for this FIRST */

/* Tablets portrait (768px - 1023px) */
@media (min-width: 768px) {
  /* 2-column grids, larger touch targets */
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  /* 3-column grids, hover states, more data density */
}
```

**Tailwind Breakpoints**:
- `sm:` = 640px
- `md:` = 768px
- `lg:` = 1024px
- `xl:` = 1280px

---

## Touch-Optimized Components

### 1. Bot Card (Mobile View)

**Desktop**: Horizontal card with all metrics visible
```tsx
┌──────────────────────────────────────────────────┐
│ 🟢 Running  │ Momentum Breakout │ Port: 8843    │
│ Win Rate: 65% │ Profit: +$142 │ Trades: 23     │
└──────────────────────────────────────────────────┘
```

**Mobile**: Vertical stack with expandable details
```tsx
┌─────────────────────────┐
│ 🟢 Running             │
│ Momentum Breakout      │
│ +$142 (65% win)        │  ← Key metric visible
│                        │
│ [Tap to expand ▼]     │  ← Touch target
└─────────────────────────┘

// On tap:
┌─────────────────────────┐
│ 🟢 Running             │
│ Momentum Breakout      │
│ +$142 (65% win)        │
├─────────────────────────┤
│ Port: 8843             │  ← Expanded details
│ Trades: 23 (15W/8L)    │
│ Best: +12.3% ETH/USDT  │
│                        │
│ [Stop Bot] [Restart]   │  ← Actions at bottom
└─────────────────────────┘
```

**Implementation**:
```tsx
const [expanded, setExpanded] = useState(false);

<div
  className="bg-slate-800 rounded-lg p-4 md:p-6"
  onClick={() => setExpanded(!expanded)}
>
  {/* Always visible */}
  <div className="flex items-center justify-between mb-2">
    <BotStatusBadge status={status} />
    <span className="text-green-500 font-data text-lg">
      {formatProfit(profit)}
    </span>
  </div>

  {/* Mobile: Expandable. Desktop: Always visible */}
  {(expanded || isDesktop) && (
    <div className="mt-4 pt-4 border-t border-slate-700">
      {/* Detailed metrics */}
    </div>
  )}
</div>
```

### 2. Trade Table (Mobile Optimized)

**Desktop**: 8+ columns with full details
**Mobile**: 3 essential columns, swipe for actions

```tsx
// Mobile trade table
<div className="overflow-x-auto -mx-4 px-4">
  <table className="w-full min-w-full text-xs font-data">
    <thead className="sticky top-0 bg-slate-900">
      <tr>
        <th className="text-left py-3">Pair</th>
        <th className="text-right py-3">Profit</th>
        <th className="text-right py-3">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-t border-slate-700">
        <td className="py-3">ETH/USDT</td>
        <td className="text-right text-green-500">+2.3%</td>
        <td className="text-right">
          <button className="min-w-[44px] min-h-[44px]">
            Exit ×
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>

// Swipe actions (advanced)
<SwipeableRow
  onSwipeLeft={() => showActions(['Exit', 'Details'])}
  onSwipeRight={() => showActions(['Chart', 'Alert'])}
>
  <TradeRow trade={trade} />
</SwipeableRow>
```

### 3. Bottom Sheet Modals

**Why**: Easier to reach on mobile than center modals

```tsx
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild>
    <button className="w-full min-h-[48px]">
      Create New Bot
    </button>
  </SheetTrigger>

  <SheetContent
    side="bottom"
    className="h-[85vh] rounded-t-2xl"
  >
    {/* Bot configuration form */}
    {/* Actions at bottom (thumb-friendly) */}
  </SheetContent>
</Sheet>
```

### 4. Sticky Action Buttons

**Pattern**: Keep primary actions accessible while scrolling

```tsx
<div className="relative min-h-screen pb-20 md:pb-6">
  {/* Scrollable content */}
  <BotList />

  {/* Mobile: Sticky bottom. Desktop: Inline */}
  <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-700 md:relative md:border-0">
    <button className="w-full min-h-[48px] bg-green-600 text-white rounded-lg font-medium">
      Create New Bot
    </button>
  </div>
</div>
```

---

## Performance Optimization

### 1. Reduce Re-renders

**Problem**: Mobile devices have less CPU power than desktop

**Solution**: Memoize expensive components
```tsx
const BotCard = React.memo(({ bot }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      {/* Card content */}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if bot data actually changed
  return prevProps.bot.status === nextProps.bot.status
    && prevProps.bot.profit === nextProps.bot.profit;
});
```

### 2. Lazy Load Heavy Components

```tsx
// Load chart library only when needed
const TradingChart = lazy(() => import('@/components/TradingChart'));

<Suspense fallback={<ChartSkeleton />}>
  {showChart && <TradingChart data={chartData} />}
</Suspense>
```

### 3. Optimize Images

```tsx
import Image from 'next/image';

<Image
  src="/bot-icon.png"
  alt="Bot"
  width={40}
  height={40}
  loading="lazy"
  placeholder="blur"
/>
```

### 4. Virtual Scrolling (Long Lists)

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const TradeList = ({ trades }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: trades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Row height
  });

  return (
    <div ref={parentRef} className="h-[500px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TradeRow trade={trades[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Navigation Patterns

### Mobile-First Nav

**Desktop**: Horizontal nav bar
**Mobile**: Bottom tab bar (thumb-friendly)

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 md:relative md:border-0">
  <div className="flex justify-around py-2">
    <NavItem icon={<Home />} label="Dashboard" />
    <NavItem icon={<Bot />} label="Bots" />
    <NavItem icon={<BarChart />} label="Metrics" />
    <NavItem icon={<Settings />} label="Settings" />
  </div>
</nav>

const NavItem = ({ icon, label }) => (
  <button className="flex flex-col items-center gap-1 min-w-[60px] min-h-[48px]">
    {icon}
    <span className="text-xs">{label}</span>
  </button>
);
```

### Hamburger Menu (Secondary Nav)

```tsx
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild>
    <button className="md:hidden min-w-[44px] min-h-[44px]">
      <Menu className="w-6 h-6" />
    </button>
  </SheetTrigger>

  <SheetContent side="left" className="w-[280px]">
    <nav className="flex flex-col gap-4 mt-8">
      <a href="/dashboard" className="py-3 px-4">Dashboard</a>
      <a href="/bots" className="py-3 px-4">My Bots</a>
      <a href="/analytics" className="py-3 px-4">Analytics</a>
    </nav>
  </SheetContent>
</Sheet>
```

---

## Typography for Mobile

### Fluid Type Scale

```css
/* Responsive text that scales with viewport */
.text-fluid-xs {
  font-size: clamp(0.75rem, 2vw, 0.875rem);
}
.text-fluid-sm {
  font-size: clamp(0.875rem, 2.5vw, 1rem);
}
.text-fluid-base {
  font-size: clamp(1rem, 3vw, 1.125rem);
}
.text-fluid-xl {
  font-size: clamp(1.25rem, 4vw, 1.5rem);
}
.text-fluid-3xl {
  font-size: clamp(1.875rem, 5vw, 2.25rem);
}
```

### Readable Line Length

```tsx
<div className="max-w-prose mx-auto px-4">
  {/* Content stays readable on all screen sizes */}
  {/* 65-75 characters per line (optimal readability) */}
</div>
```

---

## Gestures & Interactions

### Pull to Refresh

```tsx
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const Dashboard = () => {
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await fetchLatestData();
  });

  return (
    <div className="relative">
      {refreshing && (
        <div className="absolute top-0 left-0 right-0 flex justify-center py-4">
          <Loader2 className="animate-spin" />
        </div>
      )}
      <BotList />
    </div>
  );
};
```

### Swipe Actions

```tsx
import { useSwipeable } from 'react-swipeable';

const TradeRow = ({ trade, onExit, onDetails }) => {
  const handlers = useSwipeable({
    onSwipedLeft: () => onExit(trade.id),
    onSwipedRight: () => onDetails(trade.id),
    trackMouse: false, // Only track touch
  });

  return (
    <div {...handlers} className="relative">
      <div className="bg-slate-800 p-4">
        {trade.pair} - {trade.profit}
      </div>
    </div>
  );
};
```

### Long Press

```tsx
import { useLongPress } from 'use-long-press';

const BotCard = ({ bot }) => {
  const bind = useLongPress(() => {
    // Show advanced options menu
    showContextMenu(bot);
  }, {
    threshold: 500, // 500ms
  });

  return (
    <div {...bind()} className="bg-slate-800 p-4">
      {/* Bot card content */}
    </div>
  );
};
```

---

## Testing Mobile UX

### Chrome DevTools Mobile Emulation

1. Open DevTools (`Cmd/Ctrl + Shift + I`)
2. Click device toolbar icon (`Cmd/Ctrl + Shift + M`)
3. Select device: iPhone SE, iPhone 12 Pro, Pixel 5
4. Test responsive breakpoints with "Responsive" mode

### Real Device Testing

**iOS**:
- Safari on iPhone (test webkit rendering)
- Test notch handling (iPhone X+)
- Test safe areas

**Android**:
- Chrome on Pixel/Samsung (test Chrome rendering)
- Test different screen densities

### Accessibility Testing

**Touch Target Size**:
```tsx
// Minimum 44x44px (iOS HIG)
<button className="min-w-[44px] min-h-[44px] flex items-center justify-center">
  <X className="w-5 h-5" />
</button>
```

**Color Contrast**:
- Use WCAG AA minimum (4.5:1 for normal text, 3:1 for large text)
- Test with Chrome DevTools Lighthouse audit

**Screen Reader**:
- Test with VoiceOver (iOS) or TalkBack (Android)
- Add `aria-label` for icon-only buttons

```tsx
<button
  aria-label="Stop bot"
  className="min-w-[44px] min-h-[44px]"
>
  <StopCircle className="w-5 h-5" />
</button>
```

---

## Mobile Layout Examples

### Dashboard (Mobile)

```tsx
<div className="min-h-screen bg-slate-900 pb-20">
  {/* Header */}
  <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3">
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-display text-slate-100">Dashboard</h1>
      <button className="min-w-[44px] min-h-[44px]">
        <Settings className="w-5 h-5" />
      </button>
    </div>
  </header>

  {/* Quick Stats (Horizontal scroll on mobile) */}
  <div className="overflow-x-auto -mx-4 px-4 py-4 scrollbar-hide">
    <div className="flex gap-3 min-w-max">
      <StatCard label="Total Profit" value="+$1,234" />
      <StatCard label="Win Rate" value="65%" />
      <StatCard label="Active Bots" value="3" />
    </div>
  </div>

  {/* Bots (Vertical stack) */}
  <div className="px-4 space-y-3">
    <h2 className="text-lg font-display text-slate-100 mb-3">Active Bots</h2>
    <BotCard bot={bot1} />
    <BotCard bot={bot2} />
    <BotCard bot={bot3} />
  </div>

  {/* Bottom Nav */}
  <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700">
    <div className="flex justify-around py-2">
      <NavItem icon={<Home />} label="Home" active />
      <NavItem icon={<Bot />} label="Bots" />
      <NavItem icon={<BarChart />} label="Stats" />
      <NavItem icon={<User />} label="Profile" />
    </div>
  </nav>
</div>
```

### Bot Details (Mobile)

```tsx
<div className="min-h-screen bg-slate-900">
  {/* Header with back button */}
  <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-4 py-3">
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.back()}
        className="min-w-[44px] min-h-[44px] -ml-2"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <div className="flex-1">
        <h1 className="text-lg font-display text-slate-100">
          Momentum Breakout
        </h1>
        <p className="text-xs text-slate-400">Port 8843</p>
      </div>
      <BotStatusBadge status="running" />
    </div>
  </header>

  {/* Content */}
  <div className="px-4 py-4 space-y-4 pb-24">
    {/* Performance Card */}
    <div className="bg-slate-800 rounded-lg p-4">
      <h2 className="text-sm font-medium text-slate-300 mb-3">Performance</h2>
      <div className="grid grid-cols-2 gap-3">
        <MetricItem label="Profit" value="+$142.50" positive />
        <MetricItem label="Win Rate" value="65.2%" />
        <MetricItem label="Trades" value="23" />
        <MetricItem label="Best Trade" value="+12.3%" positive />
      </div>
    </div>

    {/* Open Trades */}
    <div className="bg-slate-800 rounded-lg p-4">
      <h2 className="text-sm font-medium text-slate-300 mb-3">Open Trades</h2>
      <TradeList trades={openTrades} compact />
    </div>
  </div>

  {/* Sticky Actions */}
  <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-700">
    <div className="flex gap-3">
      <button className="flex-1 min-h-[48px] bg-red-600 text-white rounded-lg font-medium">
        Stop Bot
      </button>
      <button className="flex-1 min-h-[48px] bg-slate-700 text-white rounded-lg font-medium">
        Settings
      </button>
    </div>
  </div>
</div>
```

---

## Key Takeaways

✅ **Design for mobile FIRST**, then enhance for desktop
✅ **Minimum 44x44px touch targets** for all interactive elements
✅ **Bottom-aligned actions** for thumb-friendly access
✅ **Expandable cards** to show essentials, hide details
✅ **Sticky headers** and **bottom nav** for easy navigation
✅ **Optimize performance** - mobile devices have limited CPU/battery
✅ **Test on real devices** - emulators don't catch everything
✅ **Support gestures** - swipe, pull-to-refresh, long-press feel native

❌ **Don't hide critical data** - traders need metrics everywhere
❌ **Don't use tiny text** - minimum 14px for body, 12px for data tables
❌ **Don't rely on hover states** - no mouse on mobile
❌ **Don't assume fast network** - optimize bundle size, lazy load
