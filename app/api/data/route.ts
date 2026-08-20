import { NextResponse } from "next/server";
import { Prisma, GoalStatus, MilestoneStatus, Priority, ResourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

async function getTagConnections(names: string[] = []) {
  const cleanNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  return cleanNames.map((name) => ({
    where: { name },
    create: { name }
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

async function getPayload() {
  const goals = await prisma.goal.findMany({
    include: includeAll,
    orderBy: { updatedAt: "desc" }
  });
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return { goals, tags };
}

export async function GET() {
  return NextResponse.json(await getPayload());
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
  "deleteTag"
]);

export async function POST(request: Request) {
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
          title: data.title || "Untitled goal",
          description: data.description || "",
          status: (data.status || "ACTIVE") as GoalStatus,
          startDate: parseDate(data.startDate),
          targetDate: parseDate(data.targetDate),
          tags: { connectOrCreate: await getTagConnections(normalizeList(data.tags)) }
        }
      });
    }

    if (action === "updateGoal") {
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
            connectOrCreate: await getTagConnections(normalizeList(data.tags))
          }
        }
      });
    }

    if (action === "deleteGoal") {
      await prisma.goal.delete({ where: { id: data.id } });
    }

    if (action === "createMilestone") {
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
          tags: { connectOrCreate: await getTagConnections(normalizeList(data.tags)) }
        }
      });
    }

    if (action === "updateMilestone") {
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
            connectOrCreate: await getTagConnections(normalizeList(data.tags))
          }
        }
      });
    }

    if (action === "deleteMilestone") {
      await prisma.milestone.delete({ where: { id: data.id } });
    }

    if (action === "reorderMilestones") {
      const ids = data.ids as string[];
      await prisma.$transaction(
        ids.map((id, order) => prisma.milestone.update({ where: { id }, data: { order } }))
      );
    }

    if (action === "createProgressLog") {
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
          tags: { connectOrCreate: await getTagConnections(normalizeList(data.tags)) }
        }
      });
      return NextResponse.json({ ...(await getPayload()), createdId: log.id });
    }

    if (action === "updateProgressLog") {
      await prisma.progressLog.update({
        where: { id: data.id },
        data: {
          goalId: data.goalId,
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
            connectOrCreate: await getTagConnections(normalizeList(data.tags))
          }
        }
      });
    }

    if (action === "deleteProgressLog") {
      await prisma.progressLog.delete({ where: { id: data.id } });
    }

    if (action === "deleteAttachment") {
      await prisma.attachment.delete({ where: { id: data.id } });
    }

    if (action === "createResource") {
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
      await prisma.resource.update({
        where: { id: data.id },
        data: {
          goalId: data.goalId,
          milestoneId: data.milestoneId || null,
          title: data.title,
          url: data.url,
          type: data.type as ResourceType,
          description: data.description
        }
      });
    }

    if (action === "deleteResource") {
      await prisma.resource.delete({ where: { id: data.id } });
    }

    if (action === "deleteTag") {
      await prisma.tag.delete({ where: { id: data.id } });
    }

    return NextResponse.json(await getPayload());
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to save changes." }, { status: 500 });
  }
}
