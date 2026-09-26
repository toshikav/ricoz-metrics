import type {
  Audit,
  Breaking,
  Definition,
  Impact,
  Metric,
  Page,
  Summary,
  Tree,
  Validation,
  Version,
} from '../types';
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(base + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new ApiError(
        'The server returned an unreadable response. Check the API address and retry.',
        response.status,
      );
    }
    if (!response.ok)
      throw new ApiError(
        body.error?.message || 'The service is unavailable. Please retry.',
        response.status,
        body.error?.details,
      );
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error && error.name === 'AbortError'
        ? 'The request timed out. Check the connection and retry.'
        : 'Cannot reach the API. Check that the backend is running and retry.',
    );
  } finally {
    clearTimeout(timer);
  }
}
const query = (values: Record<string, string | number>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v !== '') q.set(k, String(v));
  return '?' + q;
};
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
type One<T> = { success: boolean; data: T };
type Saved = One<Metric> & {
  validation?: { warnings: string[] };
  changeAnalysis?: { warnings: string[]; is_breaking: boolean };
};
const metricPath = (id: string) => '/api/v1/metrics/' + encodeURIComponent(id);
const analysisPath = (id: string, action: string) =>
  '/api/v1/analysis/metrics/' + encodeURIComponent(id) + '/' + action;
export const api = {
  health: () =>
    request<{ status: string; database: string; version: string; access: string }>('/api/health'),
  list: (filters: Record<string, string | number> = {}) =>
    request<Page<Metric>>('/api/v1/metrics' + query(filters)),
  summary: () => request<One<Summary>>('/api/v1/metrics/summary'),
  get: (id: string) => request<One<Metric>>(metricPath(id)),
  create: (body: Definition) => request<Saved>('/api/v1/metrics', post(body)),
  update: (
    id: string,
    body: Definition & { updated_by: string; expected_version: number; changes_summary: string },
  ) => request<Saved>(metricPath(id), { ...post(body), method: 'PUT' }),
  remove: (id: string, deleted_by: string, expected_version: number) =>
    request(metricPath(id), {
      method: 'DELETE',
      body: JSON.stringify({ deleted_by, expected_version }),
    }),
  validate: (body: Definition & { metric_id?: string }) =>
    request<One<Validation>>('/api/v1/analysis/validate-metric', post(body)),
  validateSQL: (sql: string) =>
    request<One<Validation>>('/api/v1/analysis/validate-sql', post({ sql })),
  compare: (oldSQL: string, newSQL: string) =>
    request<
      One<{
        analysis: { canAnalyze: boolean; isBreaking?: boolean; error?: string };
        summary: string;
      }>
    >('/api/v1/analysis/compare-sql', post({ oldSQL, newSQL })),
  tree: (id: string) => request<One<Tree>>(analysisPath(id, 'dependencies')),
  impact: (id: string) => request<One<Impact>>(analysisPath(id, 'impact')),
  circular: (id: string) =>
    request<One<{ hasCircular: boolean; path: string[] }>>(analysisPath(id, 'circular-check')),
  versions: (id: string, page = 1) =>
    request<Page<Version>>(metricPath(id) + '/versions' + query({ page, limit: 10 })),
  audit: (id: string, page = 1) =>
    request<Page<Audit>>(metricPath(id) + '/audit' + query({ page, limit: 10 })),
  breaking: (page = 1, limit = 10) =>
    request<Page<Breaking>>('/api/v1/analysis/breaking-changes' + query({ page, limit })),
};
