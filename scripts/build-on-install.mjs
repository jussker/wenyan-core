import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const distWrapperPath = path.join(projectRoot, 'dist', 'wrapper.js');

function run(cmd, args, label) {
  console.log(`[core/install-build] ${label}: ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`[core/install-build] command failed: ${cmd} ${args.join(' ')}`);
  }
}

function ensureDistOnInstall() {
  if (existsSync(distWrapperPath)) {
    console.log('[core/install-build] dist already exists, skip build');
    return;
  }

  console.log('[core/install-build] dist missing, start build');

  try {
    run('npm', ['run', 'build'], 'using existing toolchain');
    return;
  } catch (error) {
    console.log(`[core/install-build] build failed with existing toolchain, fallback to bootstrap: ${String(error)}`);
  }

  run(
    'npm',
    [
      'install',
      '--no-save',
      '--include=dev',
      '--ignore-scripts',
      'form-data-encoder',
      'formdata-node',
    ],
    'bootstrap local build toolchain'
  );
  run('npm', ['run', 'build'], 'using bootstrapped local toolchain');
}

ensureDistOnInstall();
