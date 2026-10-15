import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { attachUser, requireUser } from './middleware/auth.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import metricsRouter from './routes/metrics.js';
import analysisRouter from './routes/analysis.js';
const app = express();
app.disable('x-powered-by');
app.set('query parser', 'simple');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json({ limit: '128kb' }));
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many requests. Retry in a minute.' } },
  }),
);
app.use('/api/health', healthRouter);
app.use('/api/v1', (req, res, next) =>
  mongoose.connection.readyState === 1
    ? next()
    : res.status(503).json({
        success: false,
        error: {
          message: 'Database unavailable. Please retry after the connection is restored.',
        },
      }),
);
app.use('/api/v1', attachUser);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/metrics', requireUser, metricsRouter);
app.use('/api/v1/analysis', requireUser, analysisRouter);
app.get('/', (req, res) =>
  res.json({
    name: 'RicozMetrics API',
    version: '1.1.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/v1/auth',
      metrics: '/api/v1/metrics',
      analysis: '/api/v1/analysis',
    },
  }),
);
app.use(notFound);
app.use(errorHandler);
export default app;
