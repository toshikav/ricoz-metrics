import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Braces, Check, Save } from 'lucide-react';
import { api } from '../api/client';
import { useLoad } from '../hooks/useLoad';
import { ErrorNotice, Loading, PageHeading } from '../components/ui';
import { type Definition, type Metric, type Validation, types, tiers, transitions } from '../types';
import { dependencies, definition, parameters } from '../metricInput';
const blank: Definition = {
  name: '',
  display_name: '',
  description: '',
  metric_type: 'BASE',
  domain: '',
  operational_tier: 'MEDIUM',
  calculation_logic: { sql_template: '', dependencies: [], parameters: {}, aggregation: 'sum' },
  state: 'DRAFT',
  created_by: '',
  steward: '',
  tags: [],
};
export default function MetricEditor() {
  const { id } = useParams();
  const state = useLoad(() => (id ? api.get(id) : Promise.resolve(undefined)), [id]);
  if (state.loading) return <Loading />;
  if (state.error) return <ErrorNotice error={state.error} retry={state.reload} />;
  return <Editor key={id || 'new'} existing={state.data?.data} />;
}
function Editor({ existing }: { existing?: Metric }) {
  const navigate = useNavigate(),
    [form, setForm] = useState<Definition>(existing ? definition(existing) : blank);
  const [tags, setTags] = useState(form.tags.join(', ')),
    [params, setParams] = useState(
      JSON.stringify(form.calculation_logic.parameters || {}, null, 2),
    );
  const [actor, setActor] = useState(''),
    [summary, setSummary] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [validation, setValidation] = useState<Validation>(),
    [dirty, setDirty] = useState(false);
  const frozen = existing?.state === 'CERTIFIED' || existing?.state === 'ARCHIVED';
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  function set<K extends keyof Definition>(key: K, value: Definition[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setValidation(undefined);
    setDirty(true);
  }
  function logic(key: string, value: unknown) {
    setForm((f) => ({ ...f, calculation_logic: { ...f.calculation_logic, [key]: value } }));
    setValidation(undefined);
    setDirty(true);
  }
  const sqlDeps = dependencies(form.calculation_logic.sql_template);
  function payload(): Definition {
    return {
      ...form,
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
      calculation_logic: {
        ...form.calculation_logic,
        parameters: parameters(params),
        dependencies: sqlDeps,
      },
    };
  }
  async function submit(e: React.FormEvent, save = true) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const body = payload(),
        r = await api.validate({ ...body, ...(existing ? { metric_id: existing._id } : {}) });
      setValidation(r.data);
      if (!r.data.valid || !save) return;
      const saved = existing
        ? await api.update(existing._id, {
            ...body,
            updated_by: actor,
            expected_version: existing.version,
            changes_summary: summary,
          })
        : await api.create(body);
      setDirty(false);
      navigate('/metrics/' + saved.data._id, {
        state: {
          saved: existing ? 'Changes saved.' : 'Metric created.',
          warnings: saved.validation?.warnings || saved.changeAnalysis?.warnings || [],
          breaking: saved.changeAnalysis?.is_breaking,
        },
      });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={existing ? '/metrics/' + existing._id : '/metrics'}>
        <ArrowLeft size={15} />
        Back to {existing ? 'metric' : 'catalogue'}
      </Link>
      <PageHeading
        eyebrow={'CATALOGUE / ' + (existing ? 'EDIT DEFINITION' : 'NEW DEFINITION')}
        title={existing ? 'Refine your metric.' : 'Give your metric a definition.'}
        description={
          existing
            ? 'Changes are validated and saved as a new revision.'
            : 'Start with a clear description, a business owner, and the calculation logic.'
        }
      />
      {existing?.state === 'ARCHIVED' ? (
        <div className="notice info">
          Archived definitions are read-only. Create a new metric to continue.
        </div>
      ) : (
        <form onSubmit={submit} className="editor-layout">
          <div>
            <fieldset disabled={busy} className="panel panel-body">
              <div className="section-heading">
                <span className="section-icon">
                  <Braces size={18} />
                </span>
                <div>
                  <h2>Metric definition</h2>
                  <p>The shared meaning behind the number.</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Display name
                  <input
                    required
                    maxLength={200}
                    value={form.display_name}
                    onChange={(e) => set('display_name', e.target.value)}
                    placeholder="Net revenue"
                  />
                </label>
                <label>
                  Metric key
                  <input
                    required
                    pattern="[a-z0-9_]+"
                    maxLength={100}
                    disabled={frozen}
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="net_revenue"
                  />
                  <small>Lowercase letters, numbers and underscores.</small>
                </label>
                <label className="full">
                  Business description
                  <textarea
                    required
                    maxLength={5000}
                    rows={3}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="What does this metric measure, and when should it be used?"
                  />
                </label>
                <label>
                  Metric type
                  <select
                    disabled={frozen}
                    value={form.metric_type}
                    onChange={(e) =>
                      set('metric_type', e.target.value as Definition['metric_type'])
                    }
                  >
                    {types.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Business domain
                  <input
                    required
                    maxLength={100}
                    value={form.domain}
                    onChange={(e) => set('domain', e.target.value)}
                    placeholder="Finance"
                  />
                </label>
                <label>
                  Operational tier
                  <select
                    value={form.operational_tier}
                    onChange={(e) =>
                      set('operational_tier', e.target.value as Definition['operational_tier'])
                    }
                  >
                    {tiers.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tags
                  <input
                    value={tags}
                    onChange={(e) => {
                      setTags(e.target.value);
                      setDirty(true);
                      setValidation(undefined);
                    }}
                    placeholder="revenue, monthly, reporting"
                  />
                  <small>Separate tags with commas.</small>
                </label>
              </div>
            </fieldset>
            <fieldset disabled={busy || frozen} className="panel panel-body">
              <div className="section-heading">
                <div>
                  <h2>Calculation logic</h2>
                  <p>
                    {frozen
                      ? 'Certified calculation logic is frozen. Create a replacement to change it.'
                      : 'Define a single SELECT statement using MySQL syntax.'}
                  </p>
                </div>
              </div>
              <label>
                SQL definition
                <textarea
                  className="sql-editor"
                  required
                  maxLength={20000}
                  spellCheck={false}
                  value={form.calculation_logic.sql_template}
                  onChange={(e) => logic('sql_template', e.target.value)}
                  placeholder="SELECT SUM(amount) AS net_revenue FROM orders"
                />
              </label>
              <div className="sql-help">
                Reference another metric with <code>{'${metric_name}'}</code>. Dependencies are
                derived from these placeholders; SQL is stored and analyzed, never executed.
              </div>
              <div className="dependency-chips">
                <span className="small muted">Dependencies</span>
                {sqlDeps.length ? (
                  sqlDeps.map((d) => (
                    <span className="code-chip" key={d}>
                      {d}
                    </span>
                  ))
                ) : (
                  <span className="small">No metric references</span>
                )}
              </div>
              <div className="form-grid">
                <label>
                  Aggregation
                  <select
                    value={form.calculation_logic.aggregation}
                    onChange={(e) => logic('aggregation', e.target.value)}
                  >
                    {['sum', 'avg', 'count', 'min', 'max', 'custom'].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Parameters (JSON)
                  <textarea
                    className="mono"
                    value={params}
                    rows={3}
                    onChange={(e) => {
                      setParams(e.target.value);
                      setDirty(true);
                      setValidation(undefined);
                    }}
                  />
                  <small>String values only. Stored as definition metadata.</small>
                </label>
              </div>
            </fieldset>
          </div>
          <div className="editor-aside">
            <fieldset disabled={busy} className="panel panel-body">
              <h2>Ownership & lifecycle</h2>
              <label>
                Creator email
                <input
                  type="email"
                  required
                  disabled={!!existing}
                  value={form.created_by}
                  onChange={(e) => set('created_by', e.target.value)}
                  placeholder="owner@company.com"
                />
              </label>
              <label>
                Data steward
                <input
                  maxLength={254}
                  value={form.steward}
                  required={form.state === 'CERTIFIED'}
                  onChange={(e) => set('steward', e.target.value)}
                  placeholder="Name or email"
                />
              </label>
              <label>
                Lifecycle state
                <select
                  value={form.state}
                  onChange={(e) => set('state', e.target.value as Definition['state'])}
                >
                  {(existing ? [existing.state, ...transitions[existing.state]] : ['DRAFT']).map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
              {existing && (
                <>
                  <label>
                    Your email
                    <input
                      type="email"
                      required
                      value={actor}
                      onChange={(e) => setActor(e.target.value)}
                      placeholder="editor@company.com"
                    />
                  </label>
                  <label>
                    Change summary
                    <textarea
                      required
                      maxLength={1000}
                      rows={3}
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Explain what changed and why."
                    />
                  </label>
                  <p className="small muted">
                    Editing version {existing.version}. A newer saved revision will require a
                    reload.
                  </p>
                </>
              )}
              <p className="small muted">
                Actor emails are recorded for history. They are not authenticated identities.
              </p>
            </fieldset>
            <ErrorNotice error={error} />
            {validation && (
              <div className={'notice ' + (validation.valid ? 'success' : 'error')} role="status">
                <div>
                  <strong>
                    {validation.valid ? 'Definition checks passed' : 'Definition needs correction'}
                  </strong>
                  {validation.errors.map((e) => (
                    <p key={e}>{e}</p>
                  ))}
                  {validation.warnings.map((w) => (
                    <p key={w}>Review: {w}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="editor-buttons">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={(e) => submit(e, false)}
              >
                <Check size={17} />
                Validate definition
              </button>
              <button className="button primary" disabled={busy}>
                <Save size={17} />
                {busy ? 'Checking definition…' : existing ? 'Save changes' : 'Create metric'}
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}
