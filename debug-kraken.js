require('dotenv').config();

// Simulate KrakenClient
const https = require('https');

class KrakenDebug {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = 'https://api.kraken.com';
    this.assetPairMap = new Map();
  }

  async publicRequest(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/0/public/${endpoint}`);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      const urlStr = url.toString();
      console.log(`\n📡 Request: ${endpoint}`);
      console.log(`   URL: ${urlStr}`);

      https.get(urlStr, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            console.log(`   Status: ${res.statusCode}`);
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  async mapAssetPair(pair) {
    console.log(`\n🔍 Mapping pair: ${pair}`);

    if (this.assetPairMap.has(pair)) {
      const mapped = this.assetPairMap.get(pair);
      console.log(`   Cache hit: ${pair} -> ${mapped}`);
      return mapped;
    }

    const commonMappings = {
      'BTC/USD': 'XBTUSD',
      'ETH/USD': 'ETHUSD',
      'BTC/USDT': 'XBTUSDT',
      'ETH/USDT': 'ETHUSDT',
    };

    if (commonMappings[pair]) {
      const mapped = commonMappings[pair];
      this.assetPairMap.set(pair, mapped);
      console.log(`   Common mapping: ${pair} -> ${mapped}`);
      return mapped;
    }

    const fallback = pair.replace('/', '').toUpperCase();
    this.assetPairMap.set(pair, fallback);
    console.log(`   Fallback mapping: ${pair} -> ${fallback}`);
    return fallback;
  }

  async getTicker(pair) {
    console.log(`\n🎯 getTicker(${pair})`);
    try {
      const krakenPair = await this.mapAssetPair(pair);
      console.log(`   Kraken pair: ${krakenPair}`);

      const data = await this.publicRequest('Ticker', {
        pair: krakenPair,
      });

      console.log(`\n   Response keys: ${Object.keys(data)}`);
      if (data.error) console.log(`   Error: ${data.error}`);
      if (data.result) console.log(`   Result keys: ${Object.keys(data.result)}`);

      // Try exact key
      let ticker = data.result[krakenPair];
      console.log(`   Tried exact key "${krakenPair}": ${ticker ? 'FOUND' : 'NOT FOUND'}`);

      if (!ticker) {
        const altKey = 'X' + krakenPair;
        ticker = data.result[altKey];
        console.log(`   Tried alt key "${altKey}": ${ticker ? 'FOUND' : 'NOT FOUND'}`);
      }

      if (!ticker) {
        console.log(`   ERROR: Ticker not found!`);
        console.log(`   Available result keys:`, Object.keys(data.result));
        return null;
      }

      const bid = parseFloat(String(ticker.b[0]));
      const ask = parseFloat(String(ticker.a[0]));
      const price = parseFloat(String(ticker.c[0]));
      const volume = parseFloat(String(ticker.v[0]));
      const spread = ask - bid;

      console.log(`   SUCCESS: Parsed ticker`);
      console.log(`      Price: ${price}, Bid: ${bid}, Ask: ${ask}`);

      return { bid, ask, price, volume, spread };
    } catch (error) {
      console.error(`   ERROR: ${error.message}`);
      throw error;
    }
  }
}

async function test() {
  const apiKey = process.env.KRAKEN_API_KEY;
  const apiSecret = process.env.KRAKEN_API_SECRET;

  console.log('=== Kraken Client Debug ===\n');
  console.log(`API Key: ${apiKey ? 'Present' : 'Missing'}`);
  console.log(`API Secret: ${apiSecret ? 'Present' : 'Missing'}`);

  const client = new KrakenDebug(apiKey, apiSecret);

  try {
    const ticker = await client.getTicker('BTC/USD');
    if (ticker) {
      console.log('\nSUCCESS!');
      console.log(JSON.stringify(ticker, null, 2));
    } else {
      console.log('\nFAILED - ticker is null');
    }
  } catch (error) {
    console.error('\nEXCEPTION:', error.message);
  }
}

test();
