/**
 * Test script for underwater exit logic
 * Verifies that ETH/USD trade closes when loss exceeds threshold
 */

const fs = require('fs');
const path = require('path');

// Load positions from JSON
const positionsPath = './data/positions.json';
const positionsData = JSON.parse(fs.readFileSync(positionsPath, 'utf-8'));

// Default config values
const defaultConfig = {
  underwaterExitThresholdPct: -0.008, // -0.8%
  underwaterExitMinTimeMinutes: 15,   // 15 minutes
};

console.log('🧪 Testing Underwater Exit Logic\n');
console.log('Configuration:');
console.log(`  - Loss Threshold: ${(defaultConfig.underwaterExitThresholdPct * 100).toFixed(1)}%`);
console.log(`  - Min Hold Time: ${defaultConfig.underwaterExitMinTimeMinutes} minutes\n`);

// Test the open ETH/USD position
const ethPosition = positionsData.open.find((p) => p.pair === 'ETH/USD');

if (!ethPosition) {
  console.log('❌ No open ETH/USD position found');
  process.exit(1);
}

console.log('📍 Current ETH/USD Position:');
console.log(`  - Entry Price: $${ethPosition.entryPrice.toFixed(2)}`);
console.log(`  - Current Profit: $${ethPosition.currentProfit.toFixed(2)}`);
console.log(`  - Profit %: ${ethPosition.profitPct.toFixed(2)}%`);
console.log(`  - Peak Profit: $${ethPosition.peakProfit.toFixed(2)}`);
console.log(`  - Status: ${ethPosition.status}\n`);

// Check underwater exit conditions
console.log('🔍 Checking Underwater Exit Conditions:\n');

// Condition 1: Never went positive (peakProfit <= 0)
const neverWentPositive = ethPosition.peakProfit <= 0;
console.log(`1. Never went positive (peakProfit <= 0):
   peakProfit = ${ethPosition.peakProfit}
   Result: ${neverWentPositive ? '✅ PASS' : '❌ FAIL'}`);

// Condition 2: Must be underwater (currentProfit < 0)
const isUnderwater = ethPosition.currentProfit < 0;
console.log(`\n2. Is underwater (currentProfit < 0):
   currentProfit = $${ethPosition.currentProfit.toFixed(2)}
   Result: ${isUnderwater ? '✅ PASS' : '❌ FAIL'}`);

// Condition 3: Time threshold (held > 15 minutes)
const ageMinutes = (Date.now() - ethPosition.entryTime) / 60000;
const meetsTimeThreshold = ageMinutes >= defaultConfig.underwaterExitMinTimeMinutes;
console.log(`\n3. Time threshold (> ${defaultConfig.underwaterExitMinTimeMinutes} minutes):
   Age: ${ageMinutes.toFixed(1)} minutes
   Result: ${meetsTimeThreshold ? '✅ PASS' : '❌ FAIL'}`);

// Condition 4: Loss exceeds threshold
const lossPct = ethPosition.profitPct;
const meetsLossThreshold = lossPct < defaultConfig.underwaterExitThresholdPct;
console.log(`\n4. Loss exceeds threshold (< ${(defaultConfig.underwaterExitThresholdPct * 100).toFixed(1)}%):
   Loss: ${lossPct.toFixed(2)}%
   Threshold: ${(defaultConfig.underwaterExitThresholdPct * 100).toFixed(1)}%
   Result: ${meetsLossThreshold ? '✅ PASS' : '❌ FAIL'}`);

// Overall decision
console.log('\n' + '='.repeat(60));
const shouldExit = neverWentPositive && isUnderwater && meetsTimeThreshold && meetsLossThreshold;
console.log(`\n📊 UNDERWATER EXIT DECISION: ${shouldExit ? '✅ SHOULD CLOSE' : '❌ SHOULD REMAIN OPEN'}`);

if (!shouldExit) {
  console.log('\n⚠️  Why it\'s not closing:');
  if (!neverWentPositive) console.log('  - Position once had profit (peakProfit > 0)');
  if (!isUnderwater) console.log('  - Position is not underwater (currentProfit >= 0)');
  if (!meetsTimeThreshold) console.log(`  - Position too young (${ageMinutes.toFixed(1)}min < ${defaultConfig.underwaterExitMinTimeMinutes}min)`);
  if (!meetsLossThreshold) console.log(`  - Loss not severe enough (${lossPct.toFixed(2)}% > ${(defaultConfig.underwaterExitThresholdPct * 100).toFixed(1)}%)`);
}

console.log('\n' + '='.repeat(60));

process.exit(shouldExit ? 0 : 1);
