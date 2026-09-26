# RicozMetrics

A metric catalogue and governance workspace for defining business metrics, reviewing calculation changes and tracing dependencies.

Built on the original RicozMetrics backend by toshikav. This repository retains the product identity and source attribution, with a revised backend, React frontend and executable regression tests.

## What is included

- Live overview with catalogue-wide counts and lifecycle distribution.
- Search, domain/state/type filters and paginated metric catalogue.
- Definition editor with SQL validation, dependency extraction and revision conflict detection.
- Metric-reference lineage, transitive downstream impact, version snapshots and audit records.
- SQL validation/comparison and a permanent list of breaking revisions.
- Atomic MongoDB writes for metrics, versions and hash-linked audit events.

## Quick local preview

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run demo
```

Open [the local workspace](http://localhost:5173). This starts a real, disposable MongoDB replica set and the API/frontend. The catalogue starts empty. Create a metric through the UI. Data is discarded when the process stops. On first use, the MongoDB test binary is downloaded.

No upstream database credentials or sample business data are included.

## Persistent development

Use MongoDB Atlas or a local MongoDB replica set. Standalone MongoDB cannot provide the transaction guarantees used here.

For a local replica set, with Docker installed:

```sh
docker compose up -d
```

Create backend/.env from backend/.env.example, and frontend/.env from frontend/.env.example. Default configuration:

```dotenv
# backend/.env
PORT=5000
HOST=127.0.0.1
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/ricoz_metrics?replicaSet=rs0
CLIENT_URL=http://localhost:5173
```

```dotenv
# frontend/.env
VITE_API_BASE_URL=http://localhost:5000
```

Then run:

```sh
npm ci
npm run dev
```

The backend also supports npm run dev and npm start from backend/. The frontend supports npm run dev from frontend/. If frontend origin changes, update CLIENT_URL. If the API address changes, update VITE_API_BASE_URL and rebuild the frontend. Only public API configuration belongs in Vite variables.

## Build and verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

The frontend production bundle is frontend/dist. Serve it with a static host configured to fall back to index.html for client-side routes. Run the backend with npm start --workspace backend against a persistent replica set. TLS and access control must be supplied by the deployment environment.

docs/ci-workflow.yml contains the GitHub Actions configuration. To enable hosted CI, place it at .github/workflows/ci.yml using a GitHub credential with workflow permission. The publishing credential did not have that scope; verification was run locally.

## Access boundary

This version has no application authentication or RBAC. It defaults to loopback binding and is intended for local development or an internal workspace behind an authenticated access gateway. Do not expose the API directly to the public internet. Entered actor emails are audit labels, not verified identities. CORS is not authentication.

The gateway must protect both frontend and API; the backend must be unreachable except through that gateway. Before multi-user governance is treated as authoritative, implement the identity and authorization phase in docs/BUILD-PLAN.md.

SQL is parsed as MySQL SELECT syntax. Definitions are never executed or translated to other warehouses. Placeholder dependencies express metric references, not an executable semantic layer.

## Structure

```text
backend/src/
  controllers/   Catalogue, history, summary and analysis endpoints
  models/        Metric, revision, audit event and transactional head
  services/      SQL, dependency graph, validation and atomic mutations
frontend/src/
  api/           Centralized typed API client
  components/    Shared controls, tables, notices and dialogs
  pages/         Overview, catalogue, editor, detail, SQL and changes
  hooks/         Async loading and retry handling
docs/
  BUILD-PLAN.md  Revised scope, release gates and limitations
  API.md         API contract and migration notes
  VERIFICATION.md  Verification evidence
```

See docs/API.md for request examples and intentional contract changes. The original documents remain unmodified. Their implementation plan has been reconciled in docs/BUILD-PLAN.md.

## Integrity and scaling

Writes require MongoDB transactions. A global catalogue head serializes mutations, making dependency validation and audit sequencing consistent. This favors governance correctness over write throughput; benchmark before large deployments.

Audit verification recomputes hashes, checks links and validates the stored head. Administrators with database write access can rewrite the chain and head together. This is not an independently anchored or immutable compliance archive.

With backend/.env configured, run npm run audit:verify --workspace backend to verify the chain. The command exits unsuccessfully on a broken chain or connection failure.

No existing production database was migrated. Create a fresh database for this version; importing an older catalogue requires validation and a deliberate history migration.

## Attribution

Original backend: [toshikav/ricoz-metrics-mern](https://github.com/toshikav/ricoz-metrics-mern).
The original backend package identifies RicozMetrics as author and declares ISC. That metadata is retained. Third-party packages retain their own licenses through their published distributions. No new license grant over the full product is asserted.
