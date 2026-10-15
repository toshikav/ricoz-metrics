import { fail } from '../validation.js';
import {
  closeSession,
  cookieName,
  cookieOptions,
  publicUser,
  userForToken,
} from '../services/accounts.js';
export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return;
  for (const part of header.split(';')) {
    const text = part.trim();
    const eq = text.indexOf('=');
    if (eq === -1) continue;
    if (text.slice(0, eq) === name) return decodeURIComponent(text.slice(eq + 1));
  }
}
export async function attachUser(req, res, next) {
  try {
    const token = readCookie(req, cookieName);
    const user = await userForToken(token);
    if (user) req.user = publicUser(user);
    next();
  } catch (error) {
    next(error);
  }
}
export function requireUser(req, res, next) {
  if (!req.user) return next(fail('Sign in to continue.', 401));
  next();
}
export function requireSteward(req, res, next) {
  if (!req.user) return next(fail('Sign in to continue.', 401));
  if (req.user.role !== 'steward') return next(fail('Only a steward can manage access.', 403));
  next();
}
const governed = new Set(['CERTIFIED', 'DEPRECATED', 'ARCHIVED']);
export function assertCatalogueWrite(user, { before = null, nextState = null, action }) {
  if (!user) throw fail('Sign in to continue.', 401);
  if (user.role === 'consumer')
    throw fail('Your account can view the catalogue but cannot change it.', 403);
  if (user.role === 'steward') return;
  if (action === 'delete') throw fail('Only a steward can delete a metric.', 403);
  if (before && governed.has(before.state))
    throw fail('Only a steward can change a metric after certification.', 403);
  if (nextState && governed.has(nextState) && nextState !== before?.state)
    throw fail('Only a steward can certify, deprecate, or archive a metric.', 403);
}
export function sendSession(res, token) {
  res.cookie(cookieName, token, cookieOptions());
}
export async function endSession(req, res) {
  await closeSession(readCookie(req, cookieName));
  res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
}
