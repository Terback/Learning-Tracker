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

Status: Planned

Purpose:

- Move persistent data from local SQLite to Supabase PostgreSQL.
- Keep Prisma or choose a Supabase-native data access strategy after evaluating tradeoffs.
- Preserve the existing product hierarchy and editable frontend workflows.

Expected work:

- Update database provider and connection configuration.
- Create migrations for Goal, Milestone, ProgressLog, Attachment, Resource, Tag, and join tables.
- Verify cascade behavior and nullable milestone relationships.
- Add production-safe environment variable documentation.
- Migrate or recreate seed/demo data as needed.

## Supabase Storage Migration

Status: Planned

Purpose:

- Move attachments from local `public/uploads` storage to Supabase Storage.
- Support browser-based production uploads for screenshots, images, PDFs, Markdown, and text files.

Expected work:

- Create storage bucket strategy.
- Replace local upload route behavior with Supabase Storage uploads.
- Store public or signed file URLs in `Attachment`.
- Add delete behavior that removes both database records and storage objects.
- Confirm image previews and downloadable file links still work in the timeline.

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
