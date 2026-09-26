import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  Clock3,
  GitBranch,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';
import { useLoad } from '../hooks/useLoad';
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  MetricTable,
  PageHeading,
  label,
} from '../components/ui';
import { states } from '../types';
export default function Dashboard() {
  const state = useLoad(async () => {
    const [summary, recent, breaking] = await Promise.all([
      api.summary(),
      api.list({ limit: 5 }),
      api.breaking(1, 3),
    ]);
    return { summary: summary.data, recent, breaking };
  });
  const { data } = state;
  const count = (key: string) => data?.summary.byState.find((r) => r._id === key)?.count || 0;
  return (
    <>
      <PageHeading
        eyebrow="CATALOGUE / OVERVIEW"
        title="A clear view of your metrics."
        description="Track definitions, follow changes, and keep your team on the same page."
        action={
          <Link className="button primary" to="/metrics/new">
            <Plus size={17} />
            New metric
          </Link>
        }
      />
      <ErrorNotice error={state.error} retry={state.reload} />
      {state.loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats-grid">
              {[
                {
                  label: 'Total definitions',
                  value: data.summary.total,
                  icon: BookOpen,
                  note: data.summary.domains.length + ' business domains',
                  className: 'blue',
                },
                {
                  label: 'Certified metrics',
                  value: count('CERTIFIED'),
                  icon: ShieldCheck,
                  note: 'Reviewed and ready to use',
                  className: 'green',
                },
                {
                  label: 'Awaiting review',
                  value: count('IN_REVIEW'),
                  icon: Clock3,
                  note: 'Ready for steward review',
                  className: 'amber',
                },
                {
                  label: 'Breaking revisions',
                  value: data.breaking.total,
                  icon: GitBranch,
                  note: 'Recorded across all versions',
                  className: 'purple',
                },
              ].map((s) => (
                <section className="stat" key={s.label}>
                  <div>
                    <span>{s.label}</span>
                    <s.icon size={19} className={s.className} />
                  </div>
                  <strong>{s.value.toLocaleString()}</strong>
                  <small>{s.note}</small>
                </section>
              ))}
            </div>
            <section className="panel lifecycle-panel">
              <div className="panel-heading">
                <div>
                  <h2>The metric lifecycle</h2>
                  <p>From a working definition to a trusted reference.</p>
                </div>
                <span className="small muted">CURRENT DISTRIBUTION</span>
              </div>
              <div className="lifecycle">
                {states.map((s, i) => (
                  <Link
                    to={'/metrics?state=' + s}
                    className={'lifecycle-step ' + s.toLowerCase()}
                    key={s}
                  >
                    <div>
                      <span className="stage-dot" />
                      <span>{label(s)}</span>
                      {i < 4 && <ArrowRight size={15} />}
                    </div>
                    <strong>
                      {count(s)}
                      <small>metrics</small>
                    </strong>
                    <div className="stage-track">
                      <i
                        style={{
                          width:
                            (data.summary.total ? (count(s) / data.summary.total) * 100 : 0) + '%',
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
            <div className="dashboard-columns">
              <section className="panel recent-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recently updated</h2>
                    <p>The latest definitions in your catalogue.</p>
                  </div>
                  <Link className="text-link" to="/metrics">
                    View all <ArrowUpRight size={16} />
                  </Link>
                </div>
                {data.recent.data.length ? (
                  <MetricTable metrics={data.recent.data} />
                ) : (
                  <Empty
                    action={
                      <Link className="button secondary" to="/metrics/new">
                        <Plus size={16} />
                        Create first metric
                      </Link>
                    }
                  />
                )}
              </section>
              <section className="panel domains-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Business domains</h2>
                    <p>Where your definitions live.</p>
                  </div>
                </div>
                {data.summary.domains.length ? (
                  <div className="domain-list">
                    {data.summary.domains.slice(0, 6).map((d, i) => (
                      <Link to={'/metrics?domain=' + encodeURIComponent(d._id)} key={d._id}>
                        <span className="domain-symbol">{d._id.slice(0, 1).toUpperCase()}</span>
                        <span>
                          <strong>{d._id}</strong>
                          <span className="domain-track">
                            <i style={{ width: (d.count / data.summary.total) * 100 + '%' }} />
                          </span>
                        </span>
                        <b>{d.count}</b>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="compact-empty">Domains appear when you add metrics.</div>
                )}
                <div className="panel-footnote">
                  <CheckCheck size={15} />
                  Counts cover the entire catalogue.
                </div>
              </section>
            </div>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Changes to review</h2>
                  <p>Calculation revisions that may affect downstream results.</p>
                </div>
                <Link className="text-link" to="/changes">
                  Open change review <ArrowUpRight size={16} />
                </Link>
              </div>
              {data.breaking.data.length ? (
                data.breaking.data.map((b, i) => (
                  <Link
                    className="change-row"
                    key={b.metric.id + '-' + b.latestVersion}
                    to={b.is_deleted ? '/changes' : '/metrics/' + b.metric.id}
                  >
                    <span className="change-symbol">
                      <GitBranch size={19} />
                    </span>
                    <div>
                      <strong>{b.metric.display_name}</strong>
                      <p>
                        {b.is_deleted ? 'Definition deleted · ' : ''}
                        {b.summary}
                      </p>
                    </div>
                    <Badge value={b.analysis.severity} />
                    <span className="mono small">v{b.latestVersion}</span>
                    <ArrowRight size={16} />
                  </Link>
                ))
              ) : (
                <div className="quiet-state">
                  <CheckCheck size={20} />
                  <div>
                    <strong>No breaking revisions recorded</strong>
                    <p>Changes to calculation logic will appear here after saving.</p>
                  </div>
                </div>
              )}
            </section>
            <div className="distribution">
              <span>Definition types</span>
              {data.summary.byType.map((t) => (
                <span key={t._id}>
                  <b>{t.count}</b> {label(t._id)}
                </span>
              ))}
              <span className="distribution-divider">Priority tiers</span>
              {data.summary.byTier.map((t) => (
                <span key={t._id}>
                  <b>{t.count}</b> {label(t._id)}
                </span>
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}
