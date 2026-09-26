import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client';
import { useLoad } from '../hooks/useLoad';
import { PageHeading, ErrorNotice, Loading, Empty, Badge, Pager, date } from '../components/ui';
export default function BreakingChanges() {
  const [page, setPage] = useState(1),
    state = useLoad(() => api.breaking(page), [page]);
  return (
    <>
      <PageHeading
        eyebrow="GOVERNANCE / CHANGE REVIEW"
        title="Understand what changed."
        description="A permanent record of revisions that may change the meaning of a metric."
      />
      <div className="notice info">
        <GitBranch size={19} />
        <span>
          Static analysis flags potential breaking changes. Review the definition and downstream
          impact before using a replacement.
        </span>
      </div>
      <ErrorNotice error={state.error} retry={state.reload} />
      {state.loading ? (
        <Loading />
      ) : (
        state.data && (
          <section className="panel">
            {state.data.data.length ? (
              state.data.data.map((b) => (
                <article className="breaking-card" key={b.metric.id + '-' + b.latestVersion}>
                  <div className="breaking-title">
                    <div>
                      <span className="mono small muted">
                        {b.metric.name} · v{b.latestVersion}
                      </span>
                      <h2>{b.metric.display_name}</h2>
                    </div>
                    <Badge value={b.analysis.severity} />
                  </div>
                  <p>{b.summary}</p>
                  <p className="muted">{b.analysis.recommendation}</p>
                  <div className="tags">
                    {b.analysis.changed_fields.map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                  <div className="breaking-footer">
                    <small>
                      {date(b.createdAt)} · {b.changed_by}
                    </small>
                    {b.is_deleted ? (
                      <span className="small muted">Definition deleted · revision retained</span>
                    ) : (
                      <Link className="text-link" to={'/metrics/' + b.metric.id}>
                        View metric <ArrowUpRight size={16} />
                      </Link>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <Empty
                title="No breaking revisions recorded"
                description="Saved changes to calculation logic are tracked here, including older revisions."
              />
            )}
            <Pager page={page} pages={state.data.pages} total={state.data.total} onPage={setPage} />
          </section>
        )
      )}
    </>
  );
}
