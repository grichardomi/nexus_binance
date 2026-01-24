/**
 * Test: Simulate complete position closure workflow
 * This shows what happens in the trading loop when underwater exit triggers
 */

const PositionTracker = require('./dist/PositionTracker').default;
const fs = require('fs');
const path = require('path');

// Mock config
const mockConfig = {
  underwaterExitThresholdPct: -0.008,
  underwaterExitMinTimeMinutes: 15,
};

console.log('🎯 Testing Position Closure Workflow\n');
console.log('This simulates what happens when the trading bot processes the ETH/USD position:');
console.log('  1. Bot enters monitorPosition() for ETH/USD');
console.log('  2. Bot calls checkUnderwaterExit()');
console.log('  3. If true, bot calls closePosition()\n');
console.log('='.repeat(70) + '\n');

// Initialize tracker
const tracker = new PositionTracker('./data');
const ethPair = 'ETH/USD';

// Step 1: Get current position
let position = tracker.getPosition(ethPair);
if (!position) {
  console.log('❌ No position found');
  process.exit(1);
}

console.log('📊 STEP 1: Current Position State');
console.log(`   Pair: ${position.pair}`);
console.log(`   Entry Price: $${position.entryPrice.toFixed(2)}`);
console.log(`   Current Profit: $${position.currentProfit.toFixed(2)} (${position.profitPct.toFixed(2)}%)`);
console.log(`   Status: ${position.status}`);
console.log(`   Held for: ${((Date.now() - position.entryTime) / 60000).toFixed(1)} minutes\n`);

// Step 2: Check underwater exit
console.log('📊 STEP 2: Check Underwater Exit Condition');
const shouldExit = tracker.checkUnderwaterExit(ethPair, mockConfig);
console.log(`   Condition met: ${shouldExit ? '✅ YES' : '❌ NO'}\n`);

if (!shouldExit) {
  console.log('❌ Position would NOT be closed (condition not met)');
  process.exit(1);
}

// Step 3: Close position (simulate with a test exit price)
// In the actual bot, the currentPrice from market data would be used
const currentPrice = position.entryPrice - (position.entryPrice * 0.009); // -0.9%
console.log('📊 STEP 3: Close Position');
console.log(`   Exit Price: $${currentPrice.toFixed(2)}`);
console.log(`   Exit Reason: Underwater Timeout`);

// Record initial state before closing
const openBefore = tracker.getOpenPositions().length;
const closedBefore = tracker.getClosedPositions().length;

// Actually close the position (this modifies the tracker)
tracker.closePosition(ethPair, currentPrice, 'Underwater Timeout');

// Check state after closing
const openAfter = tracker.getOpenPositions().length;
const closedAfter = tracker.getClosedPositions().length;
const closedPosition = tracker.getClosedPositions().find((p) => p.pair === ethPair && p.exitReason === 'Underwater Timeout');

console.log('\n📊 STEP 4: Verify Closure');
console.log(`   Open positions before: ${openBefore}`);
console.log(`   Open positions after: ${openAfter}`);
console.log(`   Closed positions before: ${closedBefore}`);
console.log(`   Closed positions after: ${closedAfter}`);
console.log(`   Position status: ${closedPosition ? closedPosition.status : 'NOT FOUND'}`);
console.log(`   Exit reason: ${closedPosition ? closedPosition.exitReason : 'N/A'}\n`);

console.log('='.repeat(70));

if (closedPosition && closedPosition.status === 'closed' && openAfter === openBefore - 1) {
  console.log('\n✅ SUCCESS: Position closure workflow is working correctly!');
  console.log('\nSummary:');
  console.log(`  - Position closed at: $${currentPrice.toFixed(2)}`);
  console.log(`  - Final P&L: ${closedPosition.profitPct.toFixed(2)}%`);
  console.log(`  - Exit Reason: ${closedPosition.exitReason}`);
  console.log('\n📌 The ETH/USD position will be closed in the next bot iteration.');
  process.exit(0);
} else {
  console.log('\n❌ FAILED: Position was not properly closed');
  process.exit(1);
}
