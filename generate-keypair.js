// generate-keypair.js
// Creates a fresh Solana keypair for the BENTO agent (devnet).
// Use this ONCE per environment. Save the printed private key to .env as AGENT_WALLET_PRIVATE_KEY.

const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58').default;

const kp = Keypair.generate();
const pubkey = kp.publicKey.toBase58();
const secret = bs58.encode(kp.secretKey);

console.log('========================================');
console.log('BENTO AGENT WALLET (Solana, devnet-safe)');
console.log('========================================');
console.log('Public key  :', pubkey);
console.log('Private key :', secret);
console.log('========================================');
console.log('Save the private key to .env as:');
console.log('  AGENT_WALLET_PRIVATE_KEY=' + secret);
console.log('');
console.log('Next step: register this public key at');
console.log('  https://app.bentoguard.xyz/');
console.log('(connect your owner wallet, click My Agents > Add Agent)');
