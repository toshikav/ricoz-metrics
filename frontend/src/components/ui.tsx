import { useEffect, useRef, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Metric } from '../types';
export const label = (s: string) =>
  s
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (c) => c.toUpperCase());
export const date = (s?: string) =>
  s
    ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
export function Badge({ value }: { value: string }) {
  return (
    <span className={'badge ' + value.toLowerCase()}>
      <i />
      {label(value)}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={22} className="spin" /> Loading workspace data…
    </div>
  );
}
export function Json({ value, title = 'View full response' }: { value: unknown; title?: string }) {
  return (
    <details className="json">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={19} />
      <div>
        <strong>{error instanceof Error ? error.message : String(error)}</strong>
        {error instanceof ApiError && error.details !== undefined && (
          <Json value={error.details} title="Validation details" />
        )}
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = 'No metrics yet',
  description = 'Create your first metric to give your team a shared definition.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={27} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Pager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        {total} results · Page {page} of {Math.max(1, pages)}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function MetricTable({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Metric definition</th>
            <th>Domain</th>
            <th>State</th>
            <th>Type</th>
            <th>Updated</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m._id}>
              <td>
                <Link className="metric-title" to={'/metrics/' + m._id}>
                  {m.display_name}
                </Link>
                <div className="mono muted small">{m.name}</div>
              </td>
              <td>{m.domain}</td>
              <td>
                <Badge value={m.state} />
              </td>
              <td>
                <span className="type-label">{label(m.metric_type)}</span>
              </td>
              <td className="muted nowrap">{date(m.updatedAt)}</td>
              <td>
                <Link
                  className="icon-button"
                  to={'/metrics/' + m._id}
                  aria-label={'Open ' + m.display_name}
                >
                  <ArrowRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="dialog-title"
    >
      <header>
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={close}>
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
