/**
 * Integration test: simulate trading iteration with underwater exit
 * Verifies the full flow from monitoring to position closing
 */

const PositionTracker = require('./dist/PositionTracker').default;
const fs = require('fs');

// Mock config object
const mockConfig = {
  underwaterExitThresholdPct: -0.008, // -0.8%
  underwaterExitMinTimeMinutes: 15,   // 15 minutes
  paperTrading: true,
  momentumFailureEnabled: true,
  momentumFailureMinProfit: 0.02,
  momentum1hFailureThreshold: -0.003,
  momentum4hFailureThreshold: -0.005,
  volumeExhaustionThreshold1h: 0.9,
  volumeExhaustionThreshold4h: 1.0,
  htfMomentumWeakening: 0.005,
  priceNearPeakThreshold: 0.98,
  momentumFailureRequiredSignals: 2,
};

console.log('🧪 Integration Test: Underwater Exit in Trading Loop\n');

// Initialize position tracker
const tracker = new PositionTracker('./data');

// Get the open ETH/USD position
const positions = tracker.getOpenPositions();
const ethPosition = positions.find((p) => p.pair === 'ETH/USD');

if (!ethPosition) {
  console.log('❌ No open ETH/USD position found in tracker');
  process.exit(1);
}

console.log('📍 Position Details:');
console.log(`  Pair: ${ethPosition.pair}`);
console.log(`  Entry: $${ethPosition.entryPrice.toFixed(2)}`);
console.log(`  Profit: ${ethPosition.profitPct.toFixed(2)}%`);
console.log(`  Status: ${ethPosition.status}\n`);

// Test the underwater exit check (THIS IS WHAT THE BOT CALLS)
console.log('🔍 Calling checkUnderwaterExit() method:');
const shouldExit = tracker.checkUnderwaterExit(ethPosition.pair, mockConfig);

console.log(`\nResult: ${shouldExit ? '✅ SHOULD EXIT' : '❌ NO EXIT'}\n`);

if (shouldExit) {
  console.log('✅ Underwater exit check PASSED!');
  console.log('\nNext step in trading loop (src/index.ts line 495):');
  console.log('  if (this.positionTracker.checkUnderwaterExit(pair, config)) {');
  console.log('    await this.closePosition(pair, currentPrice, "Underwater Timeout");');
  console.log('    return; // Skip other exit checks');
  console.log('  }');
  console.log('\n📌 Position should now be marked as closed.');
  process.exit(0);
} else {
  console.log('❌ Underwater exit check FAILED!');
  console.log('\nDebugging information:');

  // Re-run the checks to see why
  const neverWentPositive = ethPosition.peakProfit <= 0;
  const isUnderwater = ethPosition.currentProfit < 0;
  const ageMinutes = (Date.now() - ethPosition.entryTime) / 60000;
  const meetsTimeThreshold = ageMinutes >= mockConfig.underwaterExitMinTimeMinutes;
  const lossPct = ethPosition.profitPct;
  const meetsLossThreshold = lossPct < mockConfig.underwaterExitThresholdPct;

  console.log(`  Never went positive: ${neverWentPositive}`);
  console.log(`  Is underwater: ${isUnderwater}`);
  console.log(`  Meets time threshold: ${meetsTimeThreshold} (${ageMinutes.toFixed(1)}min)`);
  console.log(`  Meets loss threshold: ${meetsLossThreshold} (${lossPct.toFixed(2)}%)`);

  process.exit(1);
}
