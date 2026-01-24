import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.KRAKEN_API_KEY;
const apiSecret = process.env.KRAKEN_API_SECRET;

console.log('=== KRAKEN API CREDENTIAL DIAGNOSTIC ===\n');

// Check 1: Are credentials present?
console.log('1️⃣  CREDENTIAL PRESENCE CHECK');
console.log(`   API Key present: ${apiKey ? '✅' : '❌'}`);
console.log(`   API Secret present: ${apiSecret ? '✅' : '❌'}`);

if (!apiKey || !apiSecret) {
  console.error('\n❌ FATAL: Missing API credentials in .env');
  process.exit(1);
}

// Check 2: Credential format
console.log('\n2️⃣  CREDENTIAL FORMAT CHECK');
console.log(`   API Key length: ${apiKey.length}`);
console.log(`   API Key first 10 chars: ${apiKey.substring(0, 10)}...`);
console.log(`   API Secret length: ${apiSecret.length}`);
console.log(`   API Secret first 10 chars: ${apiSecret.substring(0, 10)}...`);

// Check 3: Hidden characters
console.log('\n3️⃣  HIDDEN CHARACTER CHECK');
const hasNewlineKey = apiKey.includes('\n') || apiKey.includes('\r');
const hasNewlineSecret = apiSecret.includes('\n') || apiSecret.includes('\r');
const hasWhitespaceKey = apiKey !== apiKey.trim();
const hasWhitespaceSecret = apiSecret !== apiSecret.trim();

console.log(`   API Key has newlines: ${hasNewlineKey ? '❌ YES' : '✅ NO'}`);
console.log(`   API Secret has newlines: ${hasNewlineSecret ? '❌ YES' : '✅ NO'}`);
console.log(`   API Key has leading/trailing whitespace: ${hasWhitespaceKey ? '❌ YES' : '✅ NO'}`);
console.log(`   API Secret has leading/trailing whitespace: ${hasWhitespaceSecret ? '❌ YES' : '✅ NO'}`);

// Check 4: Base64 validation for API Secret
console.log('\n4️⃣  BASE64 ENCODING CHECK');
try {
  const trimmedSecret = apiSecret.trim();
  const buffer = Buffer.from(trimmedSecret, 'base64');

  // If it decodes successfully, check if it looks valid
  const decodedLength = buffer.length;
  const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(trimmedSecret);

  console.log(`   API Secret is valid Base64: ${isValidBase64 ? '✅' : '❌'}`);
  console.log(`   Decoded length: ${decodedLength} bytes`);

  if (decodedLength < 32) {
    console.log(`   ⚠️  WARNING: Decoded secret is only ${decodedLength} bytes (expected 64+)`);
  }

  if (decodedLength > 200) {
    console.log(`   ⚠️  WARNING: Decoded secret is ${decodedLength} bytes (very long, verify correctness)`);
  }
} catch (error) {
  console.log(`   API Secret Base64 decode: ❌ FAILED`);
  console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
}

// Check 5: Signature simulation
console.log('\n5️⃣  SIGNATURE GENERATION TEST');
try {
  const nonce = Date.now().toString();
  const endpoint = 'AddOrder';
  const params: Record<string, string> = {
    pair: 'XBTUSD',
    type: 'buy',
    ordertype: 'market',
    volume: '0.001',
  };

  const postdata = new URLSearchParams({ nonce, ...params });
  const postdata_str = postdata.toString();

  const message = endpoint + crypto.createHash('sha256').update(nonce + postdata_str).digest();

  // Try to create signature
  const trimmedSecret = apiSecret.trim();
  const signature = crypto
    .createHmac('sha512', Buffer.from(trimmedSecret, 'base64'))
    .update(message)
    .digest('base64');

  console.log(`   Signature generation: ✅ SUCCESS`);
  console.log(`   Signature length: ${signature.length}`);
  console.log(`   Signature format looks valid: ${/^[A-Za-z0-9+/]*={0,2}$/.test(signature) ? '✅' : '❌'}`);
} catch (error) {
  console.log(`   Signature generation: ❌ FAILED`);
  console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
}

// Check 6: API Key format
console.log('\n6️⃣  API KEY FORMAT CHECK');
const keyLooksValid = apiKey.length > 20 && !/\s/.test(apiKey);
console.log(`   API Key format: ${keyLooksValid ? '✅ Looks valid' : '❌ Format issue'}`);

// Summary
console.log('\n=== SUMMARY ===');
const allChecks = [
  apiKey ? true : false,
  apiSecret ? true : false,
  !hasNewlineKey && !hasNewlineSecret,
  !hasWhitespaceKey && !hasWhitespaceSecret,
  keyLooksValid,
];

const passCount = allChecks.filter(Boolean).length;
console.log(`Checks passed: ${passCount}/${allChecks.length}`);

if (passCount === allChecks.length) {
  console.log('\n✅ Credentials look correct! Issue might be:');
  console.log('   1. Kraken API key permissions (missing "Create & Modify Orders" permission)');
  console.log('   2. IP whitelist (check Kraken API settings for IP restrictions)');
  console.log('   3. System clock out of sync (Kraken needs accurate time)');
  console.log('   4. Account not ready for trading (new account, not fully verified)');
} else {
  console.log('\n❌ Issues found with credentials - fix above before retrying');
}
