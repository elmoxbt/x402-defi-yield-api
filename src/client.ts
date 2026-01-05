/**
 * x402 Client
 * Complete payment flow: 402 response → payment → data retrieval
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
} from '@solana/spl-token';
import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';

dotenv.config();

// Configuration
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const API_URL = process.env.API_URL || 'http://localhost:3000';
const KEYPAIR_PATH = process.env.CLIENT_KEYPAIR_PATH || './wallet.json';
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);

interface PaymentRequirement {
  amount: number;
  token: string;
  recipient: string;
  network: string;
}

/**
 * Load wallet keypair from file
 */
function loadKeypair(filepath: string): Keypair {
  try {
    const secretKey = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } catch (error) {
    console.error(`Error loading keypair from ${filepath}:`, error);
    console.log('\nTo create a new wallet, run:');
    console.log(`  solana-keygen new -o ${filepath}`);
    console.log('\nThen fund it with devnet SOL and USDC:');
    console.log('  solana airdrop 2 <your-address> --url devnet');
    throw error;
  }
}

/**
 * Make initial request to get payment requirements
 */
async function getPaymentRequirements(endpoint: string): Promise<PaymentRequirement | null> {
  try {
    const response = await axios.get(`${API_URL}${endpoint}`, {
      validateStatus: (status) => status === 402 || status === 200,
    });

    if (response.status === 402) {
      console.log(' Payment required - details:');
      console.log(JSON.stringify(response.data, null, 2));
      return response.data.payment;
    }

    console.log('✓ No payment required (endpoint may be free)');
    return null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 402) {
      return error.response.data.payment;
    }
    console.error('Error getting payment requirements:', error);
    throw error;
  }
}

/**
 * Send USDC payment on Solana
 */
async function sendPayment(
  connection: Connection,
  payer: Keypair,
  recipient: PublicKey,
  amount: number
): Promise<string> {
  try {
    console.log('\n Preparing USDC payment...');
    console.log(`   From: ${payer.publicKey.toBase58()}`);
    console.log(`   To: ${recipient.toBase58()}`);
    console.log(`   Amount: ${amount} micro-USDC ($${(amount / 1e6).toFixed(6)})`);

    // Get sender's USDC token account
    const senderTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      payer.publicKey
    );

    // Get or create recipient's USDC token account
    const recipientTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      recipient
    );

    // Check sender balance
    const balance = await connection.getTokenAccountBalance(senderTokenAccount);
    console.log(`   Current balance: ${balance.value.amount} micro-USDC`);

    if (parseInt(balance.value.amount) < amount) {
      throw new Error(
        `Insufficient USDC balance. Need ${amount}, have ${balance.value.amount}`
      );
    }

    // Create transfer instruction
    const transaction = new Transaction().add(
      createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        payer.publicKey,
        amount
      )
    );

    // Send and confirm transaction
    console.log('\n Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      {
        commitment: 'confirmed',
      }
    );

    console.log(`✓ Payment confirmed!`);
    console.log(`   Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    return signature;
  } catch (error) {
    console.error('Error sending payment:', error);
    throw error;
  }
}

/**
 * Create x402 payment header (x402-solana format)
 */
function createX402Header(
  amount: number,
  sender: string,
  recipient: string,
  signature: string
): string {
  const paymentData = {
    amount,
    token: USDC_MINT.toBase58(),
    sender,
    recipient,
    signature,
    timestamp: Date.now(),
  };

  // x402-solana format: direct JSON string
  return JSON.stringify(paymentData);
}

/**
 * Make request with payment
 */
async function requestWithPayment(
  endpoint: string,
  paymentHeader: string
): Promise<any> {
  try {
    const response = await axios.get(`${API_URL}${endpoint}`, {
      headers: {
        'x-402-payment': paymentHeader,
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data || error.message);
    }
    throw error;
  }
}

/**
 * Main client flow
 */
async function runClient() {
  console.log('\n x402 DeFi Client - Yield & Portfolio API');
  console.log('   x402 micropayment flow on Solana\n');

  try {
    // Load wallet
    console.log(' Loading wallet...');
    const wallet = loadKeypair(KEYPAIR_PATH);
    console.log(` Address: ${wallet.publicKey.toBase58()}\n`);

    // Initialize connection
    const connection = new Connection(SOLANA_RPC, 'confirmed');

    // Get and display USDC ATA
    const usdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
    console.log(` USDC ATA: ${usdcAta.toBase58()}`);

    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    console.log(` SOL Balance: ${solBalance / 1e9} SOL`);

    if (solBalance < 0.01e9) {
      console.warn('\n Low SOL balance. You may need more SOL for transaction fees.');
      console.warn('   Run: solana airdrop 2 ' + wallet.publicKey.toBase58() + ' --url devnet\n');
    }

    // Endpoint - configurable via command line or environment
    const defaultEndpoint = process.argv[2] || process.env.DEMO_ENDPOINT || '/best-yield';
    const useMock = process.env.USE_MOCK === 'true';
    const endpoint = useMock ? `${defaultEndpoint}?mock=true` : defaultEndpoint;
    console.log(`\n Requesting: ${API_URL}${endpoint}`);

    // Step 1: Get payment requirements
    console.log('\n━━━ Step 1: Initial Request (402 Response) ━━━');
    const paymentReq = await getPaymentRequirements(endpoint);

    if (!paymentReq) {
      console.log('Endpoint is free, no payment needed.');
      return;
    }

    // Step 2: Send payment
    console.log('\n━━━ Step 2: Send Payment ━━━');
    const recipientPubkey = new PublicKey(paymentReq.recipient);
    const signature = await sendPayment(
      connection,
      wallet,
      recipientPubkey,
      paymentReq.amount
    );

    // Step 3: Create payment header
    console.log('━━━ Step 3: Create x402 Header ━━━');
    const paymentHeader = createX402Header(
      paymentReq.amount,
      wallet.publicKey.toBase58(),
      paymentReq.recipient,
      signature
    );
    console.log('✓ Payment header created\n');

    // Step 4: Request with payment
    console.log('━━━ Step 4: Request with Payment ━━━');
    const result = await requestWithPayment(endpoint, paymentHeader);

    console.log('✓ Data received!\n');
    console.log(' Response:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n Payment flow completed successfully!');
    console.log('\nNext steps:');
    console.log('  • Try other endpoints: /portfolio-analytics/:wallet, /risk-score/:wallet');
    console.log('  • View your transaction on Solana Explorer');
    console.log('  • Build your own AI agent using this payment flow\n');
  } catch (error) {
    console.error('\n Payment flow failed:', error);
    console.log('\nTroubleshooting:');
    console.log('  1. Ensure you have a funded wallet with devnet USDC');
    console.log('  2. Check that the API server is running (npm run dev)');
    console.log('  3. Verify your .env configuration');
    console.log('  4. Get devnet USDC from: https://faucet.circle.com/\n');
    process.exit(1);
  }
}

// Run the client
runClient().catch(console.error);
