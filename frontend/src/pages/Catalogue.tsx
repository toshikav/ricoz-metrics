import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../api/client';
import { useLoad } from '../hooks/useLoad';
import {
  Empty,
  ErrorNotice,
  Loading,
  MetricTable,
  PageHeading,
  Pager,
  label,
} from '../components/ui';
import { states, types } from '../types';
export default function Catalogue() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(params.get('search') || '');
  const state = useLoad(
    () =>
      api.list({
        search: params.get('search') || '',
        domain: params.get('domain') || '',
        state: params.get('state') || '',
        metric_type: params.get('metric_type') || '',
        page,
        limit: 12,
      }),
    [params.toString()],
  );
  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / CATALOGUE"
        title="Your shared metric dictionary."
        description="Discover the definition, owner and logic behind every number."
        action={
          <Link className="button primary" to="/metrics/new">
            <Plus size={17} />
            New metric
          </Link>
        }
      />
      <section className="panel">
        <div className="catalogue-toolbar">
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              set('search', search);
            }}
          >
            <Search size={19} />
            <input
              aria-label="Search metrics"
              placeholder="Search names, definitions or tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="search-submit">
              Search
            </button>
          </form>
          <span className="small muted ordered">
            <SlidersHorizontal size={15} /> Recently updated first
          </span>
        </div>
        <div className="filters">
          <label>
            State
            <select
              value={params.get('state') || ''}
              onChange={(e) => set('state', e.target.value)}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Metric type
            <select
              value={params.get('metric_type') || ''}
              onChange={(e) => set('metric_type', e.target.value)}
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Business domain
            <input
              value={params.get('domain') || ''}
              placeholder="All domains"
              onChange={(e) => set('domain', e.target.value)}
            />
          </label>
          {params.toString() && (
            <button
              className="text-button"
              onClick={() => {
                setParams({});
                setSearch('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <ErrorNotice error={state.error} retry={state.reload} />
        {state.loading ? (
          <Loading />
        ) : (
          state.data && (
            <>
              {state.data.data.length ? (
                <MetricTable metrics={state.data.data} />
              ) : (
                <Empty
                  title="No matching metrics"
                  description="Try a different search or clear your filters. You can also create a new definition."
                />
              )}
              <Pager
                page={page}
                pages={state.data.pages}
                total={state.data.total}
                onPage={(p) => set('page', String(p))}
              />
            </>
          )
        )}
      </section>
    </>
  );
}
