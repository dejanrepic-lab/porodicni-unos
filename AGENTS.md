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

## Project-specific rules (porodicni-unos)
Shared Repko rules live in `dejanrepic-lab/homelab` (`APP_STANDARD.md`, `DESIGN_SYSTEM.md`, `ICONS_AND_PWA.md`). These are the additions for this app.

- **Version:** the single version source is `version` in `package.json`; README „Trenutna verzija“ and the version history must match it. Bump it for every deployable change.
- **Family link (`/branch/:token`) is for relatives on phones.** Keep it self-explanatory: three steps in the header, contributor name first, reassurance instead of technical wording, record cards, bottom save bar. Verify changes in a real browser at phone width (Playwright, iPhone 13) before merging.
- **Partner order:** a family always shows and saves its partners in the family's own order, with the imported Gramps baseline (father, then mother) winning. Never put the person whose link was opened first; that rewrote families on save.
- **Gramps import:** take a person's birth and death from `birth_ref_index` / `death_ref_index`, otherwise only from events where the person's role is Primary. Accept event types and roles both as strings and as `{string: …}`.
- **Surnames:** `lastName` is the birth surname (as in Gramps); a later surname is `marriedName`. `maidenName` is legacy and only read: `public/surnames.js` converts it when a form opens a record and labels old records in their own words. Never write new data into `maidenName`, and compare saved names with the raw stored values (`personFields(…,{raw:true})`).
- **„Šta nedostaje“** items name the role of the person (prva osoba, partner, roditelj, dijete).
- **Public form (`/`) and family link share `public/index.html`.** Public-only assets (`public-form.css`, `public-form.js`, `<body class="public-form">`, the Turnstile script and widget) are stripped from the family link in `lib/branch-form.js`; family-link behaviour lives in `branch-*.js`. Keep that separation when adding features.
- **Turnstile** is verified only by `/api/submissions` routes; family links are protected by their private address and CSRF.
- **Admin:** shared navigation and sign-in page come from `lib/admin-chrome.js`, sessions from `lib/admin-session.js` (`ADMIN_REMEMBER_DAYS`). Admin pages of family links use `adminPage()`; relatives' pages use `page()` without admin navigation.
- **Archives** of a Gramps replacement are read through `lib/family-link-archives.js`; deleting one never touches the live link.
- **Icons/PWA:** `public/icons/porodicni-unos-full.svg` must stay identical to `porodicni-unos.svg` in `dejanrepic-lab/app-icons`; Android uses `porodicni-unos-maskable.svg`. The public app (`/manifest.webmanifest`) and the admin app (`/admin.webmanifest`) are separate.

