#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

// Resolve dist/server.js relative to this bin file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distServer = resolve(__dirname, '..', 'dist', 'src', 'server.js');

if (!existsSync(distServer)) {
  console.error('[merkl-mcp] Build output not found. Building now...');
  const build = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit'
  });
  build.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);
    run();
  });
} else {
  run();
}

function run() {
  const child = spawn(process.execPath, [distServer], {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}
