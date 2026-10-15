# Architecture decisions

## Preserve the existing stack

Express and MongoDB already implement the resource model. React with Vite provides a small, independently built discovery frontend. No Python/PostgreSQL migration is needed to ship a catalogue.

## Require transactions and optimistic concurrency

A MongoDB replica set is mandatory. Each mutation locks the catalogue head before checking the dependency graph. Metric, version, audit event and chain head commit in one transaction. expected_version rejects stale edits. The shared lock is a deliberate throughput tradeoff for a low-write governance catalogue.

## Preserve source attribution with clean repository history

The source snapshot was toshikav/ricoz-metrics-mern at f3040bd1879262abb3364b8a799a8998e806bf83. Source history tracked environment configuration and installed dependencies. This repository begins with sanitized application files and retains the original package author/license metadata and source link.

## Keep governance claims precise

Lifecycle transitions and certified-definition freezing are real backend constraints. Account roles are enforced on the server. A company OIDC issuer was not named, so accounts are email and password records in MongoDB. Replacing the password check with that issuer is a later change, not a second permission model.

## Make static SQL analysis conservative

MySQL SELECT parsing supports metric placeholders without executing SQL. AST differences are potentially breaking, not proof of a semantic change. Metadata and dependency graphs are not warehouse result lineage.

## Preserve historical revisions

Breaking revisions remain in history after later non-breaking changes or deletion. Deleting a definition never deletes its version/audit records. Independent audit anchoring and retention enforcement remain future work.

## Introduce the product before opening the workspace

The root route presents a static Ricoz-branded information page inspired by https://ricoz.in/franchise/. The dashboard moves to /overview; existing metric, SQL and review URLs remain available. Landing content does not request the API, uses an explicitly illustrative definition and explains current capability limits. All workspace actions navigate to implemented features.

## 15 October 2026: sessions and one router root

Catalogue routes require a session. Consumers read, engineers draft and submit, and stewards certify, archive, delete and manage accounts. The App Router lives at `frontend/src/app`. `turbopack.root` is the repository, where the lockfile and the hoisted Next package live, so a Render checkout under a directory named `src` is not walked into a parent lockfile.

## 9 October 2026: Next.js migration

Frontend uses Next.js 16 App Router with React 19. The landing page is statically rendered; the workspace layout and interactive screens are client components. Native Next links, route parameters and search parameters replace React Router. Express and MongoDB remain the API and data layer. Public API configuration uses NEXT_PUBLIC_API_BASE_URL at build time. Production hosting runs Next.js on Node rather than serving the old Vite dist folder.
