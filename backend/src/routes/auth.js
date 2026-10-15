import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as c from '../controllers/authController.js';
import { requireSteward, requireUser } from '../middleware/auth.js';
const router = Router();
const attempts = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many sign-in attempts. Retry in a few minutes.' },
  },
});
router.get('/status', c.status);
router.post('/setup', attempts, c.setup);
router.post('/login', attempts, c.login);
router.post('/logout', c.logout);
router.get('/me', requireUser, c.me);
router.get('/users', requireUser, requireSteward, c.listUsers);
router.post('/users', requireUser, requireSteward, c.addUser);
router.patch('/users/:id', requireUser, requireSteward, c.setRole);
export default router;
