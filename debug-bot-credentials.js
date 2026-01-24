require('dotenv').config();

console.log('=== BOT CREDENTIAL DEBUG ===\n');

console.log('Environment variables:');
console.log(`  BINANCE_US_API_KEY: ${process.env.BINANCE_US_API_KEY ? process.env.BINANCE_US_API_KEY.substring(0, 10) + '...' : 'MISSING'}`);
console.log(`  BINANCE_US_API_SECRET: ${process.env.BINANCE_US_API_SECRET ? process.env.BINANCE_US_API_SECRET.substring(0, 10) + '...' : 'MISSING'}`);

// Now load the config like the bot does
const config = require('./dist/config').config;

console.log('\nConfig loaded by bot:');
console.log(`  binanceApiKey: ${config.binanceApiKey ? config.binanceApiKey.substring(0, 10) + '...' : 'MISSING'}`);
console.log(`  binanceApiSecret: ${config.binanceApiSecret ? config.binanceApiSecret.substring(0, 10) + '...' : 'MISSING'}`);

// Check if they match
const envKey = process.env.BINANCE_US_API_KEY || '';
const botKey = config.binanceApiKey || '';
const envSecret = process.env.BINANCE_US_API_SECRET || '';
const botSecret = config.binanceApiSecret || '';

console.log('\nMatch check:');
console.log(`  API Key matches: ${envKey === botKey ? '✅ YES' : '❌ NO'}`);
console.log(`  API Secret matches: ${envSecret === botSecret ? '✅ YES' : '❌ NO'}`);

if (envKey !== botKey) {
  console.log(`\n⚠️  API Key mismatch!`);
  console.log(`  Env length: ${envKey.length}`);
  console.log(`  Bot length: ${botKey.length}`);
}

if (envSecret !== botSecret) {
  console.log(`\n⚠️  API Secret mismatch!`);
  console.log(`  Env length: ${envSecret.length}`);
  console.log(`  Bot length: ${botSecret.length}`);
}

// Now test if the bot's BinanceClient can fetch balance
const KrakenClient = require('./dist/KrakenClient').default;

async function testBotClient() {
  console.log('\n=== Testing Bot\'s Binance Client ===\n');
  const client = new KrakenClient(config.binanceApiKey, config.binanceApiSecret);

  try {
    const balance = await client.getBalance();
    if (balance) {
      console.log('✅ Bot client can fetch balance');
      console.log(`   Balance: ${JSON.stringify(balance).substring(0, 100)}...`);
    } else {
      console.log('❌ Bot client returned null balance');
    }
  } catch (error) {
    console.log(`❌ Bot client error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

testBotClient();
