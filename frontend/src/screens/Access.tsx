'use client';
import { useState } from 'react';
import { api, type Account, type Role } from '../api/client';
import { useAuth } from '../auth';
import { ErrorNotice, Loading, PageHeading } from '../components/ui';
import { useLoad } from '../hooks/useLoad';
const roles: Role[] = ['consumer', 'engineer', 'steward'];
export default function Access() {
  const { user } = useAuth();
  const accounts = useLoad(() => api.users(), []);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('engineer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState('');
  if (!user) return null;
  if (user.role !== 'steward')
    return (
      <PageHeading
        eyebrow="ACCESS"
        title="Stewards manage accounts"
        description="Your role can use the catalogue, but only a steward can add people or change roles."
      />
    );
  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setNotice('');
    try {
      await api.addUser({ email, name, password, role });
      setEmail('');
      setName('');
      setPassword('');
      setNotice('Account created.');
      accounts.reload();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }
  async function change(account: Account, next: Role) {
    setError(undefined);
    try {
      await api.setRole(account.id, next);
      accounts.reload();
    } catch (reason) {
      setError(reason);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ACCESS"
        title="People and roles"
        description="Consumers view the catalogue. Engineers draft and submit metrics. Stewards certify, archive and delete."
      />
      <ErrorNotice error={error} />
      {notice && (
        <div className="notice success" role="status">
          <span>{notice}</span>
        </div>
      )}
      <form className="panel panel-body" onSubmit={add}>
        <h2>Add an account</h2>
        <div className="form-grid">
          <label>
            Name
            <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={12}
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={busy}>
              {roles.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Create account'}
        </button>
      </form>
      {accounts.loading ? (
        <Loading />
      ) : accounts.error ? (
        <ErrorNotice error={accounts.error} retry={accounts.reload} />
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {accounts.data?.data.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{account.email}</td>
                  <td>
                    <select
                      aria-label={'Role for ' + account.name}
                      value={account.role}
                      onChange={(e) => change(account, e.target.value as Role)}
                    >
                      {roles.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
