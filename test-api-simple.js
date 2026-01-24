require('dotenv').config();

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Present' : '✗ Missing');
console.log('KRAKEN_API_KEY:', process.env.KRAKEN_API_KEY ? '✓ Present' : '✗ Missing');
console.log('KRAKEN_API_SECRET:', process.env.KRAKEN_API_SECRET ? '✓ Present' : '✗ Missing');

// Try fetching BTC ticker directly
const https = require('https');

function fetchBTC() {
  return new Promise((resolve, reject) => {
    const url = 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD';
    https.get(url, (res) => {
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

console.log('\nTesting public Kraken API (no auth required)...');
fetchBTC()
  .then((data) => {
    if (data.result && data.result.XXBTZUSD) {
      const ticker = data.result.XXBTZUSD;
      console.log('✅ Kraken API works!');
      console.log('  BTC Price:', ticker.c[0]);
      console.log('  Bid:', ticker.b[0]);
      console.log('  Ask:', ticker.a[0]);
    } else {
      console.log('❌ No ticker data in response');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  })
  .catch((error) => {
    console.error('❌ Kraken API error:', error.message);
  });
