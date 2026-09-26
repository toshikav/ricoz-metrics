import { Router } from 'express';
import mongoose from 'mongoose';
const router = Router();
router.get('/', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: connected ? 'Connected' : 'Disconnected',
    version: '1.1.0',
    access: 'Internal workspace; no application authentication',
  });
});
export default router;
