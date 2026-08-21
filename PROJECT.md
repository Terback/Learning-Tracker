# Personal Learning Tracker

## Product Vision

Personal Learning Tracker is a progress-based learning workspace for organizing long-term learning goals, breaking them into milestones, and recording meaningful progress over time.

It is not a daily journal, habit tracker, streak tracker, or daily check-in app. A Progress Update is created manually whenever meaningful learning progress happens. There may be multiple updates in one day or no updates for weeks.

The product should help answer:

- What do I want to learn?
- What is my overall learning framework?
- What did I plan?
- What have I completed?
- Where am I currently?
- What progress did I make over time?

The long-term target is an online browser-based application that can be used from anywhere. The current repository is a v0.1 local prototype.

## Core Concepts

The core hierarchy is:

```text
Learning Goal
-> Milestones / Learning Plan
-> Progress Updates
-> Attachments / Resources
```

### Learning Goal

A high-level area of learning, such as Embedded / Engineering Learning, ESP32 & IoT, Computer Vision, or Hardware-Connected App Development.

A goal has a title, description, status, dates, tags, milestones, progress updates, and resources.

### Milestone / Learning Plan

A smaller unit of planned learning inside a goal. Milestones describe the intended learning path and make progress measurable.

Milestones can be reordered, edited, marked as planned, in progress, or completed, and used to calculate goal progress.

### Progress Update

A manually created record of meaningful learning progress. This is the main historical record of what happened over time.

Progress Updates may include notes, related milestone, concepts learned, skills developed, problems encountered, solutions, next step, tags, and attachments.

### Attachment

A file attached to a Progress Update. In v0.1, attachments are uploaded to local app storage under `public/uploads`. Planned production storage is Supabase Storage.

Supported v0.1 file types include PNG, JPG, GIF, PDF, Markdown, and plain text.

### Resource

A reference or learning material associated with a goal and optionally a milestone. Examples include websites, GitHub repositories, YouTube videos, datasheets, PDFs, documentation, courses, books, and personal notes.

### Tag

A reusable label that can organize goals, milestones, and progress updates.

## Product Terminology

Use these terms consistently:

- Use "Learning Goal" for a long-term learning objective.
- Use "Milestone" or "Learning Plan" for planned steps within a goal.
- Use "Progress Update" for meaningful logged progress.
- Use "Timeline" for chronological progress history.
- Use "Attachment" for uploaded files connected to a Progress Update.
- Use "Resource" for external or reference material.
- Do not describe the product as a daily tracker, habit tracker, journal, diary, or check-in app.

## User Workflow

The expected workflow is:

1. Create a Learning Goal.
2. Add and reorder Milestones to define the learning plan.
3. Mark milestones as planned, in progress, or completed as learning advances.
4. Create a Progress Update whenever meaningful progress happens.
5. Attach screenshots, files, PDFs, notes, or other evidence to the Progress Update.
6. Add Resources that support the goal or milestone.
7. Review the dashboard, roadmap, and timeline to understand current state and progress over time.

All ongoing maintenance must be manageable directly through the frontend. The user should not need to edit source code, JSON files, database rows, seed scripts, or backend code to maintain their learning tracker.

## Core Data Model

The current Prisma schema contains these models:

- `Goal`
- `Milestone`
- `ProgressLog`
- `Attachment`
- `Resource`
- `Tag`

Current enums include:

- `GoalStatus`: `ACTIVE`, `COMPLETED`, `ON_HOLD`, `PLANNED`
- `MilestoneStatus`: `TODO`, `IN_PROGRESS`, `COMPLETED`
- `Priority`: `LOW`, `MEDIUM`, `HIGH`
- `ResourceType`: `WEBSITE`, `GITHUB`, `YOUTUBE`, `DATASHEET`, `PDF`, `DOCUMENTATION`, `COURSE`, `BOOK`, `NOTES`, `OTHER`

Current relationships:

- A Goal has many Milestones.
- A Goal has many Progress Updates.
- A Goal has many Resources.
- A Milestone belongs to a Goal.
- A Progress Update belongs to a Goal and may belong to a Milestone.
- An Attachment belongs to a Progress Update.
- A Resource belongs to a Goal and may belong to a Milestone.
- Tags can be reused across Goals, Milestones, and Progress Updates.

Goal progress is currently calculated automatically from milestone completion:

```text
completed milestones / total milestones
```

## UX Principles

- The app must feel editable, not like a static dashboard.
- Create, read, update, delete, reorder, upload, and attach workflows should happen from the frontend.
- Inline editing is preferred where it makes the workflow faster.
- Modal forms are acceptable when they make editing clearer.
- Recording meaningful progress should be fast enough to do in less than a minute.
- The Goal page should make the learning plan and progress timeline visible together.
- The interface should feel like a modern productivity tool, closer to Notion, Linear, GitHub Projects, or Raycast than a generic admin panel.
- The design should prioritize clarity, scanning, and repeated use.
- Desktop is the primary experience, but layouts should remain responsive.

## Technical Architecture

### Current v0.1 Local Prototype

The current implementation uses:

- Next.js
- TypeScript
- Tailwind CSS
- Prisma
- SQLite
- Local file uploads under `public/uploads`
- API route at `app/api/data/route.ts` for CRUD operations
- API route at `app/api/upload/route.ts` for local uploads
- Main interactive frontend in `components/learning-app.tsx`
- Seed data in `scripts/seed.ts`

This local architecture is intended for prototyping and product validation.

### Current Production Architecture (in progress)

The application is migrating to a small multi-user-capable production architecture:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase Auth for email/password login and self-service signup, gated by a server-side email allow-list (`ALLOWED_SIGNUP_EMAILS`) so only pre-approved people can create an account
- Prisma against Supabase PostgreSQL (database migration complete)
- Supabase Storage for screenshots, images, PDFs, Markdown, and text files (all attachments; migration complete)
- Vercel deployment (not yet deployed)

`Goal` and `Tag` records carry a `userId` (the Supabase Auth user id). Every other model (`Milestone`, `ProgressLog`, `Attachment`, `Resource`) inherits ownership through its parent `Goal`. All API routes verify the authenticated user owns a record (or its parent Goal) before reading, updating, deleting, or creating child records — the frontend never determines access, only the API layer does.

Attachments uploaded before the Supabase Storage migration keep working from local `public/uploads` (`Attachment.fileUrl`); every attachment uploaded after the migration is stored in a private Supabase Storage bucket under `userId/progressLogId/filename` (`Attachment.filePath`) and served through short-lived signed URLs generated per request. Storage access is enforced by Supabase Storage RLS policies scoped to the requesting user's own auth id, not by a service-role key.

This remains a single-tenant-per-user model: no organizations, teams, roles, or shared data between accounts. It is designed to support roughly 20-30 independent users, each with fully private learning records, not collaboration between them.

SQLite (`prisma/dev.db`) is no longer the active datasource and is kept only as a rollback reference. Local `public/uploads` is still the active upload path pending the Supabase Storage migration.

## V1 Scope

V1 should focus on making the core personal learning workflow reliable:

- Create and edit Learning Goals.
- Create, edit, delete, complete, and reorder Milestones.
- Add, edit, and delete Progress Updates.
- Attach screenshots and files to Progress Updates.
- Manage Resources from the frontend.
- Use reusable Tags.
- Show a dashboard with goal and progress summaries.
- Show a goal detail workspace with roadmap and timeline.
- Calculate goal progress from milestone completion.
- Provide search and filters across goals, milestones, progress updates, concepts, skills, and tags.
- Persist user content in a real database.
- Prepare the architecture for Supabase and Vercel.

## Explicit Non-Goals

The product should not become any of the following unless explicitly requested:

- Daily journal
- Habit tracker
- Streak tracker
- Daily check-in tool
- Social network
- Course marketplace
- Multi-tenant organization tool
- Public learning portfolio
- LMS replacement
- Complicated permission system
- Analytics-heavy quantified-self dashboard

Future features such as AI summaries, GitHub integrations, analytics, mobile experiences, and cloud storage should build on the core hierarchy instead of replacing it.
