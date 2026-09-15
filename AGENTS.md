# Repko App Standard

This repository is part of the Repko self-hosted application suite.

## Core rule
Before changing code, inspect the existing architecture, data model, deployment files, UI patterns, and current behavior. Extend the existing application deliberately; do not rebuild from scratch unless explicitly requested.

## Product consistency
All Repko apps should feel like members of the same product family while preserving each app's domain-specific needs.

- Mobile-first, responsive UI.
- Consistent page spacing, cards, forms, buttons, badges/tags, tables, empty states, confirmations, and feedback messages.
- Reuse an existing good pattern before introducing a new one.
- Prefer compact tags/badges for metadata rather than unnecessary rows or oversized controls.
- Keep primary actions obvious and destructive actions visually and behaviorally separated.
- Navigation should remain predictable across desktop and mobile.
- Avoid UI churn that changes familiar behavior without a clear usability benefit.

## Data safety
- Existing user data is authoritative and must be preserved.
- Never delete or recreate a production database as a shortcut.
- Schema changes must be backward-aware and use an explicit migration strategy.
- Imports, upgrades, and migrations must be idempotent where practical.
- Before changing persistence logic, identify current storage paths and deployment mounts.

## Architecture
- Respect the framework and architecture already used by this repository.
- Prefer modularization over growing large monolithic files further.
- Avoid duplicated business logic.
- Keep UI, persistence, and domain logic separated where practical.
- Remove obsolete compatibility code only after proving it is no longer needed.

## Self-hosting and deployment
- Target stable Docker deployment on ZimaOS/Linux.
- Persistent state must live outside the container image.
- Do not hard-code environment-specific secrets, hostnames, or user-specific absolute paths in application code.
- Keep compose files understandable and minimal.
- Add health checks where useful and avoid unnecessary services.
- Preserve existing deployment compatibility unless a migration path is documented.

## Quality
Before proposing a merge:
1. Run or add relevant automated tests where feasible.
2. Verify application startup.
3. Verify existing data remains readable.
4. Verify mobile and desktop layouts for changed screens.
5. Check error paths, empty states, and destructive actions.
6. Update README/version notes when behavior or deployment changes materially.

## Change strategy
- Significant work belongs on a feature/chore branch, not directly on `main`.
- Prefer small, reviewable commits with clear messages.
- Refactors should preserve behavior unless the task explicitly changes behavior.
- Do not mix unrelated cleanup into a risky functional migration.

## Optimization priorities
When auditing this repository, prioritize in this order:
1. Data integrity and upgrade safety.
2. Broken or confusing behavior.
3. Security and authentication issues.
4. Architecture and maintainability hotspots.
5. Mobile usability and UI consistency.
6. Performance bottlenecks that are measurable or structurally obvious.
7. Documentation, deployment consistency, and cleanup.

## Repository-specific note
This app currently uses a Node/server-oriented architecture. Keep that architecture unless there is a concrete reason to migrate it; product consistency does not require all Repko apps to use the same framework.
