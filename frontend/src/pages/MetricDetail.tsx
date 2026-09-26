import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Code2,
  GitBranch,
  History,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { api } from '../api/client';
import { useLoad } from '../hooks/useLoad';
import {
  Badge,
  Empty,
  ErrorNotice,
  Json,
  Loading,
  Modal,
  PageHeading,
  Pager,
  date,
  label,
} from '../components/ui';
import type { Metric, Tree } from '../types';
export default function MetricDetail() {
  const { id } = useParams(),
    state = useLoad(() => api.get(id!), [id]),
    [tab, setTab] = useState('definition'),
    [deleting, setDeleting] = useState(false),
    location = useLocation();
  const m = state.data?.data,
    saved = location.state as { saved?: string; warnings?: string[]; breaking?: boolean } | null;
  return (
    <>
      <Link className="back-link" to="/metrics">
        <ArrowLeft size={15} />
        Metric catalogue
      </Link>
      <ErrorNotice error={state.error} retry={state.reload} />
      {state.loading ? (
        <Loading />
      ) : (
        m && (
          <>
            <PageHeading
              eyebrow={'CATALOGUE / ' + m.domain.toUpperCase()}
              title={m.display_name}
              description={m.description}
              action={
                <div className="heading-actions">
                  {m.state !== 'ARCHIVED' && (
                    <Link className="button secondary" to={'/metrics/' + m._id + '/edit'}>
                      <Pencil size={16} />
                      Edit definition
                    </Link>
                  )}
                  <button
                    className="icon-button danger"
                    aria-label="Delete metric"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              }
            />
            {saved?.saved && (
              <div className="notice success" role="status">
                <ShieldCheck size={18} />
                <div>
                  <strong>{saved.saved}</strong>
                  {saved.breaking && (
                    <p>A potentially breaking revision was recorded. Review downstream impact.</p>
                  )}
                  {saved.warnings?.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="detail-meta">
              <Badge value={m.state} />
              <span className="mono">{m.name}</span>
              <span>Version {m.version}</span>
              <span>{label(m.metric_type)} metric</span>
              <span>{label(m.operational_tier)} priority</span>
            </div>
            <div className="tab-bar standalone">
              {[
                { id: 'definition', label: 'Definition', icon: Code2 },
                { id: 'lineage', label: 'Dependencies & impact', icon: GitBranch },
                { id: 'versions', label: 'Version history', icon: History },
                { id: 'audit', label: 'Audit log', icon: ShieldCheck },
              ].map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => setTab(t.id)}
                >
                  <t.icon size={17} />
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'definition' && (
              <div className="detail-columns">
                <section className="panel panel-body">
                  <div className="panel-heading plain">
                    <h2>Calculation logic</h2>
                    <span className="code-chip">{m.calculation_logic.aggregation}</span>
                  </div>
                  <pre className="sql-display">{m.calculation_logic.sql_template}</pre>
                  <p className="sql-help">
                    Static definition · MySQL syntax · Queries are not executed
                  </p>
                  <h3>Metric dependencies</h3>
                  <div className="tags">
                    {m.calculation_logic.dependencies.length ? (
                      m.calculation_logic.dependencies.map((d) => (
                        <span key={d} className="mono">
                          {d}
                        </span>
                      ))
                    ) : (
                      <p className="muted">This metric has no metric dependencies.</p>
                    )}
                  </div>
                  <Json value={m.calculation_logic.parameters} title="Definition parameters" />
                </section>
                <section className="panel panel-body ownership">
                  <h2>Ownership & context</h2>
                  <dl>
                    <dt>Creator</dt>
                    <dd>{m.created_by}</dd>
                    <dt>Data steward</dt>
                    <dd>{m.steward || 'Not assigned'}</dd>
                    <dt>Business domain</dt>
                    <dd>{m.domain}</dd>
                    <dt>Last updated</dt>
                    <dd>{date(m.updatedAt)}</dd>
                    <dt>Created</dt>
                    <dd>{date(m.createdAt)}</dd>
                    <dt>Last certified</dt>
                    <dd>{date(m.last_certified_at)}</dd>
                    <dt>Last editor</dt>
                    <dd>{m.last_modified_by || m.created_by}</dd>
                  </dl>
                  <div className="tags">
                    {m.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </section>
              </div>
            )}
            {tab === 'lineage' && <Lineage id={m._id} />}
            {tab === 'versions' && <VersionHistory id={m._id} />}
            {tab === 'audit' && <AuditHistory id={m._id} />}
            {deleting && <DeleteDialog metric={m} close={() => setDeleting(false)} />}
          </>
        )
      )}
    </>
  );
}
function TreeNode({ node }: { node: Tree }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <li>
      <div className="tree-node">
        {node.children?.length ? (
          <button
            className="icon-button"
            aria-label={'Toggle dependencies of ' + node.name}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <GitBranch size={15} />
          </button>
        ) : (
          <GitBranch size={15} />
        )}
        {node.id ? <Link to={'/metrics/' + node.id}>{node.name}</Link> : <span>{node.name}</span>}
        {node.state && <Badge value={node.state} />}
      </div>
      {node.error && <p>{node.error}</p>}
      {node.circular && <p className="error-text">Circular reference</p>}
      {expanded && node.children?.length ? (
        <ul>
          {node.children.map((n, i) => (
            <TreeNode key={n.name + i} node={n} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
function Lineage({ id }: { id: string }) {
  const s = useLoad(async () => {
    const [tree, impact, circular] = await Promise.all([
      api.tree(id),
      api.impact(id),
      api.circular(id),
    ]);
    return { tree: tree.data, impact: impact.data, circular: circular.data };
  }, [id]);
  return (
    <>
      <ErrorNotice error={s.error} retry={s.reload} />
      {s.loading ? (
        <Loading />
      ) : (
        s.data && (
          <>
            <section className="panel panel-body">
              <div className="panel-heading plain">
                <div>
                  <h2>Upstream definitions</h2>
                  <p>Follow the metric references used in this definition.</p>
                </div>
                <Badge value={s.data.circular.hasCircular ? 'CRITICAL' : 'LOW'} />
              </div>
              <ul className="dependency-tree">
                <TreeNode node={s.data.tree} />
              </ul>
              <p className="small muted">
                {s.data.circular.hasCircular
                  ? 'Cycle: ' + s.data.circular.path.join(' → ')
                  : 'No circular dependencies detected.'}{' '}
                This view shows metric references, not column-level lineage.
              </p>
            </section>
            <section className="panel panel-body">
              <div className="panel-heading plain">
                <div>
                  <h2>Downstream impact</h2>
                  <p>Direct and transitive dependents, each counted once.</p>
                </div>
                <Badge value={s.data.impact.impactAnalysis.riskLevel} />
              </div>
              <div className="impact-stats">
                <div>
                  <strong>{s.data.impact.impactAnalysis.totalAffected}</strong>
                  <span>Affected metrics</span>
                </div>
                <div>
                  <strong>{s.data.impact.impactAnalysis.certifiedAffected}</strong>
                  <span>Certified dependents</span>
                </div>
                <div>
                  <strong>{s.data.impact.impactAnalysis.criticalAffected}</strong>
                  <span>Critical dependents</span>
                </div>
                <div>
                  <strong>
                    {s.data.impact.impactAnalysis.impactScore}
                    <small>/100</small>
                  </strong>
                  <span>Heuristic risk score</span>
                </div>
              </div>
              {s.data.impact.downstream.length ? (
                s.data.impact.downstream.map((d) => (
                  <Link className="change-row" key={d.id} to={'/metrics/' + d.id}>
                    <div>
                      <strong>{d.display_name}</strong>
                      <p>{d.depth === 1 ? 'Direct dependency' : d.depth + ' steps downstream'}</p>
                    </div>
                    <Badge value={d.state} />
                    <ArrowUpRight size={16} />
                  </Link>
                ))
              ) : (
                <p className="muted">No other metrics reference this definition.</p>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
function VersionHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    s = useLoad(() => api.versions(id, page), [id, page]);
  return (
    <>
      <ErrorNotice error={s.error} retry={s.reload} />
      {s.loading ? (
        <Loading />
      ) : (
        s.data && (
          <section className="panel">
            {s.data.data.map((v) => (
              <article className="history-entry" key={v._id}>
                <span className="version-mark">v{v.version}</span>
                <div>
                  <div className="history-title">
                    <h3>{v.changes_summary}</h3>
                    {v.is_breaking && <Badge value="HIGH" />}
                  </div>
                  <p className="muted small">
                    {v.changed_by} · {date(v.createdAt)} · {label(v.change_type)}
                  </p>
                  <div className="tags">
                    {v.changed_fields.map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                  <Json value={v.snapshot} title="View complete definition snapshot" />
                </div>
              </article>
            ))}
            {!s.data.data.length && (
              <Empty title="No versions recorded" description="Saved revisions will appear here." />
            )}
            <Pager page={page} pages={s.data.pages} total={s.data.total} onPage={setPage} />
          </section>
        )
      )}
    </>
  );
}
function AuditHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1),
    s = useLoad(() => api.audit(id, page), [id, page]);
  return (
    <>
      <div className="notice info">
        <ShieldCheck size={18} />
        <span>
          Events are hash-linked across the catalogue. This is an integrity aid, not independently
          verified immutability or authenticated actor identity.
        </span>
      </div>
      <ErrorNotice error={s.error} retry={s.reload} />
      {s.loading ? (
        <Loading />
      ) : (
        s.data && (
          <section className="panel">
            {s.data.data.map((a) => (
              <article className="history-entry" key={a._id}>
                <span className="audit-mark">
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <div className="history-title">
                    <h3>{a.summary}</h3>
                    <Badge value={a.event_type} />
                  </div>
                  <p className="small muted">
                    {a.actor} · {date(a.occurred_at)} · Event #{a.sequence}
                  </p>
                  <code className="hash">{a.current_hash}</code>
                  <Json value={a.changes} title="Before and after" />
                </div>
              </article>
            ))}
            {!s.data.data.length && (
              <Empty title="No audit events" description="Catalogue actions will appear here." />
            )}
            <Pager page={page} pages={s.data.pages} total={s.data.total} onPage={setPage} />
          </section>
        )
      )}
    </>
  );
}
function DeleteDialog({ metric, close }: { metric: Metric; close: () => void }) {
  const [actor, setActor] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    navigate = useNavigate();
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api.remove(metric._id, actor, metric.version);
      navigate('/metrics');
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Delete this metric?"
      close={() => {
        if (!busy) close();
      }}
    >
      <form onSubmit={remove}>
        <p>
          The definition will be removed from the catalogue. Version history and audit events are
          retained. Metrics with dependents cannot be deleted.
        </p>
        <label>
          Your email
          <input
            type="email"
            required
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Type <code>{metric.name}</code> to confirm
          <input
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={busy}
          />
        </label>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="button destructive" disabled={busy || confirmation !== metric.name}>
            {busy ? 'Deleting…' : 'Delete metric'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
