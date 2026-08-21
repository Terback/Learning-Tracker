# Roadmap

This roadmap tracks the Personal Learning Tracker from local prototype toward an online browser-based application.

Status labels:

- Implemented: exists in the current repository.
- Partial: started, but needs refinement.
- Planned: not yet implemented.

## v0.1 Local Prototype - Current

Status: Implemented

Current implementation:

- Next.js app scaffolded with TypeScript and Tailwind CSS.
- Prisma schema using SQLite.
- Local database configured through `DATABASE_URL="file:./dev.db"`.
- Seed data for Embedded / Engineering Learning.
- Dashboard with summary stats and Learning Goal cards.
- Goal workspace with editable goal header.
- Milestone roadmap with create, edit, delete, complete/in-progress toggle, and drag-and-drop reorder.
- Progress Timeline with create, edit, delete, detail fields, tags, and attachment previews.
- Quick Update modal for fast progress capture.
- Local file upload endpoint for images, PDFs, Markdown, and text files.
- Resources view and resource CRUD.
- Tags view with reusable tags.
- Global search and status filter.
- Dark mode toggle.

Current local prototype constraints:

- SQLite is local-only and not the final production database.
- Uploaded files are stored locally under `public/uploads`.
- The app is not yet deployed.
- The API layer is a single broad CRUD endpoint rather than a refined production API design.
- Search/filter is frontend-oriented and should be revisited for production data scale.

## Product Definition Cleanup

Status: In progress

Purpose:

- Formalize the product as a progress-based Learning Tracker.
- Make clear that it is not a daily journal, habit tracker, or daily check-in app.
- Establish consistent terminology for Learning Goals, Milestones, Progress Updates, Attachments, Resources, and Tags.
- Document the v0.1 architecture separately from the planned production architecture.
- Give future coding agents clear guardrails before more implementation work begins.

Deliverables:

- `PROJECT.md`
- `ROADMAP.md`
- `AGENTS.md`

## Supabase Database Migration

Status: Implemented

Purpose:

- Move persistent data from local SQLite to Supabase PostgreSQL.
- Keep Prisma as the data access layer (no Supabase-native client needed for CRUD).
- Preserve the existing product hierarchy and editable frontend workflows.

Done:

- `prisma/schema.prisma` datasource switched from `sqlite` to `postgresql`, with a separate `directUrl` for migrations alongside the pooled `url` used at runtime.
- `.env.example` documents the two required connection strings (pooled `DATABASE_URL`, direct `DIRECT_URL`) and how to find them in the Supabase dashboard, without exposing real credentials.
- Schema pushed to the live Supabase database with `prisma db push`.
- Seed data populated in Supabase via the existing seed script, unchanged.
- Create/read/update/delete verified directly against live Postgres, including cascade-delete (Goal to Milestone/ProgressLog/Attachment/Resource) and set-null-on-delete (Milestone to ProgressLog/Resource) behavior.
- `prisma validate`, `prisma generate`, and `tsc --noEmit` all pass against the live schema.

Local SQLite (`prisma/dev.db`) is left in place as a rollback reference; it is no longer the active datasource.

Not yet done: per-user data ownership (tracked separately, see below) and application-level auth — the database itself currently has no user scoping.

## Authentication And Per-User Data Ownership

Status: In progress

Purpose:

- Support a small number (roughly 20-30) of independent users, each with fully private learning records.
- No organizations, teams, roles, admin dashboards, or collaboration features.

Done:

- `@supabase/ssr` and `@supabase/supabase-js` added; browser client (`lib/supabase/browser.ts`) and server client (`lib/supabase/server.ts`) created.
- `middleware.ts` refreshes the Supabase session on every request and redirects unauthenticated requests to `/login` (API routes are excluded and enforce auth independently).
- `/login` page: email/password sign-in.
- `/signup` page and `POST /api/auth/signup`: self-service account creation, gated by a server-side `ALLOWED_SIGNUP_EMAILS` allow-list checked before `supabase.auth.signUp()` is ever called (no service-role key needed). Requests for an email not on the list are rejected with 403 before touching Supabase Auth. Superseded the original "admin creates every account in the dashboard" approach now that the product needs to onboard ~20-30 people without editing the dashboard for each one.
- `Goal.userId` and `Tag.userId` added to the schema; `Tag`'s uniqueness is now per-user (`userId + name`) instead of global. Milestones, ProgressLogs, Attachments, and Resources inherit ownership through their parent Goal.
- Every `/api/data` action (and the upload route) checks the authenticated user first and returns 401 if absent, then verifies the user owns the record (or its parent Goal) before reading, updating, deleting, or creating child records. Frontend-supplied IDs are never trusted directly.
- `updateProgressLog`/`updateResource` no longer allow reassigning a record to a different `goalId` from the client payload, closing a latent cross-goal (and now cross-user) data-move gap.
- Old demo/seed data (unowned) was cleared before adding the required `userId` columns; `scripts/seed.ts` now requires a `SEED_USER_ID` env var and will not run without one.
- Settings view updated with a working Log out control; `learning-app.tsx` redirects to `/login` on a 401 from the API.
- `prisma validate`, `tsc --noEmit`, and `npm run build` all pass.

Done (verified manually):

- Real account created in the Supabase dashboard; login, logout, and per-user data isolation confirmed working end-to-end in the browser.

Still pending (blocked on Supabase dashboard configuration and local `.env`, see conversation):

- Populating the real `ALLOWED_SIGNUP_EMAILS` list in `.env` with the actual people being onboarded.
- Deciding whether to disable "Confirm email" in Supabase (Authentication -> Sign In / Providers -> Email) so self-registered accounts can log in immediately, since no email-confirmation-link handling is built. The signup page degrades gracefully either way (shows a "check your email" message if confirmation is required), but confirmation email deliverability depends on Supabase's default email sending unless SMTP is configured.
- Manual end-to-end verification of the signup flow in the browser.

## Supabase Storage Migration

Status: Implemented

Purpose:

- Move attachments from local `public/uploads` storage to Supabase Storage.
- Support browser-based production uploads for screenshots, images, PDFs, Markdown, and text files.

Done:

- `Attachment` schema extended additively: `fileUrl` (legacy local path) made optional, `filePath` (Supabase Storage object key) added.
- `/api/upload` uploads new files to a private Supabase Storage bucket (`attachments`) at `userId/progressLogId/unique-filename`, using the authenticated request's own Supabase client (no service-role key), and records the object key in `Attachment.filePath`.
- `/api/data` resolves each attachment to a working `fileUrl` per request: legacy rows (`filePath` empty) serve their original local path unchanged; new rows (`filePath` set) get a fresh signed URL (1 hour expiry) generated server-side. The frontend's `attachment.fileUrl` contract is unchanged either way.
- Attachment deletion removes the Supabase Storage object alongside the database row. Deleting a Goal or a Progress Update (both of which cascade-delete their Attachment rows in Postgres) also removes every associated Storage object first, so cascading deletes can no longer orphan Storage files.
- `attachments` Storage bucket created (private) with RLS policies restricting every operation to the caller's own `auth.uid()` folder prefix; verified directly against `pg_policies`.
- No frontend changes: drag-and-drop, clipboard paste, browse, and preview/download all continue to work unmodified, since the API still returns a plain `fileUrl` string.
- End-to-end upload/preview/delete verified working in the browser against live Supabase Storage.

Legacy attachment migration: no longer needed. The 5 pre-migration attachments found during this work were confirmed to be test/exploratory data, deleted during manual cascade-delete testing before migration ran. A one-time `migrateLegacyAttachments` action and Settings button were built to migrate them, then removed once confirmed unnecessary (they migrated 0 rows, since nothing remained to migrate). No attachments currently reference the legacy `fileUrl` local-storage path; all new attachments go through Supabase Storage.

## Frontend CRUD Refinement

Status: Implemented (core CRUD complete)

Already implemented:

- Goal creation, editing, and deletion, with a confirmation step before delete.
- Milestone creation, editing, deletion, status updates, and reorder, with a confirmation step before delete.
- Progress Update creation, editing, deletion, with a confirmation step before delete.
- Attachment upload and delete, with a confirmation step before delete.
- Resource creation, editing, deletion, with a confirmation step before delete.
- Tag creation through goal/milestone/progress editing and tag deletion, with a confirmation step before delete.
- `POST /api/data` rejects unrecognized actions with a 400 error instead of silently returning unchanged data.

Planned refinements:

- Improve validation and form error states.
- Add optimistic UI where safe.
- Improve inline editing save behavior to avoid excessive writes while typing.
- Improve empty states and loading states.
- Split broad API actions into clearer route or server-action boundaries if useful.

## Progress Timeline Refinement

Status: Partial

Already implemented:

- Chronological Progress Updates.
- Goal-level timeline.
- Global timeline view.
- Related milestone display.
- Concepts, skills, problems, solutions, and next step fields.
- Attachment previews and image enlargement.

Planned refinements:

- Better Markdown rendering.
- Group updates by date or month.
- Improve editing flow for long notes.
- Add filtering by milestone, tag, skill, concept, and date range.
- Improve attachment gallery layout.
- Add timeline density controls if needed.

## Search And Filter

Status: Partial

Already implemented:

- Global text search across goals, milestones, progress updates, concepts, skills, and tags.
- Status filter for goals.

Planned refinements:

- Add tag filters.
- Add date range filters.
- Add milestone status filters.
- Add resource type filters.
- Consider server-side search after Supabase migration.

## Deployment To Vercel

Status: Planned

Purpose:

- Make the tracker available as an online browser-based application.

Expected work:

- Configure Vercel project.
- Add production environment variables.
- Connect Supabase PostgreSQL.
- Connect Supabase Storage.
- Verify uploads, CRUD, and timeline rendering in production.
- Add deployment notes to documentation.

## Later AI Features

Status: Planned

Potential features:

- Summarize progress over a goal, milestone, week, month, or custom range.
- Generate learning recap notes from Progress Updates.
- Suggest next steps based on current roadmap and recent progress.
- Extract concepts and skills from notes.
- Help organize rough progress notes into structured updates.

AI features must remain optional and must not replace the user-controlled Progress Update workflow.

## Later Analytics

Status: Planned

Potential features:

- Progress over time by goal.
- Milestone completion trends.
- Skills and concepts learned over time.
- Resource usage summaries.
- Learning area heatmaps.

Analytics should support reflection, not turn the product into a habit or streak tracker.

## Potential Mobile Experience

Status: Planned

Potential direction:

- Mobile-friendly quick Progress Update capture.
- Screenshot/photo attachment from phone.
- Timeline review on mobile.
- Lightweight goal and milestone status updates.

The main product remains an online browser-based learning tracker. A mobile app or PWA should extend the same hierarchy rather than introduce a separate daily logging model.
