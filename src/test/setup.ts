/**
 * Test setup and configuration
 */

import { jest } from '@jest/globals';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.RPC = 'https://api.testnet.solana.com';
process.env.SECRET_KEY = 'test-secret-key';
process.env.API_KEY = 'test-api-key';
process.env.DEBUG = 'false';

// Mock Solana Web3.js
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(1000000000), // 1 SOL in lamports
    getLatestBlockhash: jest.fn().mockResolvedValue({
      blockhash: 'test-blockhash',
      lastValidBlockHeight: 1000
    }),
    sendTransaction: jest.fn().mockResolvedValue('test-signature'),
    confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } }),
    simulateTransaction: jest.fn().mockResolvedValue({ value: { err: null } }),
    getAccountInfo: jest.fn().mockResolvedValue(null),
    getTokenAccountBalance: jest.fn().mockResolvedValue({ value: { uiAmount: 0 } })
  })),
  Keypair: {
    generate: jest.fn().mockReturnValue({
      publicKey: { toString: () => 'test-public-key' },
      secretKey: new Uint8Array(64)
    }),
    fromSecretKey: jest.fn().mockReturnValue({
      publicKey: { toString: () => 'test-public-key' },
      secretKey: new Uint8Array(64)
    })
  },
  PublicKey: jest.fn().mockImplementation((key) => ({
    toString: () => key || 'test-public-key',
    toBase58: () => key || 'test-public-key'
  })),
  SystemProgram: {
    transfer: jest.fn().mockReturnValue({})
  },
  ComputeBudgetProgram: {
    setComputeUnitLimit: jest.fn().mockReturnValue({}),
    setComputeUnitPrice: jest.fn().mockReturnValue({})
  },
  TransactionMessage: jest.fn().mockImplementation(() => ({
    compileToV0Message: jest.fn().mockReturnValue({})
  })),
  VersionedTransaction: jest.fn().mockImplementation(() => ({
    sign: jest.fn(),
    serialize: jest.fn().mockReturnValue(Buffer.from('test-transaction'))
  }))
}));

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  statSync: jest.fn().mockReturnValue({
    birthtime: new Date(),
    size: 1000
  }),
  unlinkSync: jest.fn(),
  copyFileSync: jest.fn(),
  appendFileSync: jest.fn()
}));

// Mock path operations
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn((p) => p.split('/').pop())
}));

// Set test timeout
jest.setTimeout(30000);
