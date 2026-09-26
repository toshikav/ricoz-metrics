import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from '../backend/src/config/database.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const repl = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  binary: { version: '7.0.24' },
});
await mongoose.connect(repl.getUri());
await initializeDatabase();
const { default: app } = await import('../backend/src/app.js');
const server = app.listen(5000, '127.0.0.1');
const vite = spawn(
  process.execPath,
  [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'],
  { cwd: resolve(root, 'frontend'), stdio: 'inherit', env: process.env },
);
console.log(
  'Disposable local workspace: http://localhost:5173. Starts empty; data is discarded on exit.',
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  vite.kill();
  server.close();
  await mongoose.disconnect();
  await repl.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
vite.on('exit', stop);
