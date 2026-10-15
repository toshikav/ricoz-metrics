import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Session from '../models/Session.js';
import AuthState from '../models/AuthState.js';
import { hashPassword, verifyPassword, burnPasswordCheck } from './password.js';
import { parse, fail, email } from '../validation.js';
import { z } from 'zod';
const password = z.string().min(12, 'Use at least 12 characters.').max(200);
const person = z.string().trim().min(1).max(120);
export const registerSchema = z.strictObject({
  email,
  password,
  name: person,
  role: z.enum(['consumer', 'engineer', 'steward']).default('consumer'),
});
export const setupSchema = registerSchema.omit({ role: true });
export const loginSchema = z.strictObject({ email, password: z.string().min(1).max(200) });
const SESSION_MS = 12 * 60 * 60 * 1000;
export const cookieName = 'ricoz_session';
export function publicUser(user) {
  return { id: String(user._id), email: user.email, name: user.name, role: user.role };
}
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MS,
  };
}
function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}
export async function openSession(user) {
  const token = randomBytes(32).toString('base64url');
  await Session.create({
    tokenHash: tokenHash(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  return token;
}
export async function userForToken(token) {
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: tokenHash(token) });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await session.deleteOne();
    return null;
  }
  return User.findById(session.userId);
}
export async function closeSession(token) {
  if (token) await Session.deleteOne({ tokenHash: tokenHash(token) });
}
export async function setupRequired() {
  return (await AuthState.countDocuments({ _id: 'setup' })) === 0;
}
function duplicateKey(error) {
  return [error, error?.cause, error?.errorResponse].some((item) => item?.code === 11000);
}
export async function setupFirstSteward(input) {
  const data = parse(setupSchema, input);
  const passwordHash = await hashPassword(data.password);
  try {
    return await mongoose.connection.transaction(async (session) => {
      await AuthState.create([{ _id: 'setup' }], { session });
      const [user] = await User.create(
        [{ email: data.email, name: data.name, passwordHash, role: 'steward' }],
        { session },
      );
      return user;
    });
  } catch (error) {
    if (error?.statusCode === 409) throw error;
    if (duplicateKey(error)) throw fail('Setup is already complete.', 409);
    throw error;
  }
}
export async function authenticate(input) {
  const data = parse(loginSchema, input);
  const user = await User.findOne({ email: data.email.toLowerCase() });
  if (!user) {
    await burnPasswordCheck();
    throw fail('Email or password is incorrect.', 401);
  }
  if (!(await verifyPassword(data.password, user.passwordHash)))
    throw fail('Email or password is incorrect.', 401);
  return user;
}
export async function createAccount(input) {
  const data = parse(registerSchema, input);
  try {
    return await User.create({
      email: data.email,
      name: data.name,
      role: data.role,
      passwordHash: await hashPassword(data.password),
    });
  } catch (error) {
    if (duplicateKey(error)) throw fail('An account with this email already exists.', 409);
    throw error;
  }
}
export async function changeRole(id, role) {
  const next = parse(z.enum(['consumer', 'engineer', 'steward']), role);
  if (!/^[a-f0-9]{24}$/i.test(id)) throw fail('Invalid account ID.');
  const user = await User.findById(id);
  if (!user) throw fail('Account not found.', 404);
  if (user.role === 'steward' && next !== 'steward') {
    const stewards = await User.countDocuments({ role: 'steward' });
    if (stewards <= 1) throw fail('The catalogue needs at least one steward.', 409);
  }
  user.role = next;
  await user.save();
  return user;
}
export async function bootstrapStewardFromEnv() {
  const address = process.env.BOOTSTRAP_STEWARD_EMAIL?.trim();
  const secret = process.env.BOOTSTRAP_STEWARD_PASSWORD;
  if (!address && !secret) return;
  if (!address || !secret)
    throw new Error('Set both BOOTSTRAP_STEWARD_EMAIL and BOOTSTRAP_STEWARD_PASSWORD.');
  if (!(await setupRequired())) return;
  await setupFirstSteward({ email: address, password: secret, name: 'Catalogue steward' });
}
