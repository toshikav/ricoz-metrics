# API contract

Base: http://localhost:5000. JSON request and response bodies. Errors return { success: false, error: { message, details? }, timestamp }. Validation details contain errors/warnings. No authentication is implemented.

## Routes

| Method | Path                                        | Purpose                                               |
| ------ | ------------------------------------------- | ----------------------------------------------------- |
| GET    | /api/health                                 | Readiness; 503 when database is disconnected          |
| GET    | /api/v1/metrics                             | Catalogue search, filters and pagination              |
| GET    | /api/v1/metrics/summary                     | Full-catalogue totals by state, type, tier and domain |
| POST   | /api/v1/metrics                             | Create a DRAFT definition                             |
| GET    | /api/v1/metrics/:id                         | Read one definition                                   |
| PUT    | /api/v1/metrics/:id                         | Validate and save a new revision                      |
| DELETE | /api/v1/metrics/:id                         | Delete safely; keep version/audit history             |
| GET    | /api/v1/metrics/:id/versions                | Paginated revision snapshots                          |
| GET    | /api/v1/metrics/:id/audit                   | Paginated audit events                                |
| POST   | /api/v1/analysis/validate-sql               | Validate one MySQL SELECT                             |
| POST   | /api/v1/analysis/compare-sql                | Compare oldSQL and newSQL                             |
| POST   | /api/v1/analysis/validate-metric            | Validate a complete definition                        |
| GET    | /api/v1/analysis/breaking-changes           | All historical breaking revisions                     |
| GET    | /api/v1/analysis/metrics/:id/dependencies   | Metric-reference tree                                 |
| GET    | /api/v1/analysis/metrics/:id/impact         | Direct and transitive downstream impact               |
| GET    | /api/v1/analysis/metrics/:id/circular-check | Cycle detection                                       |

List filters: search, domain, state, metric_type. Pagination: page >= 1, limit 1–100, default 20. Catalogue order is updatedAt descending, then \_id descending. Search performs escaped literal case-insensitive matching across key, display name, description and tags. History and breaking-change endpoints accept page and limit.

## Create

```json
{
  "name": "gross_revenue",
  "display_name": "Gross revenue",
  "description": "Sum of recorded order amounts before deductions.",
  "metric_type": "BASE",
  "domain": "Finance",
  "operational_tier": "HIGH",
  "calculation_logic": {
    "sql_template": "SELECT SUM(amount) AS gross_revenue FROM orders",
    "dependencies": [],
    "parameters": {},
    "aggregation": "sum"
  },
  "state": "DRAFT",
  "created_by": "owner@example.com",
  "steward": "steward@example.com",
  "tags": ["revenue"]
}
```

Only documented definition fields are accepted. Server-managed fields cannot be supplied. Dependencies must exactly match unique SQL placeholders, excluding quoted strings and comments.

## Update

PUT accepts supported partial definition fields plus required mutation metadata:

```json
{
  "description": "Clarified business definition",
  "updated_by": "editor@example.com",
  "expected_version": 1,
  "changes_summary": "Clarify which orders are included"
}
```

The server merges the patch, validates the complete candidate, and atomically writes definition, version and audit. A stale expected_version returns 409. Missing actor or summary returns 400. The creator cannot change.

Lifecycle: DRAFT → IN_REVIEW/ARCHIVED; IN_REVIEW → DRAFT/CERTIFIED/ARCHIVED; CERTIFIED → DEPRECATED/ARCHIVED; DEPRECATED → ARCHIVED. Archived metrics are read-only. Same-state updates are permitted elsewhere. Certification requires a steward and certified upstream dependencies. Certified name, type and calculation logic are frozen.

For validate-metric during editing, send a complete definition plus metric_id; omit metric_id during creation. A validation success is advisory: the write repeats validation in its transaction.

## Delete

```json
{ "deleted_by": "editor@example.com", "expected_version": 3 }
```

Deletion requires the current revision. Dependents and certified state return 409. Dependent details are retained in the error response. Audit and versions remain available under the deleted ID.

## Intentional changes from the original backend

- Strict schemas, capped pagination and structured error details.
- Updates require updated_by, expected_version and changes_summary.
- Deletes require deleted_by and expected_version.
- Server-owned timestamps/version fields and arbitrary payload fields are rejected.
- Certified calculations are frozen instead of displaying an unenforced approval warning.
- Dependency extraction, SQL parsing, validation and graph checks agree.
- Metric, revision and audit writes are transactional; MongoDB replica set required.
- Summary endpoint prevents incomplete dashboard counts.
- Breaking-change history includes old revisions; latestVersion is the recorded breaking revision, not necessarily the metric's current revision.
- Version/audit snapshots retain ownership and metadata.
- Static comparison conservatively flags structural edits; it cannot prove semantic equivalence.

No warehouse query endpoint, login route, GraphQL schema, tenant isolation or BI connection endpoint is provided.
