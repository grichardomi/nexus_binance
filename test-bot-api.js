require('dotenv').config();
const https = require('https');

function publicRequest(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.kraken.com/0/public/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    console.log('Request URL:', url.toString());

    https.get(url.toString(), { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function testGetTicker() {
  try {
    console.log('Testing getTicker for BTC/USD...\n');
    
    const krakenPair = 'XBTUSD';
    console.log('Using Kraken pair:', krakenPair);
    
    const data = await publicRequest('Ticker', { pair: krakenPair });
    
    console.log('\nRaw response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\nParsed:');
    if (data.error && data.error.length > 0) {
      console.error('API error:', data.error);
    } else {
      const ticker = data.result[krakenPair];
      if (ticker) {
        console.log('✅ Ticker found!');
        console.log('  Bid:', ticker.b[0]);
        console.log('  Ask:', ticker.a[0]);
        console.log('  Price:', ticker.c[0]);
      } else {
        console.log('❌ Ticker not found in response');
        console.log('Available keys:', Object.keys(data.result));
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testGetTicker();
