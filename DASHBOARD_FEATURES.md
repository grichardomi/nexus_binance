# Enhanced Trading Bot Dashboard - Position Health & Activity Monitoring

## Overview
The dashboard now includes real-time position health monitoring and activity feed tracking to help you identify stuck positions and monitor erosion before they become problems.

## New Features

### 1. Position Health Monitor (Real-Time Erosion Tracking)
**Location**: Dashboard under "Position Health Monitor"

Shows all open positions with:
- **Entry Price**: Initial entry point
- **Current P&L**: Real-time profit/loss in USD
- **Peak P&L**: Highest profit reached (peak equity)
- **Erosion Visualization**: Color-coded bar showing erosion progress
  - 🟢 Green: Healthy (< 30% of cap)
  - 🟡 Yellow: Caution (30-70% of cap)
  - 🔴 Red: Risk (70%+ of cap)
  - 🟣 Purple: Alert (exceeded cap)
- **Hold Time**: Minutes the position has been open
- **Status Badge**: HEALTHY | CAUTION | RISK | ALERT

**Example**:
```
ETH/USD | $3,347.46 | +$548.01 | +$694.67 | ▓░░░░░ 21% | 45m | CAUTION
BTC/USD | $95,368  | +$7.69  | +$85.77 | ▓▓▓▓▓▓ 91% | 240m | ALERT
```

### 2. Activity Feed (Recent 30 Activities)
**Location**: Dashboard under "Activity Feed (Recent 30)"

Chronological log of all position actions:
- **ENTRY**: New position opened (shows price & volume)
- **PYRAMID**: Level 1 or 2 add executed
- **EXIT**: Position closed (shows P&L, reason)
- **EROSION_ALERT**: Erosion cap exceeded (shows erosion %)

**Example**:
```
14:23:45 | ETH/USD | EXIT    | $3,352.12 | P&L: +$548.01 (4.11%) | Reason: Momentum Failure
14:12:30 | BTC/USD | PYRAMID | $95,450   | Vol: 0.069835
13:45:00 | ETH/USD | ENTRY   | $3,347.46 | Vol: 1.991560
```

## Why This Matters

### Problem: Stuck Positions
Your previous BTC position was held for **240+ minutes** with:
- Peak profit: **+$85.77**
- Eroded to: **+$7.69** (91% erosion)
- Reason: Erosion cap wasn't being enforced correctly

### Solution: Early Detection
The dashboard now shows:
1. **Erosion progress bar** - See exactly when you're approaching the cap
2. **Hold time warning** - Positions held >4h with >80% erosion get flagged
3. **Activity log** - Exact timestamps of when each action occurred
4. **Automatic alerts** - Dashboard highlights ALERT status in purple

## Technical Details

### Endpoints
New API endpoints expose this data:
- `/api/position-health` - Returns all open positions with erosion metrics
- `/api/activity-feed` - Returns recent 30 activities with full details

### Data Retention
- Activity feed keeps last 100 activities (memory-efficient)
- No performance impact - computed on-demand, not cached
- Updates every 5 seconds automatically

### Erosion Cap Logic (Fixed)
```typescript
// OLD (broken): Only checked pyramid positions
if (position.pyramidLevelsActivated === 0) return false;
if (position.erosionUsed > position.erosionCap) { ... } // Wrong units!

// NEW (correct): Checks ALL positions
if (position.peakProfit <= 0) return false;
const erosionPct = (position.erosionUsed / position.peakProfit) * 100;
const capPct = position.erosionCap * 100; // 0.008 = 0.8%
if (erosionPct > capPct) { ... } // Correct comparison
```

## What To Watch For

### Health Status Meanings
| Status | Meaning | Action |
|--------|---------|--------|
| 🟢 HEALTHY | <30% of erosion cap | Nothing needed |
| 🟡 CAUTION | 30-70% of cap | Monitor closely |
| 🔴 RISK | 70-100% of cap | Be ready to exit |
| 🟣 ALERT | >100% of cap | Will auto-close soon |

### Manual Intervention Cases
Monitor the activity feed for:
1. **Long-held positions** (>240min) - May indicate choppy market
2. **Repeated PYRAMID entries** - Confirm momentum is real, not noise
3. **EXIT with "Erosion Cap Exceeded"** - This is the fix working correctly
4. **Multiple EROSION_ALERTs on same pair** - Pattern suggests bad regime

## Example Dashboard Session

```
BOT STATUS: ✅ RUNNING (2h 15m uptime)

OPEN POSITIONS (Real-time):
ETH/USD | $3,347.46 | +$4.66 | +$694.67 | ▒░░░░░░░░░ 1% | 2m | HEALTHY
↳ Just entered, erosion is zero - good entry signal

POSITION HEALTH MONITOR:
Shows erosion bar for each position
Updates every candle close

ACTIVITY FEED (Last 10):
14:32:15 ETH/USD ENTRY   $3,347.46 | Vol: 1.991560
14:30:45 BTC/USD EXIT    $95,368.69 | P&L: +$7.69 (0.06%) | Reason: Erosion Cap Exceeded
14:28:30 BTC/USD PYRAMID $95,450 | Vol: 0.069835

RECENT TRADES (Last 10):
BTC/USD $95,361 → $95,368.69 +$7.69 (+0.06%) 240m Erosion Cap Exceeded
ETH/USD $3,190.96 → $3,322.11 +$548.01 (+4.11%) 276m Momentum Failure
```

## Prevention: What Changed

### Fixed in PositionTracker.ts:
1. ✅ Erosion cap comparison now uses percentages (not dollars)
2. ✅ Applies to ALL positions (not just pyramid)
3. ✅ Positions persist to disk immediately on entry/change
4. ✅ Activity feed logs all position events
5. ✅ Position health API calculates erosion status

### Added Monitoring:
1. ✅ Early detection alerts (>80% of cap)
2. ✅ Hold time tracking (>4h warnings)
3. ✅ Visual erosion bars (see cap progress)
4. ✅ Timestamped activity log

## Future Enhancements

Optional improvements you could add:
- **Email alerts** when position hits RISK status
- **CSV export** of activity feed for analysis
- **Charts** showing erosion progress over time
- **Pair-specific rules** (different erosion caps per pair)
- **Regime analysis** (why did position hold so long?)

## Testing

To verify the fix is working:
1. Open dashboard at http://localhost:3001
2. Create a new position
3. Watch the erosion bar in Position Health Monitor
4. If erosion reaches cap → Position closes automatically (check Activity Feed)
5. Verify exit reason is "Erosion Cap Exceeded"

## Files Modified

- ✅ `src/utils/types.ts` - Added ActivityFeedEntry, PositionHealth types
- ✅ `src/PositionTracker.ts` - Added activity logging, position health method
- ✅ `src/DashboardServer.ts` - Added endpoints, UI sections, real-time updates
- ✅ `CLAUDE.md` - Documentation updated with fix details

