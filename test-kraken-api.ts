import BinanceClient from './src/BinanceClient';

async function testBinanceAPI() {
  const apiKey = process.env.BINANCE_US_API_KEY;
  const apiSecret = process.env.BINANCE_US_API_SECRET;

  console.log('Testing Binance API...');
  console.log('API Key present:', !!apiKey);
  console.log('API Secret present:', !!apiSecret);

  if (!apiKey || !apiSecret) {
    console.error('Missing API credentials');
    return;
  }

  const client = new BinanceClient(apiKey, apiSecret);

  try {
    console.log('\nFetching BTC/USD ticker...');
    const ticker = await client.getTicker('BTC/USD');
    
    if (ticker) {
      console.log('✅ Success!');
      console.log('BTC Price:', ticker.price);
      console.log('Bid:', ticker.bid);
      console.log('Ask:', ticker.ask);
      console.log('Spread:', ticker.spread);
    } else {
      console.error('❌ Ticker returned null');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBinanceAPI();
