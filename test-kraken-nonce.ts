import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.KRAKEN_API_KEY!;
const apiSecret = process.env.KRAKEN_API_SECRET!;

async function testWithNonce(nonce: string, label: string) {
  console.log(`\n🧪 Testing with ${label}`);
  console.log(`   Nonce: ${nonce}`);

  const endpoint = '/0/private/Balance';
  const postdata = new URLSearchParams({ nonce });
  const postdata_str = postdata.toString();

  const sha256_digest = crypto.createHash('sha256').update(nonce + postdata_str).digest();
  const message = Buffer.concat([Buffer.from(endpoint), sha256_digest]);

  const signature = crypto
    .createHmac('sha512', Buffer.from(apiSecret, 'base64'))
    .update(message)
    .digest('base64');

  console.log(`   Signature: ${signature.substring(0, 15)}...`);

  try {
    const response = await fetch(`https://api.kraken.com/0/private/Balance`, {
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postdata_str,
    });

    const data: any = await response.json();

    if (data.error && data.error.length > 0) {
      console.log(`   Result: ❌ ${data.error[0]}`);
      return false;
    } else if (data.result) {
      console.log(`   Result: ✅ SUCCESS`);
      return true;
    }
  } catch (error) {
    console.log(`   Result: ❌ Network error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return false;
}

async function main() {
  console.log('=== KRAKEN NONCE FORMAT TEST ===');

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const nowMs = now;

  // Test different nonce formats
  const nonces = [
    { nonce: nowSec.toString(), label: 'Unix timestamp (seconds)' },
    { nonce: nowMs.toString(), label: 'Unix timestamp (milliseconds)' },
    { nonce: (nowSec * 1000 + Math.floor(Math.random() * 1000)).toString(), label: 'Milliseconds with microsecond precision' },
  ];

  let anySuccess = false;
  for (const { nonce, label } of nonces) {
    const success = await testWithNonce(nonce, label);
    if (success) anySuccess = true;

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (anySuccess) {
    console.log('\n✅ Found working nonce format!');
  } else {
    console.log('\n❌ None of the nonce formats worked');
    console.log('   This suggests the API key or secret may be invalid/revoked');
  }
}

main();
