"use client";

import type React from "react";
import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  Archive,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock3,
  Edit3,
  FileText,
  GripVertical,
  LayoutDashboard,
  Link as LinkIcon,
  Moon,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  X
} from "lucide-react";
import clsx from "clsx";

type Status = "ACTIVE" | "COMPLETED" | "ON_HOLD" | "PLANNED";
type MilestoneStatus = "TODO" | "IN_PROGRESS" | "COMPLETED";
type Priority = "LOW" | "MEDIUM" | "HIGH";
type ResourceType =
  | "WEBSITE"
  | "GITHUB"
  | "YOUTUBE"
  | "DATASHEET"
  | "PDF"
  | "DOCUMENTATION"
  | "COURSE"
  | "BOOK"
  | "NOTES"
  | "OTHER";

type Tag = { id: string; name: string };
type Attachment = { id: string; fileName: string; fileUrl: string; fileType: string; createdAt: string };
type Milestone = {
  id: string;
  goalId: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  priority: Priority;
  order: number;
  targetDate: string | null;
  notes: string;
  updatedAt: string;
  tags: Tag[];
};
type ProgressLog = {
  id: string;
  goalId: string;
  milestoneId: string | null;
  title: string;
  content: string;
  date: string;
  conceptsLearned: string;
  skillsDeveloped: string;
  problems: string;
  solutions: string;
  nextStep: string;
  updatedAt: string;
  milestone?: Milestone | null;
  attachments: Attachment[];
  tags: Tag[];
};
type Resource = {
  id: string;
  goalId: string;
  milestoneId: string | null;
  title: string;
  url: string;
  type: ResourceType;
  description: string;
  milestone?: Milestone | null;
};
type Goal = {
  id: string;
  title: string;
  description: string;
  status: Status;
  startDate: string | null;
  targetDate: string | null;
  updatedAt: string;
  milestones: Milestone[];
  progressLog: ProgressLog[];
  resources: Resource[];
  tags: Tag[];
};

type Data = { goals: Goal[]; tags: Tag[] };
type View = "dashboard" | "goals" | "timeline" | "resources" | "tags" | "settings";

const statusLabels: Record<Status, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  PLANNED: "Planned"
};

const milestoneLabels: Record<MilestoneStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed"
};

const resourceTypes: ResourceType[] = [
  "WEBSITE",
  "GITHUB",
  "YOUTUBE",
  "DATASHEET",
  "PDF",
  "DOCUMENTATION",
  "COURSE",
  "BOOK",
  "NOTES",
  "OTHER"
];

const emptyGoal = {
  title: "",
  description: "",
  status: "ACTIVE" as Status,
  startDate: "",
  targetDate: "",
  tags: ""
};

const emptyMilestone = {
  title: "",
  description: "",
  status: "TODO" as MilestoneStatus,
  priority: "MEDIUM" as Priority,
  targetDate: "",
  notes: "",
  tags: ""
};

const emptyLog = {
  title: "",
  content: "",
  date: new Date().toISOString().slice(0, 10),
  milestoneId: "",
  conceptsLearned: "",
  skillsDeveloped: "",
  problems: "",
  solutions: "",
  nextStep: "",
  tags: ""
};

const emptyResource = {
  title: "",
  url: "",
  type: "DOCUMENTATION" as ResourceType,
  description: "",
  milestoneId: ""
};

function toDateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function progressFor(goal: Goal) {
  if (goal.milestones.length === 0) return 0;
  return Math.round((goal.milestones.filter((item) => item.status === "COMPLETED").length / goal.milestones.length) * 100);
}

function tagString(tags: Tag[]) {
  return tags.map((tag) => tag.name).join(", ");
}

function confirmAction(message: string) {
  return window.confirm(message);
}

function matchesGoal(goal: Goal, query: string, filter: string) {
  const haystack = [
    goal.title,
    goal.description,
    goal.status,
    ...goal.tags.map((tag) => tag.name),
    ...goal.milestones.flatMap((item) => [item.title, item.description, item.notes, ...item.tags.map((tag) => tag.name)]),
    ...goal.progressLog.flatMap((item) => [
      item.title,
      item.content,
      item.conceptsLearned,
      item.skillsDeveloped,
      ...item.tags.map((tag) => tag.name)
    ])
  ]
    .join(" ")
    .toLowerCase();
  const queryMatch = !query || haystack.includes(query.toLowerCase());
  const filterMatch = filter === "ALL" || goal.status === filter;
  return queryMatch && filterMatch;
}

export function LearningApp() {
  const [data, setData] = useState<Data>({ goals: [], tags: [] });
  const [selectedId, setSelectedId] = useState<string>("");
  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [dark, setDark] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [quickModal, setQuickModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const router = useRouter();

  async function load() {
    const response = await fetch("/api/data", { cache: "no-store" });
    if (response.status === 401) {
      router.replace("/login");
      return;
    }
    const payload = await response.json();
    setData(payload);
    setSelectedId((current) => current || payload.goals[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  async function mutate(action: string, payload: unknown, message: string) {
    const response = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data: payload })
    });
    if (response.status === 401) {
      router.replace("/login");
      throw new Error("Your session expired. Please log in again.");
    }
    const next = await response.json();
    if (!response.ok) throw new Error(next.error || "Unable to save changes.");
    setData({ goals: next.goals, tags: next.tags });
    if (next.createdId) setSelectedId((payload as { goalId?: string }).goalId || selectedId);
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
    return next;
  }

  const selectedGoal = data.goals.find((goal) => goal.id === selectedId) || data.goals[0];
  const visibleGoals = data.goals.filter((goal) => matchesGoal(goal, query, filter));
  const logs = data.goals.flatMap((goal) => goal.progressLog.map((log) => ({ ...log, goal }))).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const resources = data.goals.flatMap((goal) => goal.resources.map((resource) => ({ ...resource, goal })));

  const stats = useMemo(() => {
    const milestones = data.goals.flatMap((goal) => goal.milestones);
    const progressLogs = data.goals.flatMap((goal) => goal.progressLog);
    return {
      total: data.goals.length,
      active: data.goals.filter((goal) => goal.status === "ACTIVE").length,
      completed: data.goals.filter((goal) => goal.status === "COMPLETED").length,
      milestones: milestones.length,
      logs: progressLogs.length,
      recent: progressLogs[0]?.title || "No activity yet"
    };
  }, [data.goals]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Opening your learning workspace...</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#f7f8fb] text-slate-950 dark:bg-[#101214] dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white/92 px-4 py-5 backdrop-blur dark:border-white/10 dark:bg-[#151719]/92 lg:block">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="font-semibold">Learning Tracker</div>
            <div className="text-xs text-slate-500">Personal OS</div>
          </div>
        </div>
        <nav className="space-y-1">
          <NavButton icon={<LayoutDashboard size={17} />} label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} />
          <NavButton icon={<ClipboardList size={17} />} label="Goals" active={view === "goals"} onClick={() => setView("goals")} />
          <NavButton icon={<Clock3 size={17} />} label="Timeline" active={view === "timeline"} onClick={() => setView("timeline")} />
          <NavButton icon={<Archive size={17} />} label="Resources" active={view === "resources"} onClick={() => setView("resources")} />
          <NavButton icon={<Tags size={17} />} label="Tags" active={view === "tags"} onClick={() => setView("tags")} />
          <NavButton icon={<Settings size={17} />} label="Settings" active={view === "settings"} onClick={() => setView("settings")} />
        </nav>
        <button
          onClick={() => setQuickModal(true)}
          className="absolute bottom-5 left-4 right-4 flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          <Sparkles size={16} /> Quick Add
        </button>
      </aside>

      <main className="w-full lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-[#f7f8fb]/88 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#101214]/88 md:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setGoalModal(true)} className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-950">
                <Plus size={16} /> New Learning Goal
              </button>
              <button onClick={() => setQuickModal(true)} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium dark:border-white/10 dark:bg-white/5">
                <Sparkles size={16} /> Quick Update
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row xl:max-w-2xl">
              <label className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search goals, logs, concepts, skills, tags..." className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-white/5" />
              </label>
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none dark:border-white/10 dark:bg-[#151719]">
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="PLANNED">Planned</option>
              </select>
              <button aria-label="Toggle dark mode" onClick={() => setDark((value) => !value)} className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
                <Moon size={16} />
              </button>
            </div>
          </div>
        </header>

        <div className="px-4 py-6 md:px-8">
          {view === "dashboard" && <Dashboard stats={stats} goals={visibleGoals} onOpen={(id) => { setSelectedId(id); setView("goals"); }} onEdit={setEditingGoal} />}
          {view === "goals" && selectedGoal && <GoalWorkspace goal={selectedGoal} mutate={mutate} onDeleteGoal={async (id) => { await mutate("deleteGoal", { id }, "Goal deleted"); setSelectedId(data.goals.find((goal) => goal.id !== id)?.id || ""); }} />}
          {view === "timeline" && <TimelineView logs={logs} goals={data.goals} mutate={mutate} />}
          {view === "resources" && <ResourcesView resources={resources} goals={data.goals} mutate={mutate} />}
          {view === "tags" && <TagsView tags={data.tags} mutate={mutate} />}
          {view === "settings" && <SettingsView />}
        </div>
      </main>

      {goalModal && (
        <GoalModal
          onClose={() => setGoalModal(false)}
          onSave={async (payload) => {
            await mutate("createGoal", payload, "Goal created");
            setGoalModal(false);
          }}
        />
      )}
      {editingGoal && (
        <GoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={async (payload) => {
            await mutate("updateGoal", { ...payload, id: editingGoal.id }, "Goal updated");
            setEditingGoal(null);
          }}
        />
      )}
      {quickModal && <QuickUpdateModal goals={data.goals} mutate={mutate} onClose={() => setQuickModal(false)} />}
      {toast && <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-soft dark:bg-white dark:text-slate-950">{toast}</div>}
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={clsx("flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition", active ? "bg-slate-100 text-slate-950 dark:bg-white/10 dark:text-white" : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5")}>
      {icon}
      {label}
    </button>
  );
}

function Dashboard({ stats, goals, onOpen, onEdit }: { stats: Record<string, string | number>; goals: Goal[]; onOpen: (id: string) => void; onEdit: (goal: Goal) => void }) {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Track where you are going, what you finished, and what changed recently.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total Goals" value={stats.total} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Milestones" value={stats.milestones} />
        <Stat label="Progress Logs" value={stats.logs} />
        <Stat label="Recent Activity" value={stats.recent} compact />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {goals.map((goal) => (
          <article key={goal.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <button onClick={() => onOpen(goal.id)} className="block w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{goal.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{goal.description}</p>
                </div>
                <Badge>{statusLabels[goal.status]}</Badge>
              </div>
              <ProgressBar value={progressFor(goal)} className="mt-5" />
              <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                <span>{goal.milestones.filter((item) => item.status === "COMPLETED").length} / {goal.milestones.length} milestones completed</span>
                <span>{progressFor(goal)}%</span>
              </div>
              <div className="mt-4 text-xs text-slate-400">Last updated: {formatDate(goal.updatedAt)}</div>
            </button>
            <button onClick={() => onEdit(goal)} className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm dark:border-white/10">
              <Edit3 size={14} /> Edit
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className={clsx("mt-2 font-semibold", compact ? "truncate text-sm" : "text-2xl")}>{value}</div>
    </div>
  );
}

function GoalWorkspace({ goal, mutate, onDeleteGoal }: { goal: Goal; mutate: (action: string, payload: unknown, message: string) => Promise<any>; onDeleteGoal: (id: string) => Promise<void> }) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [milestoneModal, setMilestoneModal] = useState<Milestone | "new" | null>(null);
  const [logModal, setLogModal] = useState<ProgressLog | "new" | null>(null);
  const [resourceModal, setResourceModal] = useState<Resource | "new" | null>(null);
  const [dragId, setDragId] = useState<string>("");

  async function moveMilestone(overId: string) {
    if (!dragId || dragId === overId) return;
    const ids = goal.milestones.map((item) => item.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(overId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await mutate("reorderMilestones", { ids }, "Milestones reordered");
    setDragId("");
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <input value={goal.title} onChange={(event) => mutate("updateGoal", { ...goal, title: event.target.value, startDate: toDateInput(goal.startDate), targetDate: toDateInput(goal.targetDate), tags: tagString(goal.tags) }, "Goal title updated")} className="w-full bg-transparent text-2xl font-semibold outline-none" />
            <textarea value={goal.description} onChange={(event) => mutate("updateGoal", { ...goal, description: event.target.value, startDate: toDateInput(goal.startDate), targetDate: toDateInput(goal.targetDate), tags: tagString(goal.tags) }, "Goal description updated")} className="mt-2 min-h-16 w-full resize-none bg-transparent text-sm text-slate-500 outline-none" />
            <div className="mt-3 flex flex-wrap gap-2">{goal.tags.map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>
          </div>
          <div className="grid min-w-72 gap-3">
            <ProgressBar value={progressFor(goal)} />
            <div className="grid grid-cols-2 gap-2">
              <select value={goal.status} onChange={(event) => mutate("updateGoal", { ...goal, status: event.target.value, startDate: toDateInput(goal.startDate), targetDate: toDateInput(goal.targetDate), tags: tagString(goal.tags) }, "Goal status updated")} className="h-10 rounded-lg border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10">
                {Object.keys(statusLabels).map((status) => <option key={status} value={status}>{statusLabels[status as Status]}</option>)}
              </select>
              <button onClick={() => setEditingGoal(true)} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm dark:border-white/10"><Edit3 size={14} /> Edit Goal</button>
              <DateField value={toDateInput(goal.startDate)} onChange={(value) => mutate("updateGoal", { ...goal, startDate: value, targetDate: toDateInput(goal.targetDate), tags: tagString(goal.tags) }, "Start date updated")} />
              <DateField value={toDateInput(goal.targetDate)} onChange={(value) => mutate("updateGoal", { ...goal, startDate: toDateInput(goal.startDate), targetDate: value, tags: tagString(goal.tags) }, "Target date updated")} />
            </div>
            <button
              onClick={() => confirmAction(`Delete goal "${goal.title}"? This removes all of its milestones, progress updates, and resources. This cannot be undone.`) && onDeleteGoal(goal.id)}
              aria-label={`Delete goal ${goal.title}`}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <Trash2 size={14} /> Delete Goal
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.86fr)_minmax(520px,1.14fr)]">
        <div className="space-y-5">
          <Panel title="Roadmap" action={<button onClick={() => setMilestoneModal("new")} className="IconButton"><Plus size={16} /></button>}>
            <div className="space-y-2">
              {goal.milestones.map((milestone) => (
                <div key={milestone.id} draggable onDragStart={() => setDragId(milestone.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveMilestone(milestone.id)} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/10">
                  <div className="flex items-start gap-3">
                    <GripVertical className="mt-1 text-slate-300" size={16} />
                    <button onClick={() => mutate("updateMilestone", { ...milestone, status: milestone.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED", targetDate: toDateInput(milestone.targetDate), tags: tagString(milestone.tags) }, "Milestone updated")} className="mt-0.5">
                      {milestone.status === "COMPLETED" ? <Check className="text-emerald-600" size={18} /> : milestone.status === "IN_PROGRESS" ? <Circle className="fill-amber-300 text-amber-500" size={18} /> : <Circle className="text-slate-300" size={18} />}
                    </button>
                    <button onClick={() => setMilestoneModal(milestone)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-medium">{milestone.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{milestoneLabels[milestone.status]}</span>
                        <span>{milestone.priority}</span>
                        <span>{formatDate(milestone.targetDate)}</span>
                      </div>
                    </button>
                    <button onClick={() => confirmAction(`Delete milestone "${milestone.title}"? This cannot be undone.`) && mutate("deleteMilestone", { id: milestone.id }, "Milestone deleted")} aria-label={`Delete milestone ${milestone.title}`} className="text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Resources" action={<button onClick={() => setResourceModal("new")} className="IconButton"><Plus size={16} /></button>}>
            <div className="space-y-2">
              {goal.resources.map((resource) => (
                <div key={resource.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                  <LinkIcon className="mt-1 text-slate-400" size={15} />
                  <button onClick={() => setResourceModal(resource)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium">{resource.title}</div>
                    <div className="truncate text-xs text-slate-500">{resource.type} · {resource.url}</div>
                  </button>
                  <button onClick={() => confirmAction(`Delete resource "${resource.title}"? This cannot be undone.`) && mutate("deleteResource", { id: resource.id }, "Resource deleted")} aria-label={`Delete resource ${resource.title}`} className="text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Progress Timeline" action={<button onClick={() => setLogModal("new")} className="flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white dark:bg-white dark:text-slate-950"><Plus size={16} /> Add Progress Update</button>}>
          <TimelineItems logs={goal.progressLog} onEdit={setLogModal} mutate={mutate} />
        </Panel>
      </div>

      {editingGoal && <GoalModal goal={goal} onClose={() => setEditingGoal(false)} onSave={async (payload) => { await mutate("updateGoal", { ...payload, id: goal.id }, "Goal updated"); setEditingGoal(false); }} />}
      {milestoneModal && <MilestoneModal goal={goal} milestone={milestoneModal === "new" ? undefined : milestoneModal} onClose={() => setMilestoneModal(null)} onSave={async (payload) => { await mutate(milestoneModal === "new" ? "createMilestone" : "updateMilestone", milestoneModal === "new" ? { ...payload, goalId: goal.id } : { ...payload, id: (milestoneModal as Milestone).id, goalId: goal.id }, milestoneModal === "new" ? "Milestone created" : "Milestone updated"); setMilestoneModal(null); }} />}
      {logModal && <LogModal goal={goal} log={logModal === "new" ? undefined : logModal} mutate={mutate} onClose={() => setLogModal(null)} />}
      {resourceModal && <ResourceModal goal={goal} resource={resourceModal === "new" ? undefined : resourceModal} onClose={() => setResourceModal(null)} onSave={async (payload) => { await mutate(resourceModal === "new" ? "createResource" : "updateResource", resourceModal === "new" ? { ...payload, goalId: goal.id } : { ...payload, id: (resourceModal as Resource).id, goalId: goal.id }, resourceModal === "new" ? "Resource added" : "Resource updated"); setResourceModal(null); }} />}
    </section>
  );
}

function TimelineItems({ logs, onEdit, mutate }: { logs: ProgressLog[]; onEdit: (log: ProgressLog) => void; mutate: (action: string, payload: unknown, message: string) => Promise<any> }) {
  const [preview, setPreview] = useState<Attachment | null>(null);
  return (
    <div className="space-y-5">
      {logs.map((log) => (
        <article key={log.id} className="relative border-l border-slate-200 pl-5 dark:border-white/10">
          <span className="absolute -left-1.5 top-1 size-3 rounded-full bg-slate-950 dark:bg-white" />
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <CalendarDays size={14} /> {formatDate(log.date)}
                {log.milestone && <Badge>{log.milestone.title}</Badge>}
              </div>
              <button onClick={() => onEdit(log)} className="mt-1 text-left text-lg font-semibold">{log.title}</button>
            </div>
            <button onClick={() => confirmAction(`Delete progress update "${log.title}"? This cannot be undone.`) && mutate("deleteProgressLog", { id: log.id }, "Progress log deleted")} aria-label={`Delete progress update ${log.title}`} className="text-slate-400 hover:text-rose-500"><Trash2 size={16} /></button>
          </div>
          <MarkdownLite value={log.content} />
          <DetailGrid log={log} />
          {log.attachments.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {log.attachments.map((attachment) => (
                <div key={attachment.id} className="group rounded-lg border border-slate-200 p-2 dark:border-white/10">
                  {attachment.fileType.startsWith("image/") ? (
                    <button onClick={() => setPreview(attachment)} className="block w-full overflow-hidden rounded-md bg-slate-100 dark:bg-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachment.fileUrl} alt={attachment.fileName} className="h-36 w-full object-cover transition group-hover:scale-[1.02]" />
                    </button>
                  ) : (
                    <a href={attachment.fileUrl} target="_blank" className="flex h-20 items-center gap-3 rounded-md bg-slate-50 p-3 text-sm dark:bg-black/20">
                      <FileText size={20} /> {attachment.fileName}
                    </a>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="truncate">{attachment.fileName}</span>
                    <button onClick={() => confirmAction(`Delete attachment "${attachment.fileName}"? This cannot be undone.`) && mutate("deleteAttachment", { id: attachment.id }, "Attachment removed")} aria-label={`Delete attachment ${attachment.fileName}`}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
      {logs.length === 0 && <EmptyState label="No progress logs yet." />}
      {preview && <ImagePreview attachment={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function DetailGrid({ log }: { log: ProgressLog }) {
  const items = [
    ["Concepts", log.conceptsLearned],
    ["Skills", log.skillsDeveloped],
    ["Problems", log.problems],
    ["Solutions", log.solutions],
    ["Next", log.nextStep]
  ].filter(([, value]) => value);
  if (items.length === 0) return null;
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-black/20">
          <div className="mb-1 text-xs uppercase text-slate-400">{label}</div>
          <div className="text-slate-600 dark:text-slate-300">{value}</div>
        </div>
      ))}
    </div>
  );
}

function TimelineView({ logs, goals, mutate }: { logs: (ProgressLog & { goal: Goal })[]; goals: Goal[]; mutate: (action: string, payload: unknown, message: string) => Promise<any> }) {
  const [editing, setEditing] = useState<ProgressLog | null>(null);
  const goal = goals.find((item) => item.id === editing?.goalId);
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Timeline</h1>
        <p className="mt-1 text-sm text-slate-500">All progress updates across every learning goal.</p>
      </div>
      <Panel title="Recent Progress">
        <TimelineItems logs={logs} onEdit={setEditing} mutate={mutate} />
      </Panel>
      {editing && goal && <LogModal goal={goal} log={editing} mutate={mutate} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ResourcesView({ resources, goals, mutate }: { resources: (Resource & { goal: Goal })[]; goals: Goal[]; mutate: (action: string, payload: unknown, message: string) => Promise<any> }) {
  const [editing, setEditing] = useState<Resource | null>(null);
  const goal = goals.find((item) => item.id === editing?.goalId);
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Resources</h1>
        <p className="mt-1 text-sm text-slate-500">Links, docs, datasheets, courses, books, and notes attached to your goals.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {resources.map((resource) => (
          <button key={resource.id} onClick={() => setEditing(resource)} className="rounded-lg border border-slate-200 bg-white p-4 text-left dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{resource.title}</div>
                <div className="mt-1 text-sm text-slate-500">{resource.goal.title} · {resource.type}</div>
              </div>
              <LinkIcon size={16} className="text-slate-400" />
            </div>
            <p className="mt-3 text-sm text-slate-500">{resource.description}</p>
          </button>
        ))}
      </div>
      {editing && goal && <ResourceModal goal={goal} resource={editing} onClose={() => setEditing(null)} onSave={async (payload) => { await mutate("updateResource", { ...payload, id: editing.id, goalId: editing.goalId }, "Resource updated"); setEditing(null); }} />}
    </section>
  );
}

function TagsView({ tags, mutate }: { tags: Tag[]; mutate: (action: string, payload: unknown, message: string) => Promise<any> }) {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Tags</h1>
        <p className="mt-1 text-sm text-slate-500">Reusable labels for goals, milestones, and timeline entries.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]">
            {tag.name}
            <button onClick={() => confirmAction(`Delete tag "${tag.name}"? This removes it from every goal, milestone, and progress update.`) && mutate("deleteTag", { id: tag.id }, "Tag deleted")} aria-label={`Delete tag ${tag.name}`} className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
          </span>
        ))}
      </div>
    </section>
  );
}

function SettingsView() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Your data is stored in Supabase PostgreSQL through Prisma, scoped privately to your account.</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="text-sm font-medium">Account</div>
        <p className="mt-1 text-sm text-slate-500">Sign out of your Learning Tracker workspace on this device.</p>
        <button
          onClick={handleLogout}
          disabled={signingOut}
          className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium disabled:opacity-60 dark:border-white/10"
        >
          {signingOut ? "Signing out..." : "Log out"}
        </button>
      </div>
    </section>
  );
}

function GoalModal({ goal, onClose, onSave }: { goal?: Goal; onClose: () => void; onSave: (payload: typeof emptyGoal) => Promise<void> }) {
  const [form, setForm] = useState({
    title: goal?.title || "",
    description: goal?.description || "",
    status: goal?.status || "ACTIVE",
    startDate: toDateInput(goal?.startDate),
    targetDate: toDateInput(goal?.targetDate),
    tags: goal ? tagString(goal.tags) : ""
  } as typeof emptyGoal);
  return (
    <Modal title={goal ? "Edit Goal" : "New Learning Goal"} onClose={onClose}>
      <FormShell onSubmit={() => onSave(form)}>
        <TextInput label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} autoFocus />
        <TextArea label="Description" value={form.description} onChange={(description) => setForm({ ...form, description })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectInput label="Status" value={form.status} onChange={(status) => setForm({ ...form, status: status as Status })} options={Object.keys(statusLabels)} />
          <DateInput label="Start date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} />
          <DateInput label="Target date" value={form.targetDate} onChange={(targetDate) => setForm({ ...form, targetDate })} />
        </div>
        <TextInput label="Tags" value={form.tags} onChange={(tags) => setForm({ ...form, tags })} placeholder="ESP32, Hardware, AI" />
      </FormShell>
    </Modal>
  );
}

function MilestoneModal({ goal, milestone, onClose, onSave }: { goal: Goal; milestone?: Milestone; onClose: () => void; onSave: (payload: typeof emptyMilestone) => Promise<void> }) {
  const [form, setForm] = useState({
    title: milestone?.title || "",
    description: milestone?.description || "",
    status: milestone?.status || "TODO",
    priority: milestone?.priority || "MEDIUM",
    targetDate: toDateInput(milestone?.targetDate),
    notes: milestone?.notes || "",
    tags: milestone ? tagString(milestone.tags) : ""
  } as typeof emptyMilestone);
  return (
    <Modal title={milestone ? "Edit Milestone" : `Add Milestone to ${goal.title}`} onClose={onClose}>
      <FormShell onSubmit={() => onSave(form)}>
        <TextInput label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} autoFocus />
        <TextArea label="Description" value={form.description} onChange={(description) => setForm({ ...form, description })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectInput label="Status" value={form.status} onChange={(status) => setForm({ ...form, status: status as MilestoneStatus })} options={Object.keys(milestoneLabels)} />
          <SelectInput label="Priority" value={form.priority} onChange={(priority) => setForm({ ...form, priority: priority as Priority })} options={["LOW", "MEDIUM", "HIGH"]} />
          <DateInput label="Target date" value={form.targetDate} onChange={(targetDate) => setForm({ ...form, targetDate })} />
        </div>
        <TextArea label="Notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
        <TextInput label="Tags" value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
      </FormShell>
    </Modal>
  );
}

function LogModal({ goal, log, mutate, onClose }: { goal: Goal; log?: ProgressLog; mutate: (action: string, payload: unknown, message: string) => Promise<any>; onClose: () => void }) {
  const [form, setForm] = useState({
    title: log?.title || "",
    content: log?.content || "",
    date: toDateInput(log?.date) || new Date().toISOString().slice(0, 10),
    milestoneId: log?.milestoneId || "",
    conceptsLearned: log?.conceptsLearned || "",
    skillsDeveloped: log?.skillsDeveloped || "",
    problems: log?.problems || "",
    solutions: log?.solutions || "",
    nextStep: log?.nextStep || "",
    tags: log ? tagString(log.tags) : ""
  });
  const [files, setFiles] = useState<File[]>([]);

  async function save() {
    const action = log ? "updateProgressLog" : "createProgressLog";
    const result = await mutate(action, log ? { ...form, id: log.id, goalId: goal.id } : { ...form, goalId: goal.id }, log ? "Progress saved" : "Progress added");
    const progressLogId = log?.id || result.createdId;
    if (files.length > 0 && progressLogId) {
      await uploadFiles(progressLogId, files);
      await mutate("updateProgressLog", { ...form, id: progressLogId, goalId: goal.id }, "Image uploaded");
    }
    onClose();
  }

  return (
    <Modal title={log ? "Edit Progress Update" : "Add Progress Update"} onClose={onClose} wide>
      <FormShell onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <TextInput label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} autoFocus />
          <DateInput label="Date" value={form.date} onChange={(date) => setForm({ ...form, date })} />
        </div>
        <SelectInput label="Related milestone" value={form.milestoneId} onChange={(milestoneId) => setForm({ ...form, milestoneId })} options={["", ...goal.milestones.map((item) => item.id)]} labels={{ "": "No milestone", ...Object.fromEntries(goal.milestones.map((item) => [item.id, item.title])) }} />
        <TextArea label="Markdown notes" value={form.content} onChange={(content) => setForm({ ...form, content })} rows={7} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="Concepts learned" value={form.conceptsLearned} onChange={(conceptsLearned) => setForm({ ...form, conceptsLearned })} />
          <TextInput label="Skills developed" value={form.skillsDeveloped} onChange={(skillsDeveloped) => setForm({ ...form, skillsDeveloped })} />
          <TextArea label="Problems encountered" value={form.problems} onChange={(problems) => setForm({ ...form, problems })} />
          <TextArea label="Solution / debugging notes" value={form.solutions} onChange={(solutions) => setForm({ ...form, solutions })} />
        </div>
        <TextInput label="Next step" value={form.nextStep} onChange={(nextStep) => setForm({ ...form, nextStep })} />
        <TextInput label="Tags" value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        <AttachmentDropzone files={files} setFiles={setFiles} />
      </FormShell>
    </Modal>
  );
}

function QuickUpdateModal({ goals, mutate, onClose }: { goals: Goal[]; mutate: (action: string, payload: unknown, message: string) => Promise<any>; onClose: () => void }) {
  const [goalId, setGoalId] = useState(goals[0]?.id || "");
  const goal = goals.find((item) => item.id === goalId) || goals[0];
  const [form, setForm] = useState(emptyLog);
  const [files, setFiles] = useState<File[]>([]);

  async function save() {
    const result = await mutate("createProgressLog", { ...form, title: form.title || "Quick progress update", goalId }, "Quick update saved");
    if (files.length > 0 && result.createdId) {
      await uploadFiles(result.createdId, files);
      await mutate("updateProgressLog", { ...form, id: result.createdId, goalId, title: form.title || "Quick progress update" }, "Attachment uploaded");
    }
    onClose();
  }

  return (
    <Modal title="Quick Update" onClose={onClose}>
      <FormShell onSubmit={save}>
        <SelectInput label="Goal" value={goalId} onChange={setGoalId} options={goals.map((item) => item.id)} labels={Object.fromEntries(goals.map((item) => [item.id, item.title]))} />
        {goal && <SelectInput label="Milestone" value={form.milestoneId} onChange={(milestoneId) => setForm({ ...form, milestoneId })} options={["", ...goal.milestones.map((item) => item.id)]} labels={{ "": "No milestone", ...Object.fromEntries(goal.milestones.map((item) => [item.id, item.title])) }} />}
        <TextInput label="What I did" value={form.title} onChange={(title) => setForm({ ...form, title })} autoFocus />
        <TextArea label="Notes" value={form.content} onChange={(content) => setForm({ ...form, content })} rows={4} />
        <DateInput label="Date" value={form.date} onChange={(date) => setForm({ ...form, date })} />
        <AttachmentDropzone files={files} setFiles={setFiles} />
      </FormShell>
    </Modal>
  );
}

function ResourceModal({ goal, resource, onClose, onSave }: { goal: Goal; resource?: Resource; onClose: () => void; onSave: (payload: typeof emptyResource) => Promise<void> }) {
  const [form, setForm] = useState({
    title: resource?.title || "",
    url: resource?.url || "",
    type: resource?.type || "DOCUMENTATION",
    description: resource?.description || "",
    milestoneId: resource?.milestoneId || ""
  } as typeof emptyResource);
  return (
    <Modal title={resource ? "Edit Resource" : "Add Resource"} onClose={onClose}>
      <FormShell onSubmit={() => onSave(form)}>
        <TextInput label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} autoFocus />
        <TextInput label="URL" value={form.url} onChange={(url) => setForm({ ...form, url })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectInput label="Type" value={form.type} onChange={(type) => setForm({ ...form, type: type as ResourceType })} options={resourceTypes} />
          <SelectInput label="Related milestone" value={form.milestoneId} onChange={(milestoneId) => setForm({ ...form, milestoneId })} options={["", ...goal.milestones.map((item) => item.id)]} labels={{ "": "No milestone", ...Object.fromEntries(goal.milestones.map((item) => [item.id, item.title])) }} />
        </div>
        <TextArea label="Description" value={form.description} onChange={(description) => setForm({ ...form, description })} />
      </FormShell>
    </Modal>
  );
}

function AttachmentDropzone({ files, setFiles }: { files: File[]; setFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  function addFiles(next: FileList | File[]) {
    setFiles([...files, ...Array.from(next)]);
  }
  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }
  async function onPaste(event: React.ClipboardEvent<HTMLButtonElement>) {
    addFiles(event.clipboardData.files);
  }
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase text-slate-400">Attachments</div>
      <button type="button" onClick={() => inputRef.current?.click()} onDrop={onDrop} onDragOver={(event) => event.preventDefault()} onPaste={onPaste} className="flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 outline-none focus:border-slate-500 dark:border-white/15 dark:bg-black/20" tabIndex={0}>
        <Upload size={20} />
        <span className="mt-2">Drop images or files, paste a screenshot, or select manually</span>
        <span className="mt-1 text-xs">PNG, JPG, GIF, PDF, Markdown, text</span>
      </button>
      <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/gif,application/pdf,text/markdown,text/plain,.md,.txt" onChange={(event) => event.target.files && addFiles(event.target.files)} className="hidden" />
      {files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{files.map((file, index) => <Badge key={`${file.name}-${index}`}><Paperclip size={12} /> {file.name}</Badge>)}</div>}
    </div>
  );
}

async function uploadFiles(progressLogId: string, files: File[]) {
  const form = new FormData();
  form.append("progressLogId", progressLogId);
  files.forEach((file) => form.append("files", file));
  const response = await fetch("/api/upload", { method: "POST", body: form });
  if (!response.ok) throw new Error("Upload failed.");
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div className={clsx("max-h-[92vh] w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-soft dark:border-white/10 dark:bg-[#151719]", wide ? "max-w-4xl" : "max-w-2xl")}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#151719]">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit();
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {children}
      <button disabled={saving} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-950">
        <Check size={16} /> {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

function TextInput({ label, value, onChange, placeholder, autoFocus = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-400">{label}</span>
      <input autoFocus={autoFocus} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20" />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-400">{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20" />
    </label>
  );
}

function SelectInput({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-400">{label}</span>
      <span className="relative block">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20">
          {options.map((option) => <option key={option || "empty"} value={option}>{labels[option] || option}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
      </span>
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-400">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 dark:border-white/10 dark:bg-black/20" />
    </label>
  );
}

function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10" />;
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx("h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10", className)}>
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${value}%` }} />
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">{children}</span>;
}

function MarkdownLite({ value }: { value: string }) {
  if (!value) return null;
  return (
    <div className="markdown-lite mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
      {value.split(/\n{2,}/).map((block, index) => <p key={index}>{block}</p>)}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10">{label}</div>;
}

function ImagePreview({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={attachment.fileUrl} alt={attachment.fileName} className="max-h-[88vh] max-w-full rounded-lg object-contain" />
    </div>
  );
}
