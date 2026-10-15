# Verification

Verified locally on 27 September 2026 using Node.js 24.11.1, an isolated MongoDB 7.0.24 replica set and Chromium through Playwright.

## Results

| Check | Result |
| --- | --- |
| Backend unit and integration tests | 15 passed |
| Frontend input and API failure tests | 5 passed |
| Browser scenarios | 4 passed |
| TypeScript and Vite production build | Passed |
| npm dependency audit | 0 vulnerabilities reported |
| Automated accessibility checks | No WCAG 2 A/AA or 2.1 AA violations reported on tested overview, editor and populated dependency screens |
| Visual inspection | Desktop and 390px mobile overview, editor and dependency layouts inspected |

## Behaviors exercised

- Strict payload/query validation and structured error details.
- Invalid SQL, destructive/multiple statements and placeholder recognition.
- Table, join, nested query and expression analysis.
- Atomic create/update history and audit rollback on injected write failure.
- Concurrent saves, stale-version conflicts and simultaneous dependency-cycle attempts.
- Missing dependencies, rename/deletion guards and transitive downstream impact.
- Certification, frozen calculations, same-state metadata changes and deprecation.
- Permanent breaking revision history after later metadata edits.
- Audit content tampering and tail deletion detection.
- Browser create/edit/delete, SQL validation/comparison, version and audit views.
- Real API-backed catalogue filtering, certification and dependency navigation.
- Mobile navigation with Escape/focus restoration, overflow checks and unavailable-server UI.

## Limits of verification

No production database, existing catalogue migration, identity provider, public deployment, warehouse execution or real BI client connection was tested. Docker Compose is supplied as a persistent local setup option but was not executed in this environment. Automated accessibility checks do not replace a full assistive-technology audit. Tests use isolated fixtures; no fixtures are embedded in the product. GitHub-hosted CI was not enabled because the publishing credential lacks workflow scope; its configuration is provided in docs/ci-workflow.yml.

## Next.js migration � 9 October 2026

Rechecked the migrated frontend against the real Express API and disposable MongoDB replica set. Backend tests: 15 passed; frontend tests: 5 passed. Next.js 16.4.0 production compilation and TypeScript checks passed. All 5 Chromium scenarios passed against Next.js production serving, including landing without API, filtering, certification/dependency navigation, create/edit/history/SQL/delete, mobile navigation and server errors. Automated accessibility and viewport checks passed; desktop overview and mobile layouts retained the Ricoz branding. npm audit reported 0 vulnerabilities after compatible dependency patches. No live hosting migration or production database was tested.

## Sessions and build root — 15 October 2026

Rechecked on Node.js 24.11.1. Backend tests: 16 passed, including unsigned requests, consumer and engineer denials, engineer drafts, and a second steward setup. Frontend input tests: 5 passed. Next.js 16.4.0 production build and TypeScript checks passed for the App Router under `frontend/src/app`. Chromium scenarios: 5 passed against the local demo, including a landing page that makes no API call, sign-in before the workspace, catalogue filtering, certification, dependencies, create/edit/history/SQL/delete, mobile navigation and server errors. No production database, Render redeploy, or named identity provider was tested.

## Router directory check — 15 October 2026

Next.js 16.4.0 throws when `pages` and `app` have different parents. A planted `frontend/pages` directory beside `frontend/src/app`, and a planted `frontend/app` plus `frontend/src/pages`, both threw that error until the prebuild removed them. `frontend/src/app` stayed in place. With `CI=true` and no `.next/cache`, the same no-cache warning Render prints appeared, then the production build and TypeScript check passed for all 9 routes. Render itself was not redeployed from this machine.
