import { useState } from 'react';
import { Check, Play, GitCompareArrows } from 'lucide-react';
import { api } from '../api/client';
import { PageHeading, ErrorNotice, Json } from '../components/ui';
export default function SqlTools() {
  const [mode, setMode] = useState<'validate' | 'compare'>('validate'),
    [sql, setSql] = useState(''),
    [newSql, setNewSql] = useState(''),
    [result, setResult] = useState<unknown>(),
    [summary, setSummary] = useState(''),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const clear = () => {
    setResult(undefined);
    setSummary('');
    setError(undefined);
  };
  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    clear();
    try {
      if (mode === 'validate') {
        const r = await api.validateSQL(sql);
        setResult(r.data);
        setSummary(r.data.valid ? 'Valid SELECT statement' : 'SQL needs correction');
      } else {
        const r = await api.compare(sql, newSql);
        setResult(r.data);
        setSummary(r.data.summary);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="TOOLS / SQL WORKBENCH"
        title="Inspect the logic behind the metric."
        description="Validate a definition or compare two versions before making a change."
      />
      <section className="panel">
        <div className="tab-bar">
          <button
            className={mode === 'validate' ? 'active' : ''}
            onClick={() => {
              setMode('validate');
              clear();
            }}
            disabled={busy}
          >
            <Check size={17} />
            Validate SQL
          </button>
          <button
            className={mode === 'compare' ? 'active' : ''}
            onClick={() => {
              setMode('compare');
              clear();
            }}
            disabled={busy}
          >
            <GitCompareArrows size={17} />
            Compare revisions
          </button>
        </div>
        <form className="panel-body" onSubmit={run}>
          <div className={'sql-grid ' + (mode === 'compare' ? 'two' : '')}>
            <label>
              {mode === 'compare' ? 'Original SQL' : 'SQL definition'}
              <textarea
                className="sql-editor"
                spellCheck={false}
                required
                maxLength={20000}
                value={sql}
                onChange={(e) => {
                  setSql(e.target.value);
                  clear();
                }}
                placeholder="SELECT SUM(amount) AS revenue FROM orders"
              />
            </label>
            {mode === 'compare' && (
              <label>
                Proposed SQL
                <textarea
                  className="sql-editor"
                  spellCheck={false}
                  required
                  maxLength={20000}
                  value={newSql}
                  onChange={(e) => {
                    setNewSql(e.target.value);
                    clear();
                  }}
                  placeholder="SELECT SUM(net_amount) AS revenue FROM orders"
                />
              </label>
            )}
          </div>
          <div className="form-actions">
            <p className="muted small">
              MySQL syntax · One SELECT statement · Queries are never executed
            </p>
            <button className="button primary" disabled={busy}>
              <Play size={16} />
              {busy ? 'Analyzing…' : mode === 'validate' ? 'Validate SQL' : 'Compare SQL'}
            </button>
          </div>
        </form>
      </section>
      <ErrorNotice error={error} />
      {result !== undefined && (
        <section className="panel panel-body result-panel" aria-live="polite">
          <div className="eyebrow">ANALYSIS RESULTS</div>
          <pre className="summary-text">{summary}</pre>
          <Json value={result} title="Full analysis and SQL metadata" />
        </section>
      )}
    </>
  );
}
