import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import connectDB from './config/database.js';
try {
  await connectDB();
  const server = app.listen(Number(process.env.PORT) || 5000, process.env.HOST || '0.0.0.0', () =>
    console.log('RicozMetrics API listening on port ' + (process.env.PORT || 5000)),
  );
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      await mongoose.disconnect();
      clearTimeout(deadline);
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error('Startup failed. Check MongoDB connectivity and replica-set configuration.');
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
}
