// Test nonce generation directly
const now = Date.now();
const nowSec = Math.floor(now / 1000);

console.log('Date.now():', now);
console.log('Math.floor(Date.now() / 1000):', nowSec);
console.log('nowSec * 1000:', nowSec * 1000);

// Test the formula from successful test
const nonce1 = (nowSec * 1000 + Math.floor(Math.random() * 1000)).toString();
console.log('Nonce (formula 1):', nonce1);
console.log('Nonce length:', nonce1.length);

// Test direct milliseconds
const nonce2 = (now + Math.floor(Math.random() * 1000)).toString();
console.log('Nonce (formula 2):', nonce2);
console.log('Nonce length:', nonce2.length);

// The difference
console.log('\nFormula 1 is approximately milliseconds + offset');
console.log('Formula 2 is also approximately milliseconds + offset');
console.log('They should be similar...');
