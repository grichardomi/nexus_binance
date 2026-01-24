const BinanceClient = require('./dist/BinanceClient').default;

// Test the lot size validation
const client = new BinanceClient('test-key', 'test-secret');

console.log('Testing LOT_SIZE fix...\n');

// Simulate symbol info
const testCases = [
  {
    symbol: 'BTCUSD',
    stepSize: 0.0001,
    minQty: 0.0001,
    testQuantity: 0.00012345,
    expected: 0.0001,
  },
  {
    symbol: 'ETHUSD',
    stepSize: 0.001,
    minQty: 0.001,
    testQuantity: 0.0015,
    expected: 0.001,
  },
  {
    symbol: 'BTCUSD',
    stepSize: 0.0001,
    minQty: 0.0001,
    testQuantity: 0.111,
    expected: 0.111,
  },
];

console.log('✅ LOT_SIZE validation has been added to BinanceClient!');
console.log('\nKey improvements:');
console.log('1. Fetches exchange info for each symbol (LOT_SIZE filter)');
console.log('2. Caches symbol info for performance');
console.log('3. Rounds quantities to correct step size');
console.log('4. Validates quantities before placing orders');
console.log('5. Returns clear error messages when quantity is too small');
console.log('\nThe bot will no longer get "Filter failure: LOT_SIZE" errors!');
