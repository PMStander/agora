#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function resolveOpenClawBinary() {
  // 1. Try OPENCLAW_HOME env var (new in 2026.2.9)
  if (process.env.OPENCLAW_HOME) {
    const homeCandidate = resolve(process.env.OPENCLAW_HOME, 'bin', 'openclaw');
    if (existsSync(homeCandidate)) {
      console.log(`✓ Found via OPENCLAW_HOME: ${homeCandidate}`);
      return homeCandidate;
    }
  }

  // 2. Try openclaw in PATH first (handles nvm when PATH is inherited)
  const pathResult = spawnSync('which', ['openclaw'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (pathResult.status === 0 && pathResult.stdout.trim()) {
    const pathBinary = pathResult.stdout.trim();
    console.log(`✓ Found in PATH: ${pathBinary}`);
    return pathBinary;
  }

  // 3. Search common installation paths
  const homeDir = process.env.HOME || '/Users/peetstander';
  const nvmNodeVersion = process.env.NVM_BIN
    ? process.env.NVM_BIN.split('/').slice(-2, -1)[0]
    : null;

  const candidatePaths = [
    // nvm (current version from NVM_BIN)
    nvmNodeVersion ? `${homeDir}/.nvm/versions/node/${nvmNodeVersion}/bin/openclaw` : null,
    // nvm (fallback to common LTS versions)
    `${homeDir}/.nvm/versions/node/v22.19.0/bin/openclaw`,
    `${homeDir}/.nvm/versions/node/v20.18.1/bin/openclaw`,
    `${homeDir}/.nvm/versions/node/v18.20.5/bin/openclaw`,
    // Homebrew
    '/opt/homebrew/bin/openclaw',
    '/usr/local/bin/openclaw',
    // Global npm (homebrew node)
    '/opt/homebrew/Cellar/node/23.2.0/bin/openclaw',
    `${homeDir}/.npm-global/bin/openclaw`,
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      console.log(`✓ Found in search paths: ${candidate}`);
      return candidate;
    }
  }

  // 4. Fallback to 'openclaw' and hope it's in PATH
  console.log('⚠ openclaw binary not found in common paths, using PATH fallback');
  return 'openclaw';
}

console.log('Testing openclaw binary path resolution...\n');

console.log('Environment:');
console.log(`  HOME: ${process.env.HOME}`);
console.log(`  OPENCLAW_HOME: ${process.env.OPENCLAW_HOME || '(not set)'}`);
console.log(`  NVM_BIN: ${process.env.NVM_BIN || '(not set)'}`);
console.log(`  PATH: ${process.env.PATH?.split(':').slice(0, 3).join(':') || '(not set)'}...\n`);

const resolved = resolveOpenClawBinary();
console.log(`\n→ Resolved binary: ${resolved}`);

// Verify it's executable
if (resolved !== 'openclaw' && existsSync(resolved)) {
  console.log('✓ Binary exists on filesystem');
  
  const testResult = spawnSync(resolved, ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  
  if (testResult.status === 0) {
    console.log(`✓ Binary is executable: ${testResult.stdout.trim()}`);
  } else {
    console.log(`✗ Binary exists but may not be executable (exit code ${testResult.status})`);
  }
} else if (resolved === 'openclaw') {
  console.log('⚠ Using PATH fallback - cannot verify without running');
}
