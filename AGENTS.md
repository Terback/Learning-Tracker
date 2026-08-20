# Agent Instructions

These instructions apply to Codex and other coding agents working in this repository.

## Product Guardrails

- This is a progress-based personal Learning Tracker.
- Do not assume this is a daily tracker, daily journal, habit tracker, streak tracker, diary, or daily check-in app.
- The core hierarchy is Learning Goal -> Milestones / Learning Plan -> Progress Updates -> Attachments / Resources.
- A Progress Update is created manually whenever meaningful learning progress happens. There may be multiple updates in one day or no updates for weeks.
- All user content must ultimately be manageable from the frontend. The user should not need to edit source code, JSON files, seed scripts, database rows, or backend code to maintain their tracker.

## Before Making Changes

- Always inspect the existing implementation before modifying code.
- Read `PROJECT.md` and `ROADMAP.md` before major changes.
- Check the current file structure and relevant implementation files before deciding on an approach.
- Preserve existing functionality unless the user explicitly asks to replace it.
- Do not rewrite working components unnecessarily.
- Do not introduce features outside the requested scope.
- Keep changes small, phase-based, and aligned with the roadmap.

## Architecture Awareness

- The current app is a v0.1 local prototype.
- Current stack: Next.js, TypeScript, Tailwind CSS, Prisma, SQLite, local uploads under `public/uploads`.
- Planned production stack: Next.js, TypeScript, Tailwind CSS, Supabase PostgreSQL, Supabase Storage, Vercel.
- Treat SQLite and local file uploads as prototype infrastructure, not the final production architecture.
- When changing architecture, schema, storage, or product behavior, update documentation in the same task.

## Implementation Rules

- Prefer existing patterns in the repository.
- Keep the frontend editable and product-like rather than static.
- Maintain CRUD coverage for Goals, Milestones, Progress Updates, Attachments, Resources, and Tags.
- Avoid adding social, marketplace, organization, complex permission, or unrelated productivity features unless explicitly requested.
- Avoid changes that make the app harder to migrate to Supabase PostgreSQL or Supabase Storage.
- Avoid hardcoding user learning content into frontend components. Editable content should come from persistent storage.

## Verification

- Run appropriate checks after code changes.
- For application changes, prefer `npm run build` when feasible because it runs Prisma generation and Next.js type/build checks.
- Run lint/type checks if they are available and relevant.
- For documentation-only changes, a build is usually not required; inspect the changed documents instead.
- Do not launch long-running dev servers in the background unless the user explicitly requests it.

## Communication

- Explain which files changed after each task.
- Clearly separate implemented behavior from planned behavior.
- Mention any checks run and any checks skipped.
- If a requested change conflicts with these instructions or the product definition, pause and clarify before implementing.
