import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.KRAKEN_API_KEY!;
const apiSecret = process.env.KRAKEN_API_SECRET!;

async function testSignatureFormat(formatName: string, signFn: (endpoint: string, nonce: string, postdata_str: string) => string) {
  console.log(`\n🧪 Testing ${formatName}`);

  const endpoint = '/0/private/Balance';
  const nonce = (Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000)).toString();
  const postdata = new URLSearchParams({ nonce });
  const postdata_str = postdata.toString();

  const signature = signFn(endpoint, nonce, postdata_str);
  console.log(`   Nonce: ${nonce}`);
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
    console.log(`   Result: ❌ Network error`);
  }

  return false;
}

function signFormat1(endpoint: string, nonce: string, postdata_str: string): string {
  // Original (broken) approach: string + buffer
  const message = endpoint + crypto.createHash('sha256').update(nonce + postdata_str).digest();
  return crypto
    .createHmac('sha512', Buffer.from(apiSecret, 'base64'))
    .update(message)
    .digest('base64');
}

function signFormat2(endpoint: string, nonce: string, postdata_str: string): string {
  // Fixed approach: properly concatenate bytes
  const sha256_digest = crypto.createHash('sha256').update(nonce + postdata_str).digest();
  const message = Buffer.concat([Buffer.from(endpoint), sha256_digest]);
  return crypto
    .createHmac('sha512', Buffer.from(apiSecret, 'base64'))
    .update(message)
    .digest('base64');
}

async function main() {
  console.log('=== SIGNATURE FORMAT TEST ===');

  const format1Success = await testSignatureFormat('Format 1 (string + buffer)', signFormat1);

  // Wait between tests to avoid nonce issues
  await new Promise((resolve) => setTimeout(resolve, 500));

  const format2Success = await testSignatureFormat('Format 2 (Buffer.concat)', signFormat2);

  console.log('\n=== RESULTS ===');
  if (format1Success) {
    console.log('✅ Format 1 (string + buffer) WORKS');
  } else {
    console.log('❌ Format 1 (string + buffer) FAILS');
  }

  if (format2Success) {
    console.log('✅ Format 2 (Buffer.concat) WORKS');
  } else {
    console.log('❌ Format 2 (Buffer.concat) FAILS');
  }
}

main();
