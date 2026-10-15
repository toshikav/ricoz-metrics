import User from '../models/User.js';
import {
  authenticate,
  changeRole,
  createAccount,
  openSession,
  publicUser,
  setupFirstSteward,
  setupRequired,
} from '../services/accounts.js';
import { endSession, sendSession } from '../middleware/auth.js';
import { parse, fail } from '../validation.js';
import { z } from 'zod';
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
export const status = route(async (req, res) => {
  res.json({ success: true, data: { setupRequired: await setupRequired() } });
});
export const setup = route(async (req, res) => {
  const user = await setupFirstSteward(req.body);
  sendSession(res, await openSession(user));
  res.status(201).json({ success: true, data: publicUser(user) });
});
export const login = route(async (req, res) => {
  const user = await authenticate(req.body);
  sendSession(res, await openSession(user));
  res.json({ success: true, data: publicUser(user) });
});
export const logout = route(async (req, res) => {
  await endSession(req, res);
  res.json({ success: true, data: {} });
});
export const me = route(async (req, res) => {
  res.json({ success: true, data: req.user });
});
export const listUsers = route(async (req, res) => {
  const users = await User.find().sort({ email: 1 }).lean();
  res.json({ success: true, data: users.map(publicUser) });
});
export const addUser = route(async (req, res) => {
  const user = await createAccount(req.body);
  res.status(201).json({ success: true, data: publicUser(user) });
});
export const setRole = route(async (req, res) => {
  const { role } = parse(
    z.strictObject({ role: z.enum(['consumer', 'engineer', 'steward']) }),
    req.body,
  );
  if (!req.user) throw fail('Sign in to continue.', 401);
  const user = await changeRole(req.params.id, role);
  res.json({ success: true, data: publicUser(user) });
});
