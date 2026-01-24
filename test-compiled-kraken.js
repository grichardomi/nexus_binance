require('dotenv').config();

const KrakenClient = require('./dist/KrakenClient').default;

  const apiKey = process.env.BINANCE_US_API_KEY;
  const apiSecret = process.env.BINANCE_US_API_SECRET;

async function test() {
  console.log('=== Testing Compiled KrakenClient ===\n');

  const client = new KrakenClient(apiKey, apiSecret);

  try {
    console.log('Testing getBalance()...');
    const balance = await client.getBalance();

    if (balance) {
      console.log('✅ SUCCESS!');
      console.log('Balance:', balance);
      process.exit(0);
    } else {
      console.log('❌ getBalance returned null');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

test();
