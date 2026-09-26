# RicozMetrics implementation plan

Revised 27 September 2026 against the supplied project plan, frontend overview and the existing Express/MongoDB source.

## Decision

Deliver a dependable metric catalogue and governance workspace using the existing MERN architecture. Keep SQL execution, warehouse dialect translation, BI protocol emulation and enterprise identity as separate release gates. The existing backend is a starting point, not a completed semantic execution engine.

## Corrections to the original plan

| Original assumption                                                                    | Revised decision                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FastAPI, Pydantic and PostgreSQL are the foundation                                    | Retain Express, MongoDB and React. Avoid a backend rewrite without a demonstrated need.                                                                                                                |
| A four-week MVP includes safe SQL execution, RLS, a BI proxy and enterprise governance | Build catalogue governance first. Estimate execution and BI interoperability after concrete compatibility spikes.                                                                                      |
| pgduckdb provides a ready-to-use standalone PostgreSQL wire proxy                      | Treat BI connectivity as an unvalidated architecture choice. Select and test an actual server/proxy with the target BI tools before promising compatibility.                                           |
| Hash chaining makes audit records immutable                                            | Transactions and deterministic hash verification provide tamper evidence. Database administrators can rewrite an entire chain; independent signed checkpoints or external retention are separate work. |
| Dependency diagrams are column-level lineage                                           | This release exposes metric-reference lineage from placeholders. True column lineage requires warehouse schemas and dialect-aware resolution.                                                          |
| SQL structure comparison proves semantic compatibility                                 | Use conservative static change detection. Changed expressions, predicates, aliases or joins are potentially breaking; result equivalence needs fixture queries against the intended warehouse.         |
| Approval warnings implement RBAC                                                       | Lifecycle guards are implemented, but identity and role enforcement are not. Actor emails are self-reported. Restrict deployment to an access-controlled internal environment.                         |
| Dashboard counts can be built from one result page                                     | Add a real aggregation endpoint over the entire catalogue.                                                                                                                                             |
| A latest-version comparison is enough for change history                               | Retain every breaking revision even after later metadata-only changes.                                                                                                                                 |
| Public cloud connection settings can be copied from the source repository              | Use clean history and example configuration. Do not reuse tracked environment files. Rotate any credentials exposed upstream.                                                                          |

## Release 1 — Catalogue workspace

### Data model and contracts

- Metric: unique stable key, display name, description, domain, BASE/COMPOSITE/RATIO type, operational tier, SQL, derived dependency names, string parameters, creator, steward, tags and lifecycle state.
- Version: immutable-through-API full snapshot and revision number, actor, summary and changed fields.
- Audit event: sequence, previous hash, deterministic content hash, timestamp and before/after snapshots.
- Catalogue head: serialize mutations so dependent graph edits, deletion checks and audit writes use a consistent transactional snapshot.
- Preserve snake_case metric fields and existing resource routes. Document intentionally stricter update/delete bodies.

### Backend exit criteria

- Strict payload validation rejects malformed fields, arbitrary query operators, invalid IDs and unbounded pagination.
- SQL parsing supports one MySQL SELECT and metric placeholders outside strings/comments; no SQL is executed.
- Creation starts in DRAFT. Allowed lifecycle transitions are enforced. Certified calculations are frozen; archived metrics are read-only.
- Updates validate the complete merged definition. Missing dependencies, inconsistent placeholder lists, deep cycles and unsafe renames fail before writes.
- Updates and deletes require expected_version. Concurrent changes return a conflict without losing data.
- Metric, version and audit changes commit atomically in a MongoDB replica-set transaction.
- Deletion rejects dependents and certified records. History remains accessible after deletion.
- Audit verification checks content hashes, predecessor links, sequence and the stored head.
- Overview aggregates, transitive impact and historical breaking revisions are exposed by real endpoints.
- Health reflects database readiness. Production startup waits for database initialization and requires transaction support.

### Frontend exit criteria

- Responsive overview with complete counts, lifecycle distribution, recent metrics, domains and breaking revision summary.
- Catalogue supports server-side search, filters, pagination and deterministic recent-update order.
- Editor covers every supported definition field, derives dependencies from SQL, validates before saving and displays warnings/errors.
- Detail views expose SQL, ownership, dependency tree, transitive impact, version snapshots and audit records.
- SQL workbench validates or compares definitions without simulated execution.
- Destructive actions require confirmation; stale edits and backend failures are actionable.
- Loading, empty, unavailable and populated states all use live API results.
- No invented login or role claims; no embedded database credentials.
- Local fonts, visible keyboard focus, reduced-motion support, mobile navigation and semantic controls.

### Verification and delivery

- Backend integration tests use an isolated MongoDB replica set.
- Regression coverage includes atomic failure behavior, optimistic concurrency, lifecycle restrictions, graph cycles, transitive impact, historical breaking changes and audit tampering.
- Frontend tests cover input handling and network/API failures.
- Browser tests cover create, update, history, dependency inspection, delete, SQL tools and mobile/error flows.
- Build and dependency audit must pass.
- Publish a clean private repository under the owner's account and invite toshikav with write access.

## Release 2 — Secure team pilot

These are deployment prerequisites for exposure beyond a protected internal workspace.

1. Integrate the organization's OIDC provider and server-derived identities.
2. Add server-enforced engineer, steward and consumer permissions; define who may certify.
3. Add explicit approval records and separation of duties if the governance policy requires them.
4. Decide tenant boundaries before introducing tenant data; scope every query, version and audit record consistently.
5. Define backup/restore objectives, retention, database least-privilege roles and an independent audit checkpoint store.
6. Pilot with 10–15 actual metrics and measure certification time, catalogue usage and resolved definition conflicts.
7. Benchmark catalogue size and mutation contention. Replace the global serialization point only with an equally safe concurrency design.

## Release 3 — Semantic execution

1. Choose the actual target warehouse and SQL dialect.
2. Model sources, dimensions, measures, time grains, join cardinality and parameter types.
3. Validate fan-out prevention with multi-fact fixtures and expected answers.
4. Add authenticated read-only warehouse connections, query cost/time limits and parameter binding.
5. Treat SQL lineage and SemVer policies as separately tested capabilities.
6. Define version-pinned consumption, replacement mappings and deprecation windows.

## Release 4 — Distribution and rollout

Evaluate REST result queries, GraphQL or PostgreSQL-compatible connectivity only against real consumers. Prove Tableau/Power BI compatibility, identity propagation, cancellation, concurrency and latency before release. Add subscriptions, operational telemetry and governance training once the consumption model exists.

## Operational limits

This release is a single-workspace catalogue. No authentication, tenant isolation, warehouse execution, cross-dialect translation, GraphQL, PG-wire endpoint, alert dispatch or column-level lineage is claimed. Audit chaining is not independently anchored. Parameters are stored metadata, not executed bindings. The global transactional head favors correctness over high write throughput.

Scheduling is conditional on staffing and infrastructure; the original four-week estimate is not a delivery guarantee.
