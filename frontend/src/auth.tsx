'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, api, type Account } from './api/client';
import { ErrorNotice, Loading } from './components/ui';
interface Session {
  user: Account | null;
  ready: boolean;
  error?: unknown;
  signIn: (email: string, password: string) => Promise<void>;
  createSteward: (body: { email: string; password: string; name: string }) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<Session | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Sign-in state is unavailable.');
  return value;
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    let active = true;
    api
      .me()
      .then((result) => {
        if (active) setUser(result.data);
      })
      .catch(async (reason) => {
        if (!active) return;
        if (!(reason instanceof ApiError) || reason.status !== 401) {
          setError(reason);
          return;
        }
        setUser(null);
        try {
          const status = await api.status();
          if (active) setSetupRequired(status.data.setupRequired);
        } catch (statusError) {
          if (active) setError(statusError);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const session: Session = {
    user,
    ready,
    error,
    async signIn(email, password) {
      setUser((await api.login(email, password)).data);
      setSetupRequired(false);
    },
    async createSteward(body) {
      setUser((await api.setup(body)).data);
      setSetupRequired(false);
    },
    async signOut() {
      await api.logout();
      setUser(null);
      setSetupRequired(false);
    },
  };
  return (
    <AuthContext.Provider value={session}>
      {!ready ? (
        <Loading />
      ) : error ? (
        <ErrorNotice error={error} />
      ) : user ? (
        children
      ) : (
        <SignIn setupRequired={setupRequired} />
      )}
    </AuthContext.Provider>
  );
}
function SignIn({ setupRequired }: { setupRequired: boolean }) {
  const { signIn, createSteward } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (setupRequired) await createSteward({ email, password, name });
      else await signIn(email, password);
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  }
  return (
    <main className="sign-in" id="main">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          rZ
        </span>
        <span>
          Ricoz<span className="brand-light">Metrics</span>
        </span>
      </Link>
      <form className="panel panel-body" onSubmit={submit}>
        <h1>{setupRequired ? 'Create the steward account' : 'Sign in'}</h1>
        <p className="muted">
          {setupRequired
            ? 'The first account becomes the steward. It can certify metrics and add the rest of the team.'
            : 'Use the account a steward created for you. Consumers can view the catalogue. Engineers can draft metrics. Stewards certify them.'}
        </p>
        {setupRequired && (
          <label>
            Name
            <input
              required
              maxLength={120}
              value={name}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            autoComplete="username"
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={setupRequired ? 12 : 1}
            value={password}
            autoComplete={setupRequired ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          {setupRequired && <small>At least 12 characters.</small>}
        </label>
        <ErrorNotice error={error} />
        <button className="button" disabled={busy}>
          {busy ? 'Checking…' : setupRequired ? 'Create steward account' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
