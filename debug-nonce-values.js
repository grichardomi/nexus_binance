require('dotenv').config();

const KrakenClient = require('./dist/KrakenClient').default;

// Monkey-patch to log nonce values
const originalSignRequest = KrakenClient.prototype.signRequest;

let callCount = 0;

async function testMultipleCalls() {
  console.log('=== Testing Multiple API Calls to See Nonce Pattern ===\n');

  const client = new KrakenClient(
    process.env.BINANCE_US_API_KEY,
    process.env.BINANCE_US_API_SECRET
  );

  // Test 5 calls with logging
  for (let i = 0; i < 3; i++) {
    console.log(`\nCall ${i + 1}:`);
    console.log(`  Date.now(): ${Date.now()}`);

    try {
      const balance = await client.getBalance();
      if (balance) {
        console.log('  ✅ Success');
      } else {
        console.log('  ❌ Failed (null result)');
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (i < 2) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

testMultipleCalls();
