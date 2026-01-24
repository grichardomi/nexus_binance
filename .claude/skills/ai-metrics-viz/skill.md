# AI Metrics Visualization Skill

**Purpose**: Create beautiful, informative visualizations for AI calibration metrics, win rates, and performance tracking.

**When to use**: When building dashboards for AI performance, calibration progress, or any data visualization related to trading metrics.

---

## Core Visualization Principles

### 1. Data > Decoration
- **Clarity first**: Every visual element should communicate data
- **Minimize chartjunk**: No 3D effects, gradients on bars, or decorative elements
- **Information density**: Show as much useful data as possible without overwhelming

### 2. Color as Data Encoding
- **Green/Red**: Performance (profit/loss, above/below target)
- **Blue**: Neutral information (totals, counts)
- **Amber**: Warnings (approaching thresholds)
- **Gray**: Inactive or baseline data

### 3. Progressive Disclosure
- **Hero metrics**: Large, prominent numbers for key stats
- **Details on demand**: Drill down for more information
- **Contextual comparisons**: Always show targets, benchmarks, or historical data

---

## Chart Library Recommendations

### For NexusMeme: **Recharts**

**Why Recharts**:
- ✅ React-native API (declarative, composable)
- ✅ TypeScript support
- ✅ Responsive by default
- ✅ Small bundle size (~40KB gzipped)
- ✅ Dark mode friendly

**Installation**:
```bash
pnpm add recharts
```

**Alternative**: Tremor (built on Recharts, opinionated dashboard components)
```bash
pnpm add @tremor/react
```

---

## AI Calibration Dashboard Components

### 1. Progress Indicator (0-100 Outcomes)

**Visual Design**:
```tsx
import { Progress } from '@/components/ui/progress';

<div className="bg-slate-800 rounded-lg p-6">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-sm font-medium text-slate-300">
      Calibration Progress
    </h3>
    <span className="text-2xl font-data text-slate-100">
      {totalOutcomes}/100
    </span>
  </div>

  <Progress
    value={(totalOutcomes / 100) * 100}
    className="h-3"
    indicatorClassName={
      totalOutcomes >= 100 ? 'bg-green-500' : 'bg-blue-500'
    }
  />

  <p className="text-xs text-slate-400 mt-2">
    {totalOutcomes >= 100
      ? '✅ Ready for calibrated thresholds'
      : `${100 - totalOutcomes} trades until calibration ready`}
  </p>
</div>
```

**Key Features**:
- Large, readable count (font-data for monospace alignment)
- Color-coded progress bar (blue = in progress, green = ready)
- Clear call-to-action message

### 2. Win Rate vs Target Gauge

**Visual Design**:
```tsx
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

const WinRateGauge = ({ actual, target = 65 }) => {
  const data = [
    {
      name: 'Win Rate',
      value: actual,
      fill: actual >= target ? '#10b981' : actual >= target - 5 ? '#f59e0b' : '#ef4444'
    }
  ];

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-sm font-medium text-slate-300 mb-4">
        Win Rate
      </h3>

      <div className="relative w-full h-48">
        <RadialBarChart
          width={200}
          height={200}
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="100%"
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background
            dataKey="value"
            cornerRadius={10}
          />
        </RadialBarChart>

        {/* Center text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-data text-slate-100">
            {actual.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Target: {target}%
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs">
        <span className={actual >= target ? 'text-green-500' : 'text-amber-500'}>
          {actual >= target
            ? `+${(actual - target).toFixed(1)}% above target`
            : `${(target - actual).toFixed(1)}% below target`}
        </span>
      </div>
    </div>
  );
};
```

**Key Features**:
- Radial gauge (easier to read than linear progress)
- Color-coded by performance (green = on target, amber = close, red = below)
- Large center number (actual win rate)
- Context (target comparison)

### 3. Performance by Timeframe (Table + Sparklines)

**Visual Design**:
```tsx
import { Sparklines, SparklinesLine } from 'react-sparklines';

const PerformanceByTimeframe = ({ data }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-sm font-medium text-slate-300 mb-4">
        Performance by Timeframe
      </h3>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2 text-slate-400 font-medium">
              Timeframe
            </th>
            <th className="text-right py-2 text-slate-400 font-medium">
              Trades
            </th>
            <th className="text-right py-2 text-slate-400 font-medium">
              Win Rate
            </th>
            <th className="text-right py-2 text-slate-400 font-medium">
              Trend
            </th>
          </tr>
        </thead>
        <tbody className="font-data">
          {data.map((tf) => (
            <tr key={tf.timeframe} className="border-b border-slate-700/50">
              <td className="py-3 text-slate-100">
                {tf.timeframe}
              </td>
              <td className="text-right text-slate-300">
                {tf.total}
              </td>
              <td className={`text-right ${
                tf.winRate >= 65 ? 'text-green-500' :
                tf.winRate >= 60 ? 'text-amber-500' :
                'text-red-500'
              }`}>
                {tf.winRate.toFixed(1)}%
              </td>
              <td className="text-right">
                <Sparklines
                  data={tf.winRateHistory}
                  width={60}
                  height={24}
                  margin={0}
                >
                  <SparklinesLine
                    color={tf.winRate >= 65 ? '#10b981' : '#ef4444'}
                    style={{ strokeWidth: 2, fill: 'none' }}
                  />
                </Sparklines>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

**Key Features**:
- Compact table format (data density)
- Color-coded win rates (visual scanning)
- Sparklines for trend visualization (context)
- Monospace font for number alignment

### 4. Cost Savings Breakdown

**Visual Design**:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const CostSavingsChart = ({ savings }) => {
  const data = [
    {
      name: 'Caching',
      savings: savings.caching,
      percentage: ((savings.caching / savings.total) * 100).toFixed(0)
    },
    {
      name: 'Gating',
      savings: savings.gating,
      percentage: ((savings.gating / savings.total) * 100).toFixed(0)
    },
    {
      name: 'Calibration',
      savings: savings.calibration,
      percentage: ((savings.calibration / savings.total) * 100).toFixed(0)
    },
  ];

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-300">
          Cost Savings Breakdown
        </h3>
        <span className="text-2xl font-data text-green-500">
          {savings.totalPercentage}%
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#cbd5e1"
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '0.5rem',
            }}
          />
          <Bar
            dataKey="savings"
            fill="#10b981"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
        {data.map((item) => (
          <div key={item.name} className="text-center">
            <div className="text-green-500 font-data text-lg">
              {item.percentage}%
            </div>
            <div className="text-slate-400 mt-1">
              {item.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Key Features**:
- Horizontal bar chart (easier to read categories)
- Total savings prominently displayed
- Breakdown grid below for details
- Green accent (savings = positive)

### 5. Recent Validations Feed

**Visual Design**:
```tsx
const RecentValidations = ({ validations }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-sm font-medium text-slate-300 mb-4">
        Recent AI Validations
      </h3>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {validations.map((v) => (
          <div
            key={v.id}
            className="bg-slate-700/50 rounded-lg p-3 border-l-4"
            style={{
              borderColor: v.confidence >= 75 ? '#10b981' :
                           v.confidence >= 50 ? '#f59e0b' :
                           '#ef4444'
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-100">
                    {v.pair}
                  </span>
                  <span className="text-xs text-slate-400">
                    {v.timeframe}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2">
                  {v.reasoning}
                </p>
              </div>

              <div className="text-right">
                <div className="text-lg font-data text-slate-100">
                  {v.confidence}%
                </div>
                <div className="text-xs text-slate-400">
                  {formatTimeAgo(v.timestamp)}
                </div>
              </div>
            </div>

            {v.outcome && (
              <div className={`mt-2 pt-2 border-t border-slate-600 text-xs ${
                v.outcome === 'win' ? 'text-green-500' : 'text-red-500'
              }`}>
                Outcome: {v.outcome === 'win' ? '✓ Win' : '✗ Loss'} ({v.profitPct > 0 ? '+' : ''}{v.profitPct}%)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Key Features**:
- Timeline/feed layout (chronological context)
- Color-coded confidence (left border accent)
- Truncated reasoning (line-clamp for space)
- Outcome display if available (learning from results)

---

## Hero Metrics Pattern

**Large, Scannable Numbers**:

```tsx
const HeroMetrics = ({ profit, winRate, totalTrades, activeBots }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <MetricCard
        label="Total Profit"
        value={formatCurrency(profit)}
        trend={profit > 0 ? 'up' : 'down'}
        trendValue="+12.3%"
      />
      <MetricCard
        label="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        target="65%"
        isOnTarget={winRate >= 65}
      />
      <MetricCard
        label="Total Trades"
        value={totalTrades}
        icon={<TrendingUp />}
      />
      <MetricCard
        label="Active Bots"
        value={activeBots}
        icon={<Bot />}
      />
    </div>
  );
};

const MetricCard = ({ label, value, trend, trendValue, target, isOnTarget, icon }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">
          {label}
        </span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>

      <div className="text-3xl font-data text-slate-100 mb-1">
        {value}
      </div>

      {target && (
        <div className={`text-xs ${isOnTarget ? 'text-green-500' : 'text-amber-500'}`}>
          Target: {target}
        </div>
      )}

      {trend && (
        <div className={`flex items-center gap-1 text-xs ${
          trend === 'up' ? 'text-green-500' : 'text-red-500'
        }`}>
          {trend === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {trendValue}
        </div>
      )}
    </div>
  );
};
```

**Key Features**:
- 4-column grid (responsive: 2 cols mobile, 4 desktop)
- Large numbers (3xl size for scannability)
- Contextual metadata (trends, targets, icons)
- Consistent card layout

---

## Real-Time Updates Pattern

**Auto-Refresh Without Jarring Re-renders**:

```tsx
const AIMetricsSection = () => {
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchMetrics = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/ai-calibration-metrics');
      const data = await res.json();
      setMetrics(data);
    } finally {
      setIsUpdating(false);
    }
  };

  // Auto-refresh every 30s
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display text-slate-100">
          AI Calibration Metrics
        </h2>

        {/* Subtle update indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {isUpdating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              Updated {formatTimeAgo(metrics?.lastUpdated)}
            </>
          )}
        </div>
      </div>

      {/* Metrics components */}
    </div>
  );
};
```

**Key Features**:
- Polling interval (30s for cost optimization)
- Non-blocking updates (subtle indicator, no loading spinners)
- Last updated timestamp (user knows data is fresh)

---

## Animation Strategy

**Entrance Animations** (Page Load):

```tsx
import { motion } from 'framer-motion';

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

<motion.div
  variants={container}
  initial="hidden"
  animate="show"
  className="space-y-6"
>
  <motion.div variants={item}>
    <HeroMetrics />
  </motion.div>
  <motion.div variants={item}>
    <WinRateGauge />
  </motion.div>
  <motion.div variants={item}>
    <PerformanceTable />
  </motion.div>
</motion.div>
```

**Value Change Animations** (Data Updates):

```tsx
import { AnimatePresence, motion } from 'framer-motion';

const AnimatedNumber = ({ value }) => {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={value}
        initial={{ opacity: 0, scale: 1.2 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
        className="font-data text-3xl"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
};
```

**Progress Animations**:

```tsx
<motion.div
  className="bg-green-500 h-full rounded-full"
  initial={{ width: 0 }}
  animate={{ width: `${progress}%` }}
  transition={{ duration: 0.8, ease: 'easeOut' }}
/>
```

---

## Color Coding Strategy

### Confidence Levels

```tsx
const getConfidenceColor = (confidence: number) => {
  if (confidence >= 75) return 'text-green-500 bg-green-500/10 border-green-500/20';
  if (confidence >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  return 'text-red-500 bg-red-500/10 border-red-500/20';
};

<div className={`px-3 py-1 rounded-full border ${getConfidenceColor(75)}`}>
  High Confidence
</div>
```

### Performance Tiers

```tsx
const getPerformanceColor = (winRate: number, target: number = 65) => {
  const diff = winRate - target;
  if (diff >= 5) return 'text-green-500'; // Excellent
  if (diff >= 0) return 'text-green-400'; // Good
  if (diff >= -5) return 'text-amber-500'; // Close
  return 'text-red-500'; // Below target
};
```

### Trend Indicators

```tsx
const TrendBadge = ({ current, previous }) => {
  const diff = current - previous;
  const isUp = diff > 0;

  return (
    <span className={`flex items-center gap-1 text-xs ${
      isUp ? 'text-green-500' : 'text-red-500'
    }`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(diff).toFixed(1)}%
    </span>
  );
};
```

---

## Accessibility

### Screen Reader Support

```tsx
<div
  role="region"
  aria-label="AI Calibration Progress"
  className="bg-slate-800 rounded-lg p-6"
>
  <h3 className="sr-only">Calibration progress: 78 out of 100 trades</h3>

  <Progress
    value={78}
    aria-valuenow={78}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label="Calibration progress"
  />
</div>
```

### Keyboard Navigation

```tsx
<button
  className="..."
  onClick={handleRefresh}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleRefresh();
    }
  }}
>
  Refresh Data
</button>
```

---

## Dashboard Layout Example

```tsx
export const AICalibrationDashboard = () => {
  return (
    <div className="space-y-6">
      {/* Hero Metrics */}
      <HeroMetrics />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Progress & Win Rate */}
        <div className="lg:col-span-2 space-y-6">
          <ProgressIndicator />
          <PerformanceByTimeframe />
        </div>

        {/* Right: Gauge & Cost Savings */}
        <div className="space-y-6">
          <WinRateGauge />
          <CostSavingsChart />
        </div>
      </div>

      {/* Full Width: Recent Validations */}
      <RecentValidations />
    </div>
  );
};
```

---

## Key Takeaways

✅ **Large, scannable numbers** for hero metrics
✅ **Color-coded data** for quick visual scanning (green/amber/red)
✅ **Contextual comparisons** (targets, trends, benchmarks)
✅ **Compact tables + sparklines** for data density
✅ **Real-time updates** without jarring re-renders
✅ **Responsive layouts** that work on mobile
✅ **Accessible** with ARIA labels and keyboard support

❌ **Don't use 3D charts** - they distort data perception
❌ **Don't overload with animation** - keep it subtle and purposeful
❌ **Don't hide important data** - make key metrics prominent
❌ **Don't use pie charts** - bar charts are almost always better
