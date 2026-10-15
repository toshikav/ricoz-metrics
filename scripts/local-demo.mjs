import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from '../backend/src/config/database.js';
import { setupFirstSteward } from '../backend/src/services/accounts.js';
import { demoSteward } from '../backend/src/demoAccount.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const repl = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  binary: { version: '7.0.24' },
});
await mongoose.connect(repl.getUri());
await initializeDatabase();
await setupFirstSteward(demoSteward);
const { default: app } = await import('../backend/src/app.js');
const server = app.listen(5000, '127.0.0.1');
const web = spawn(
  process.execPath,
  [
    resolve(root, 'node_modules/next/dist/bin/next'),
    process.env.NEXT_E2E_PRODUCTION === '1' ? 'start' : 'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    '5173',
  ],
  { cwd: resolve(root, 'frontend'), stdio: 'inherit', env: process.env },
);
console.log(
  'Disposable local workspace: http://localhost:5173. Sign in as ' +
    demoSteward.email +
    ' / ' +
    demoSteward.password +
    '. Data is discarded on exit.',
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  web.kill();
  server.close();
  await mongoose.disconnect();
  await repl.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
web.on('exit', stop);
