import { NextResponse } from "next/server";
import { Prisma, GoalStatus, MilestoneStatus, Priority, ResourceType } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getAuthedSupabase } from "@/lib/supabase/server";
import { ATTACHMENTS_BUCKET, SIGNED_URL_EXPIRES_IN } from "@/lib/storage";

export const dynamic = "force-dynamic";

const includeAll = {
  tags: true,
  milestones: { include: { tags: true }, orderBy: { order: "asc" as const } },
  progressLog: {
    include: { tags: true, attachments: true, milestone: true },
    orderBy: { date: "desc" as const }
  },
  resources: { include: { milestone: true }, orderBy: { updatedAt: "desc" as const } }
};

async function getTagConnections(userId: string, names: string[] = []) {
  const cleanNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  return cleanNames.map((name) => ({
    where: { userId_name: { userId, name } },
    create: { userId, name }
  }));
}

function parseDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  return new Date(`${value}T12:00:00`);
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// PERF-TEMP: diagnostic-only out-param for the GET /api/data slowdown investigation. Remove once resolved.
type PerfStats = { dbMs: number; signedUrlMs: number; signedUrlCallDurations: number[] };

// Attachments created before the Supabase Storage migration only have `fileUrl` (a local
// public/uploads path) and serve as-is. Attachments created after only have `filePath` (a
// Supabase Storage object key) and need a signed URL generated per request.
async function resolveAttachmentUrls<T extends { fileUrl: string | null; filePath: string | null }>(
  attachments: T[],
  supabase: SupabaseClient,
  callDurations?: number[] // PERF-TEMP: each createSignedUrls call's duration (ms), remove once resolved
) {
  const paths = attachments.filter((a) => a.filePath).map((a) => a.filePath as string);
  const signedUrlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const callStart = performance.now();
    const { data } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(paths, SIGNED_URL_EXPIRES_IN);
    callDurations?.push(performance.now() - callStart);
    for (const entry of data ?? []) {
      if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
    }
  }
  return attachments.map(({ fileUrl, filePath, ...rest }) => ({
    ...rest,
    fileUrl: (filePath ? signedUrlByPath.get(filePath) : fileUrl) || ""
  }));
}

async function getPayload(userId: string, email: string, supabase: SupabaseClient, perf?: PerfStats) {
  const dbStart = performance.now();
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: includeAll,
    orderBy: { updatedAt: "desc" }
  });
  const tags = await prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } });
  const profileRow = await prisma.userProfile.findUnique({ where: { userId } });
  if (perf) perf.dbMs = performance.now() - dbStart;

  const signedUrlStart = performance.now();
  const goalsWithUrls = await Promise.all(
    goals.map(async (goal) => ({
      ...goal,
      progressLog: await Promise.all(
        goal.progressLog.map(async (log) => ({
          ...log,
          attachments: await resolveAttachmentUrls(log.attachments, supabase, perf?.signedUrlCallDurations)
        }))
      )
    }))
  );
  if (perf) perf.signedUrlMs = performance.now() - signedUrlStart;

  return {
    goals: goalsWithUrls,
    tags,
    profile: { displayName: profileRow?.displayName ?? null, email }
  };
}

async function goalOwnedBy(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  return Boolean(goal);
}

async function milestoneInGoal(goalId: string, milestoneId: string) {
  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, goalId }, select: { id: true } });
  return Boolean(milestone);
}

async function removeStorageObjects(supabase: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
  if (error) console.error("Failed to remove storage objects:", error.message);
}

export async function GET() {
  // PERF-TEMP: diagnostic-only instrumentation for the GET /api/data slowdown investigation. Remove once resolved.
  // try/finally guarantees the summary line logs even if a phase throws.
  const tStart = performance.now();
  let authMs = 0;
  let serializeMs = 0;
  const perf: PerfStats = { dbMs: 0, signedUrlMs: 0, signedUrlCallDurations: [] };

  try {
    const authStart = performance.now();
    const { supabase, user } = await getAuthedSupabase();
    authMs = performance.now() - authStart;

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await getPayload(user.id, user.email ?? "", supabase, perf);

    const serializeStart = performance.now();
    const response = NextResponse.json(payload);
    serializeMs = performance.now() - serializeStart;
    return response;
  } finally {
    const totalMs = performance.now() - tStart;
    const calls = perf.signedUrlCallDurations;
    const min = calls.length ? Math.min(...calls) : 0;
    const max = calls.length ? Math.max(...calls) : 0;
    const sum = calls.reduce((a, b) => a + b, 0);

    console.log(
      `[perf-api-data] auth=${authMs.toFixed(1)}ms db=${perf.dbMs.toFixed(1)}ms signedUrls=${perf.signedUrlMs.toFixed(1)}ms serialize=${serializeMs.toFixed(1)}ms total=${totalMs.toFixed(1)}ms`
    );
    console.log(
      `[perf-api-data] signedUrlCalls count=${calls.length} min=${min.toFixed(1)}ms max=${max.toFixed(1)}ms sumOfCallDurations=${sum.toFixed(1)}ms wallClockPhase=${perf.signedUrlMs.toFixed(1)}ms`
    );
  }
}

const knownActions = new Set([
  "createGoal",
  "updateGoal",
  "deleteGoal",
  "createMilestone",
  "updateMilestone",
  "deleteMilestone",
  "reorderMilestones",
  "createProgressLog",
  "updateProgressLog",
  "deleteProgressLog",
  "deleteAttachment",
  "createResource",
  "updateResource",
  "deleteResource",
  "deleteTag",
  "updateProfile"
]);

export async function POST(request: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const body = await request.json();
  const action = String(body.action ?? "");
  const data = body.data ?? {};

  if (!knownActions.has(action)) {
    return NextResponse.json({ error: `Unknown action: "${action}"` }, { status: 400 });
  }

  try {
    if (action === "createGoal") {
      await prisma.goal.create({
        data: {
          userId,
          title: data.title || "Untitled goal",
          description: data.description || "",
          status: (data.status || "ACTIVE") as GoalStatus,
          startDate: parseDate(data.startDate),
          targetDate: parseDate(data.targetDate),
          tags: { connectOrCreate: await getTagConnections(userId, normalizeList(data.tags)) }
        }
      });
    }

    if (action === "updateGoal") {
      if (!(await goalOwnedBy(userId, data.id))) {
        return NextResponse.json({ error: "Goal not found." }, { status: 404 });
      }
      await prisma.goal.update({
        where: { id: data.id },
        data: {
          title: data.title,
          description: data.description,
          status: data.status as GoalStatus,
          startDate: parseDate(data.startDate),
          targetDate: parseDate(data.targetDate),
          tags: {
            set: [],
            connectOrCreate: await getTagConnections(userId, normalizeList(data.tags))
          }
        }
      });
    }

    if (action === "deleteGoal") {
      const existing = await prisma.goal.findFirst({
        where: { id: data.id, userId },
        select: { progressLog: { select: { attachments: { select: { filePath: true } } } } }
      });
      if (!existing) return NextResponse.json({ error: "Goal not found." }, { status: 404 });
      await prisma.goal.delete({ where: { id: data.id } });
      const paths = existing.progressLog.flatMap((log) =>
        log.attachments.map((a) => a.filePath).filter((p): p is string => Boolean(p))
      );
      await removeStorageObjects(supabase, paths);
    }

    if (action === "createMilestone") {
      if (!(await goalOwnedBy(userId, data.goalId))) {
        return NextResponse.json({ error: "Goal not found." }, { status: 404 });
      }
      const count = await prisma.milestone.count({ where: { goalId: data.goalId } });
      await prisma.milestone.create({
        data: {
          goalId: data.goalId,
          title: data.title || "Untitled milestone",
          description: data.description || "",
          status: (data.status || "TODO") as MilestoneStatus,
          priority: (data.priority || "MEDIUM") as Priority,
          order: count,
          targetDate: parseDate(data.targetDate),
          notes: data.notes || "",
          tags: { connectOrCreate: await getTagConnections(userId, normalizeList(data.tags)) }
        }
      });
    }

    if (action === "updateMilestone") {
      const milestone = await prisma.milestone.findFirst({ where: { id: data.id, goal: { userId } }, select: { id: true } });
      if (!milestone) return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
      await prisma.milestone.update({
        where: { id: data.id },
        data: {
          title: data.title,
          description: data.description,
          status: data.status as MilestoneStatus,
          priority: data.priority as Priority,
          targetDate: parseDate(data.targetDate),
          notes: data.notes,
          tags: {
            set: [],
            connectOrCreate: await getTagConnections(userId, normalizeList(data.tags))
          }
        }
      });
    }

    if (action === "deleteMilestone") {
      const deleted = await prisma.milestone.deleteMany({ where: { id: data.id, goal: { userId } } });
      if (deleted.count === 0) return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
    }

    if (action === "reorderMilestones") {
      const ids = data.ids as string[];
      const ownedCount = await prisma.milestone.count({ where: { id: { in: ids }, goal: { userId } } });
      if (ownedCount !== ids.length) {
        return NextResponse.json({ error: "One or more milestones not found." }, { status: 404 });
      }
      await prisma.$transaction(
        ids.map((id, order) => prisma.milestone.update({ where: { id }, data: { order } }))
      );
    }

    if (action === "createProgressLog") {
      if (!(await goalOwnedBy(userId, data.goalId))) {
        return NextResponse.json({ error: "Goal not found." }, { status: 404 });
      }
      if (data.milestoneId && !(await milestoneInGoal(data.goalId, data.milestoneId))) {
        return NextResponse.json({ error: "Invalid milestone for this goal." }, { status: 400 });
      }
      const log = await prisma.progressLog.create({
        data: {
          goalId: data.goalId,
          milestoneId: data.milestoneId || null,
          title: data.title || "Progress update",
          content: data.content || "",
          date: parseDate(data.date) ?? new Date(),
          conceptsLearned: data.conceptsLearned || "",
          skillsDeveloped: data.skillsDeveloped || "",
          problems: data.problems || "",
          solutions: data.solutions || "",
          nextStep: data.nextStep || "",
          tags: { connectOrCreate: await getTagConnections(userId, normalizeList(data.tags)) }
        }
      });
      return NextResponse.json({ ...(await getPayload(userId, user.email ?? "", supabase)), createdId: log.id });
    }

    if (action === "updateProgressLog") {
      const existing = await prisma.progressLog.findFirst({
        where: { id: data.id, goal: { userId } },
        select: { goalId: true }
      });
      if (!existing) return NextResponse.json({ error: "Progress update not found." }, { status: 404 });
      if (data.milestoneId && !(await milestoneInGoal(existing.goalId, data.milestoneId))) {
        return NextResponse.json({ error: "Invalid milestone for this goal." }, { status: 400 });
      }
      await prisma.progressLog.update({
        where: { id: data.id },
        data: {
          milestoneId: data.milestoneId || null,
          title: data.title,
          content: data.content,
          date: parseDate(data.date) ?? new Date(),
          conceptsLearned: data.conceptsLearned || "",
          skillsDeveloped: data.skillsDeveloped || "",
          problems: data.problems || "",
          solutions: data.solutions || "",
          nextStep: data.nextStep || "",
          tags: {
            set: [],
            connectOrCreate: await getTagConnections(userId, normalizeList(data.tags))
          }
        }
      });
    }

    if (action === "deleteProgressLog") {
      const existing = await prisma.progressLog.findFirst({
        where: { id: data.id, goal: { userId } },
        select: { attachments: { select: { filePath: true } } }
      });
      if (!existing) return NextResponse.json({ error: "Progress update not found." }, { status: 404 });
      await prisma.progressLog.delete({ where: { id: data.id } });
      const paths = existing.attachments.map((a) => a.filePath).filter((p): p is string => Boolean(p));
      await removeStorageObjects(supabase, paths);
    }

    if (action === "deleteAttachment") {
      const existing = await prisma.attachment.findFirst({
        where: { id: data.id, progressLog: { goal: { userId } } },
        select: { filePath: true }
      });
      if (!existing) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
      await prisma.attachment.delete({ where: { id: data.id } });
      if (existing.filePath) await removeStorageObjects(supabase, [existing.filePath]);
    }

    if (action === "createResource") {
      if (!(await goalOwnedBy(userId, data.goalId))) {
        return NextResponse.json({ error: "Goal not found." }, { status: 404 });
      }
      if (data.milestoneId && !(await milestoneInGoal(data.goalId, data.milestoneId))) {
        return NextResponse.json({ error: "Invalid milestone for this goal." }, { status: 400 });
      }
      await prisma.resource.create({
        data: {
          goalId: data.goalId,
          milestoneId: data.milestoneId || null,
          title: data.title || "Untitled resource",
          url: data.url || "",
          type: (data.type || "OTHER") as ResourceType,
          description: data.description || ""
        }
      });
    }

    if (action === "updateResource") {
      const existing = await prisma.resource.findFirst({
        where: { id: data.id, goal: { userId } },
        select: { goalId: true }
      });
      if (!existing) return NextResponse.json({ error: "Resource not found." }, { status: 404 });
      if (data.milestoneId && !(await milestoneInGoal(existing.goalId, data.milestoneId))) {
        return NextResponse.json({ error: "Invalid milestone for this goal." }, { status: 400 });
      }
      await prisma.resource.update({
        where: { id: data.id },
        data: {
          milestoneId: data.milestoneId || null,
          title: data.title,
          url: data.url,
          type: data.type as ResourceType,
          description: data.description
        }
      });
    }

    if (action === "deleteResource") {
      const deleted = await prisma.resource.deleteMany({ where: { id: data.id, goal: { userId } } });
      if (deleted.count === 0) return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    if (action === "deleteTag") {
      const deleted = await prisma.tag.deleteMany({ where: { id: data.id, userId } });
      if (deleted.count === 0) return NextResponse.json({ error: "Tag not found." }, { status: 404 });
    }

    if (action === "updateProfile") {
      const displayName = String(data.displayName ?? "").trim();
      if (!displayName) {
        return NextResponse.json({ error: "Display name is required." }, { status: 400 });
      }
      await prisma.userProfile.upsert({
        where: { userId },
        update: { displayName },
        create: { userId, displayName }
      });
    }

    return NextResponse.json(await getPayload(userId, user.email ?? "", supabase));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to save changes." }, { status: 500 });
  }
}
