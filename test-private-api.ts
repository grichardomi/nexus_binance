import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.KRAKEN_API_KEY!;
const apiSecret = process.env.KRAKEN_API_SECRET!;

console.log('=== KRAKEN PRIVATE API TEST ===\n');

async function testPrivateAPI(): Promise<boolean> {
  const endpoint = 'Balance';
  const nonce = Date.now().toString();
  const baseUrl = 'https://api.kraken.com/0/private';

  console.log(`1️⃣  Testing ${endpoint} endpoint`);
  console.log(`   Endpoint: ${baseUrl}/${endpoint}`);
  console.log(`   Nonce: ${nonce}`);
  console.log(`   System time: ${new Date().toISOString()}`);

  // Step 1: Create postdata
  const postdata = new URLSearchParams({ nonce });
  const postdata_str = postdata.toString();

  console.log(`\n2️⃣  Signature generation`);
  console.log(`   POST data: ${postdata_str}`);

  // Step 2: Create message
  const message_hash = crypto.createHash('sha256').update(nonce + postdata_str).digest();
  const message = endpoint + message_hash;

  console.log(`   Message hash: ${message_hash.toString('hex').substring(0, 20)}...`);

  // Step 3: Sign with API secret
  const signature = crypto
    .createHmac('sha512', Buffer.from(apiSecret, 'base64'))
    .update(message)
    .digest('base64');

  console.log(`   Signature: ${signature.substring(0, 20)}...`);

  // Step 4: Make request
  console.log(`\n3️⃣  Making request...`);

  const headers = {
    'API-Key': apiKey,
    'API-Sign': signature,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  console.log(`   Headers:`);
  console.log(`     API-Key: ${apiKey.substring(0, 10)}...`);
  console.log(`     API-Sign: ${signature.substring(0, 10)}...`);

  try {
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      method: 'POST',
      headers,
      body: postdata_str,
    });

    console.log(`\n4️⃣  Response`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Status text: ${response.statusText}`);

    const data: any = await response.json();

    console.log(`   Response keys: ${Object.keys(data).join(', ')}`);

    if (data.error && data.error.length > 0) {
      console.log(`\n❌ ERROR: ${data.error.join(', ')}`);

      // Analyze error
      const errorMsg = data.error[0];
      console.log(`\n   Analysis:`);
      if (errorMsg.includes('Invalid key')) {
        console.log(`   • This means the API key OR signature is invalid`);
        console.log(`   • Check:` );
        console.log(`     1. API key copied correctly from Kraken`);
        console.log(`     2. API secret copied correctly from Kraken`);
        console.log(`     3. System clock is accurate (within ±5 seconds of NTP)`);
        console.log(`     4. No spaces/tabs in .env file`);
      } else if (errorMsg.includes('EAPI:Rate limit')) {
        console.log(`   • Rate limited - wait before retrying`);
      } else if (errorMsg.includes('EAPI:Invalid nonce')) {
        console.log(`   • Nonce invalid - system clock is out of sync`);
        console.log(`   • Run: ntpdate -q pool.ntp.org`);
      } else if (errorMsg.includes('EGeneral:Permission denied')) {
        console.log(`   • API key doesn't have "Create & Modify Orders" permission`);
        console.log(`   • Go to Kraken API settings and enable "Create & modify orders"`);
      }

      return false;
    }

    if (data.result) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Result keys: ${Object.keys(data.result).join(', ')}`);
      return true;
    }
  } catch (error) {
    console.log(`\n❌ NETWORK ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }

  return false;
}

testPrivateAPI().then((success) => {
  process.exit(success ? 0 : 1);
});
