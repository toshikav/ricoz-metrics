export const states = ['DRAFT', 'IN_REVIEW', 'CERTIFIED', 'DEPRECATED', 'ARCHIVED'] as const;
export type State = (typeof states)[number];
export const transitions: Record<State, State[]> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['DRAFT', 'CERTIFIED', 'ARCHIVED'],
  CERTIFIED: ['DEPRECATED', 'ARCHIVED'],
  DEPRECATED: ['ARCHIVED'],
  ARCHIVED: [],
};
export const types = ['BASE', 'COMPOSITE', 'RATIO'] as const;
export const tiers = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export interface Definition {
  name: string;
  display_name: string;
  description: string;
  metric_type: (typeof types)[number];
  domain: string;
  operational_tier: (typeof tiers)[number];
  calculation_logic: {
    sql_template: string;
    dependencies: string[];
    parameters: Record<string, string>;
    aggregation: string;
  };
  state: State;
  created_by: string;
  steward: string;
  tags: string[];
}
export interface Metric extends Definition {
  _id: string;
  version: number;
  last_certified_at?: string;
  last_modified_by?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Page<T> {
  success: boolean;
  data: T[];
  count: number;
  total: number;
  page: number;
  pages: number;
}
export interface Validation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dependencies?: string[];
  sqlMetadata?: unknown;
  metadata?: unknown;
}
export interface Summary {
  total: number;
  byState: { _id: State; count: number }[];
  byType: { _id: string; count: number }[];
  byTier: { _id: string; count: number }[];
  domains: { _id: string; count: number }[];
}
export interface Tree {
  name: string;
  id?: string;
  metric_type?: string;
  state?: State;
  exists?: boolean;
  circular?: boolean;
  error?: string;
  children?: Tree[];
}
export interface Impact {
  downstream: { id: string; name: string; display_name: string; state: State; depth: number }[];
  impactAnalysis: {
    riskLevel: string;
    impactScore: number;
    totalAffected: number;
    certifiedAffected: number;
    criticalAffected: number;
  };
}
export interface Version {
  _id: string;
  version: number;
  change_type: string;
  snapshot: Metric;
  changes_summary: string;
  changed_by: string;
  changed_fields: string[];
  is_breaking: boolean;
  createdAt: string;
}
export interface Audit {
  _id: string;
  event_type: string;
  actor: string;
  summary: string;
  current_hash: string;
  previous_hash: string;
  sequence: number;
  occurred_at: string;
  changes: unknown;
}
export interface Breaking {
  is_deleted: boolean;
  metric: { id: string; name: string; display_name: string };
  latestVersion: number;
  createdAt: string;
  changed_by: string;
  summary: string;
  analysis: { severity: string; recommendation: string; changed_fields: string[] };
}
