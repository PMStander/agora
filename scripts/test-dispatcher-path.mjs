#!/usr/bin/env node

/**
 * Test the mission dispatcher's openclaw path resolution
 * by simulating a Tauri environment with restricted PATH
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

console.log('Testing mission dispatcher openclaw path resolution in restricted environment...\n');

// Simulate Tauri app environment with minimal PATH (no nvm, no homebrew)
const restrictedEnv = {
  ...process.env,
  PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
  // Remove nvm-related env vars that might help resolution
  NVM_BIN: undefined,
  NVM_DIR: undefined,
  NVM_CD_FLAGS: undefined,
  NVM_INC: undefined,
};

console.log('Environment:');
console.log(`  PATH: ${restrictedEnv.PATH}`);
console.log(`  OPENCLAW_HOME: ${restrictedEnv.OPENCLAW_HOME || '(not set)'}`);
console.log(`  NVM_BIN: ${restrictedEnv.NVM_BIN || '(not set)'}\n`);

// First, verify openclaw is NOT in the restricted PATH
const whichResult = spawn('which', ['openclaw'], {
  env: restrictedEnv,
  stdio: 'pipe',
});

whichResult.on('close', (code) => {
  if (code === 0) {
    console.log('⚠ openclaw is in restricted PATH - test may not be valid\n');
  } else {
    console.log('✓ openclaw NOT in restricted PATH (as expected)\n');
  }

  // Now run the dispatcher test
  console.log('Running dispatcher dry-run with restricted PATH...\n');
  
  const dispatcherTest = spawn(
    process.execPath, // Use current node binary
    ['scripts/mission-dispatcher.mjs', '--dry-run'],
    {
      cwd: '/Users/peetstander/Developer/agora',
      env: restrictedEnv,
      stdio: 'pipe',
    }
  );

  let output = '';
  dispatcherTest.stdout.on('data', (data) => {
    output += data.toString();
  });

  dispatcherTest.stderr.on('data', (data) => {
    output += data.toString();
  });

  dispatcherTest.on('close', (code) => {
    console.log('Dispatcher output:');
    console.log(output);
    
    if (code === 0) {
      console.log('\n✓ Dispatcher ran successfully without openclaw in PATH');
      console.log('✓ Path resolution is working correctly');
    } else {
      console.log(`\n✗ Dispatcher failed with exit code ${code}`);
      if (output.includes('ENOENT') && output.includes('openclaw')) {
        console.log('✗ Failed to resolve openclaw binary path');
      }
    }
  });
});
