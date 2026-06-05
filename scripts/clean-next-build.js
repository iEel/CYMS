#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const NEXT_DIR = '.next';
const TOMBSTONE_PREFIX = '.next-delete-';

function resolveRepoPaths() {
  const root = path.resolve(process.cwd());
  const nextDir = path.resolve(root, NEXT_DIR);

  if (path.dirname(nextDir) !== root || path.basename(nextDir) !== NEXT_DIR) {
    throw new Error(`Refusing to clean unexpected path: ${nextDir}`);
  }

  return { root, nextDir };
}

function resolveTombstone(root, targetPath) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(root, resolved);

  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    !path.basename(resolved).startsWith(TOMBSTONE_PREFIX)
  ) {
    throw new Error(`Refusing to remove unexpected tombstone path: ${resolved}`);
  }

  return resolved;
}

function printLockedFileHelp(error, nextDir) {
  const code = error && typeof error === 'object' ? error.code : undefined;
  const locked = code === 'EPERM' || code === 'EBUSY' || code === 'ENOTEMPTY';
  if (!locked) return false;

  console.error('');
  console.error(`Cannot clean ${nextDir}.`);
  console.error('A Next.js dev server or another process is probably locking the build output.');
  console.error('');
  console.error('Stop the dev server, then retry:');
  console.error('  npm run clean:next');
  console.error('');
  console.error('For a production build after stopping dev server:');
  console.error('  npm run build:clean');
  console.error('');
  return true;
}

function printRepoPermissionHelp(error, root) {
  const code = error && typeof error === 'object' ? error.code : undefined;
  const denied = code === 'EPERM' || code === 'EACCES';
  if (!denied) return false;

  console.error('');
  console.error(`Cannot rename folders inside ${root}.`);
  console.error('This looks like a repo folder permission problem, not a Next.js build problem.');
  console.error('');
  console.error('Grant your Windows user Modify or Full Control on the project folder, then retry:');
  console.error('  npm run clean:next');
  console.error('');
  return true;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function deleteTombstone(root, targetPath) {
  const tombstone = resolveTombstone(root, targetPath);
  await fs.rm(tombstone, { recursive: true, force: true, maxRetries: 1, retryDelay: 100 });
}

function spawnTombstoneCleanup(tombstone) {
  const child = spawn(process.execPath, [__filename, '--delete-tombstone', tombstone], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  child.unref();
}

async function verifyRepoCanRenameDirectories(root) {
  const probe = path.resolve(root, `.next-clean-permission-probe-${Date.now()}-${process.pid}`);
  const renamedProbe = `${probe}-renamed`;

  try {
    await fs.mkdir(probe);
    await fs.rename(probe, renamedProbe);
    await fs.rm(renamedProbe, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(probe, { recursive: true, force: true }).catch(() => undefined);
    await fs.rm(renamedProbe, { recursive: true, force: true }).catch(() => undefined);
    if (printRepoPermissionHelp(error, root)) {
      process.exitCode = 1;
      return false;
    }
    throw error;
  }

  return true;
}

async function main() {
  const { root, nextDir } = resolveRepoPaths();

  if (process.argv[2] === '--delete-tombstone') {
    await deleteTombstone(root, process.argv[3] || '');
    return;
  }

  if (!(await pathExists(nextDir))) {
    console.log(`No ${NEXT_DIR} directory to clean`);
    return;
  }

  if (!(await verifyRepoCanRenameDirectories(root))) {
    return;
  }

  const tombstone = path.resolve(root, `${TOMBSTONE_PREFIX}${Date.now()}-${process.pid}`);

  try {
    await fs.rename(nextDir, tombstone);
    console.log(`Moved ${NEXT_DIR} to ${path.basename(tombstone)} for background cleanup`);
    console.log(`${NEXT_DIR} is ready for the next build`);
    spawnTombstoneCleanup(tombstone);
  } catch (error) {
    if (printLockedFileHelp(error, nextDir)) {
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
