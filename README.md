# RicozMetrics

A metric catalogue and governance workspace for defining business metrics, reviewing calculation changes and tracing dependencies.

Built on the original RicozMetrics backend by toshikav. This repository retains the product identity and source attribution, with a revised backend, Next.js App Router frontend and executable regression tests.

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
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

Then run:

```sh
npm ci
npm run dev
```

The backend also supports npm run dev and npm start from backend/. The frontend supports npm run dev from frontend/. If frontend origin changes, update CLIENT_URL. If the API address changes, update NEXT_PUBLIC_API_BASE_URL and rebuild the frontend. Only public API configuration belongs in NEXT_PUBLIC variables; these values are included at build time.

## Build and verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

The frontend production build is frontend/.next. Run npm run start --workspace frontend on a Node.js host (default port 3000; set PORT to override). Next.js serves the static landing page and the workspace routes. A Vite static-host configuration is no longer sufficient. Set NEXT_PUBLIC_API_BASE_URL before building and CLIENT_URL to the deployed frontend origin. Run the backend with npm start --workspace backend against a persistent replica set. TLS and access control must be supplied by the deployment environment.

docs/ci-workflow.yml contains the GitHub Actions configuration. To enable hosted CI, place it at .github/workflows/ci.yml using a GitHub credential with workflow permission. The publishing credential did not have that scope; verification was run locally.

## Access boundary

Sign-in is required for the catalogue. Passwords are stored as scrypt hashes. The session cookie is httpOnly. The first account is a steward, created from the sign-in screen or from `BOOTSTRAP_STEWARD_EMAIL` and `BOOTSTRAP_STEWARD_PASSWORD` when the database has no accounts.

- Consumers can view the catalogue and use the SQL workbench.
- Engineers can create drafts and submit them for review.
- Stewards can certify, deprecate, archive, delete and manage accounts.

The signed-in email is the audit actor. Typed actor emails are ignored. The API still defaults to loopback binding. Serve it over HTTPS and do not expose MongoDB to the public internet. A company identity provider can replace the password check later; none was specified for this release.

SQL is parsed as MySQL SELECT syntax. Definitions are never executed or translated to other warehouses. Placeholder dependencies express metric references, not an executable semantic layer.

## Structure

```text
backend/src/
  controllers/   Catalogue, history, summary and analysis endpoints
  models/        Metric, revision, audit event and transactional head
  services/      SQL, dependency graph, validation and atomic mutations
frontend/src/app/ Next.js layouts, metadata and file-based routes
frontend/src/
  api/           Centralized typed API client
  components/    Shared controls, tables, notices and dialogs
  screens/       Overview, catalogue, editor, detail, SQL and changes
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

## Product entry page

The home route (/) introduces RicozMetrics with features, a three-step workflow and FAQs. Choose Open workspace to reach /overview and sign in. Existing /metrics, /sql and /changes links still work. The informational page loads without an API connection; the workspace requires the backend and a session.

For browser verification against the production build, first run npm run build, then set NEXT_E2E_PRODUCTION=1 before npm run test:e2e (PowerShell: `$env:NEXT_E2E_PRODUCTION="1"`). The demo still uses a disposable database.
