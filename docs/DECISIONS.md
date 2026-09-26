# Architecture decisions

## Preserve the existing stack

Express and MongoDB already implement the resource model. React with Vite provides a small, independently built discovery frontend. No Python/PostgreSQL migration is needed to ship a catalogue.

## Require transactions and optimistic concurrency

A MongoDB replica set is mandatory. Each mutation locks the catalogue head before checking the dependency graph. Metric, version, audit event and chain head commit in one transaction. expected_version rejects stale edits. The shared lock is a deliberate throughput tradeoff for a low-write governance catalogue.

## Preserve source attribution with clean repository history

The source snapshot was toshikav/ricoz-metrics-mern at f3040bd1879262abb3364b8a799a8998e806bf83. Source history tracked environment configuration and installed dependencies. This repository begins with sanitized application files and retains the original package author/license metadata and source link.

## Keep governance claims precise

Lifecycle transitions and certified-definition freezing are real backend constraints. Actor identity, approvals and role-based permissions are not implemented. Use a protected internal environment until identity and authorization are complete.

## Make static SQL analysis conservative

MySQL SELECT parsing supports metric placeholders without executing SQL. AST differences are potentially breaking, not proof of a semantic change. Metadata and dependency graphs are not warehouse result lineage.

## Preserve historical revisions

Breaking revisions remain in history after later non-breaking changes or deletion. Deleting a definition never deletes its version/audit records. Independent audit anchoring and retention enforcement remain future work.
