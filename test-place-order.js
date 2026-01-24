require('dotenv').config();

const fetch = require('node-fetch');
const KrakenClient = require('./dist/KrakenClient').default;

const apiKey = process.env.BINANCE_US_API_KEY;
const apiSecret = process.env.BINANCE_US_API_SECRET;

function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function roundToDecimals(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

async function fetchAssetPairMeta(requestedPair) {
  const res = await fetch('https://api.kraken.com/0/public/AssetPairs');
  if (!res.ok) throw new Error(`Failed to fetch AssetPairs: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const all = data.result || {};

  // Build candidate names for matching
  const pair = requestedPair.trim();
  const pairBTCtoXBT = pair.replace('BTC', 'XBT');
  const noSlash = pair.replace('/', '').toUpperCase();
  const noSlashBTCtoXBT = noSlash.replace('BTC', 'XBT');

  let found = null;
  for (const [key, meta] of Object.entries(all)) {
    const wsname = meta.wsname; // e.g., XBT/USD, ETH/USD
    const altname = meta.altname; // e.g., XBTUSD, ETHUSD
    if (
      wsname === pair ||
      wsname === pairBTCtoXBT ||
      altname === noSlash ||
      altname === noSlashBTCtoXBT ||
      key === noSlash ||
      key === noSlashBTCtoXBT
    ) {
      found = { key, ...meta };
      break;
    }
  }

  if (!found) {
    // Fallback: try endsWith logic (e.g., key XXBTZUSD ends with XBTUSD)
    const candidates = Object.entries(all).filter(([key, meta]) =>
      key.endsWith(noSlashBTCtoXBT)
    );
    if (candidates.length > 0) {
      const [key, meta] = candidates[0];
      found = { key, ...meta };
    }
  }

  if (!found) {
    throw new Error(`Could not find AssetPairs metadata for pair "${requestedPair}"`);
  }

  return found;
}

async function main() {
  const pair = getArg('--pair', 'ETH/USD');
  const side = (getArg('--side', 'buy') || 'buy').toLowerCase() === 'sell' ? 'sell' : 'buy';
  const userVolStr = getArg('--volume', '');
  const dryRun = hasFlag('--dry-run');

  console.log('=== Testing Kraken placeOrder (dynamic ordermin) ===\n');
  console.log('Pair:', pair);
  console.log('Side:', side.toUpperCase());

  // Discover pair limits dynamically
  const meta = await fetchAssetPairMeta(pair);
  const ordermin = parseFloat(meta.ordermin || '0');
  const lotDecimals = typeof meta.lot_decimals === 'number' ? meta.lot_decimals : 8;
  const wsname = meta.wsname || pair;
  const altname = meta.altname || pair.replace('/', '');

  console.log('Resolved pair metadata:', {
    key: meta.key,
    wsname,
    altname,
    ordermin,
    lotDecimals,
  });

  let desired = ordermin;
  if (userVolStr) {
    const userVol = parseFloat(userVolStr);
    if (!Number.isFinite(userVol) || userVol <= 0) {
      throw new Error(`Invalid --volume value: ${userVolStr}`);
    }
    desired = Math.max(ordermin, userVol);
  }

  // Round to allowed precision
  const volume = parseFloat(roundToDecimals(desired, lotDecimals).toFixed(lotDecimals));
  const finalVolume = Math.max(volume, ordermin);

  console.log(`Selected volume (rounded): ${finalVolume} (min ${ordermin}, precision ${lotDecimals})`);

  if (dryRun) {
    console.log('\n--dry-run set: not placing order.');
    return;
  }

  const client = new KrakenClient(apiKey, apiSecret);

  try {
    console.log(`\nPlacing LIVE ${side.toUpperCase()} order for ${finalVolume} ${pair} ...`);
    const orderId = await client.placeOrder(pair, side, finalVolume);
    if (orderId) {
      console.log('✅ Order placed successfully!');
      console.log('Order ID:', orderId);
      process.exit(0);
    } else {
      console.log('❌ placeOrder returned null');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : String(error));
    console.log(error instanceof Error ? error.stack : '');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌ Fatal:', e && e.message ? e.message : e);
  process.exit(1);
});
