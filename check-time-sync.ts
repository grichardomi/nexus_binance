import fetch from 'node-fetch';

async function checkTimeSync() {
  console.log('=== TIME SYNCHRONIZATION CHECK ===\n');

  const localTime = Date.now();
  const localDate = new Date(localTime);

  console.log(`Local system time: ${localDate.toISOString()}`);
  console.log(`Local timestamp: ${localTime}\n`);

  try {
    console.log('Fetching Kraken server time...');
    const response = await fetch('https://api.kraken.com/0/public/Time');
    const data: any = await response.json();

    if (data.result) {
      const krakenTime = data.result.unixtime * 1000; // Convert to milliseconds
      const krakenDate = new Date(krakenTime);

      console.log(`Kraken server time: ${krakenDate.toISOString()}`);
      console.log(`Kraken timestamp: ${krakenTime}\n`);

      const diffMs = Math.abs(localTime - krakenTime);
      const diffSec = (diffMs / 1000).toFixed(1);

      console.log(`⏱️  Time difference: ${diffSec}s`);

      if (diffMs < 5000) {
        console.log('✅ Clock is synchronized (within 5 seconds)');
      } else if (diffMs < 30000) {
        console.log('⚠️  WARNING: Clock is slightly off (>5s, <30s)');
        console.log('   Kraken API might reject requests');
      } else {
        console.log('❌ CRITICAL: Clock is severely out of sync (>30s)');
        console.log('   Kraken API WILL reject all requests');
        console.log('\n   Fix: Run `sudo ntpd -gq` or `sudo timedatectl set-ntp true`');
      }

      return diffMs < 5000;
    } else {
      console.log('❌ Failed to get server time:', data.error);
      return false;
    }
  } catch (error) {
    console.log(`❌ Network error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

checkTimeSync().then((synced) => {
  process.exit(synced ? 0 : 1);
});
