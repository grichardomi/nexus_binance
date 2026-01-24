import fetch from 'node-fetch';

async function testPublicAPI() {
  console.log('=== TESTING KRAKEN PUBLIC API ===\n');

  try {
    console.log('1. Testing Time endpoint...');
    const timeResp = await fetch('https://api.kraken.com/0/public/Time');
    const timeData: any = await timeResp.json();

    if (timeData.result) {
      console.log('   ✅ Time endpoint works');
      console.log(`   Server time: ${new Date(timeData.result.unixtime * 1000).toISOString()}`);
    } else {
      console.log('   ❌ Time endpoint failed:', timeData.error);
      return false;
    }

    console.log('\n2. Testing Ticker endpoint...');
    const tickerResp = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD');
    const tickerData: any = await tickerResp.json();

    if (tickerData.result) {
      console.log('   ✅ Ticker endpoint works');
      console.log(`   Available pairs: ${Object.keys(tickerData.result).join(', ')}`);
    } else {
      console.log('   ❌ Ticker endpoint failed:', tickerData.error);
      return false;
    }

    console.log('\n✅ Public API is working');
    return true;
  } catch (error) {
    console.log(`❌ Network error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

testPublicAPI().then((success) => {
  process.exit(success ? 0 : 1);
});
