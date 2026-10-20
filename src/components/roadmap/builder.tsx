"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Background,
  ConnectionLineType,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Maximize,
  Pencil,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import type { AccessMode, CompletionRule, NodeKind, RestrictedDisplay } from "@/types";
import type { RoadmapEditorData } from "@/lib/roadmap/queries";
import { ruleSummary, stepStates } from "@/lib/roadmap/progress";
import { accessSummary } from "@/lib/content/access";
import { createQuizAction, deleteQuizAction, saveRoadmapAction, setRoadmapSettingsAction } from "@/lib/roadmap/actions";
import { inputClass } from "@/components/auth/form-parts";
import { Badge } from "@/components/content/badges";
import { AccessPicker } from "@/components/admin/access-picker";
import { MATERIAL_ICONS } from "@/components/admin/material-icons";
import { cn } from "@/lib/utils";
import { stepNodeTypes, type StepCardData } from "./step-card";
import { STEP_KIND, STEP_KINDS } from "./step-meta";

/* ─── Types ─── */

type StepConfig = {
  kind: NodeKind;
  title: string;
  description: string;
  topicId: string | null;
  isRequired: boolean;
  completionRule: CompletionRule;
  minQuizzes: number | null;
  lockUntilPrereqs: boolean;
  materialIds: string[];
  accessMode: AccessMode;
  studentIds: string[];
};
type BuilderNode = Node<{ config: StepConfig }, "step">;
type Snapshot = { nodes: BuilderNode[]; edges: Edge[] };

const RULES: { value: CompletionRule; label: string }[] = [
  { value: "all_required", label: "Pass all required quizzes" },
  { value: "min_quizzes", label: "Complete a number of quizzes" },
  { value: "student_mark", label: "Student marks it as done" },
  { value: "admin_confirm", label: "Admin confirms" },
];

const EDGE_COLOR = "#9fb8a8";
const defaultEdgeOptions = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 18, height: 18 },
  style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
};

const edgeId = (s: string, t: string) => `${s}>${t}`;
const plural = (n: number, w: string, many = `${w}s`) => `${n} ${n === 1 ? w : many}`;

function initialState(data: RoadmapEditorData): Snapshot {
  const links = new Map<string, string[]>();
  for (const l of data.links) links.set(l.node_id, [...(links.get(l.node_id) ?? []), l.material_id]);
  const grants = new Map<string, string[]>();
  for (const g of data.grants) grants.set(g.node_id, [...(grants.get(g.node_id) ?? []), g.student_id]);
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      type: "step",
      position: { x: n.pos_x, y: n.pos_y },
      data: {
        config: {
          kind: n.kind,
          title: n.title,
          description: n.description,
          topicId: n.topic_id,
          isRequired: n.is_required,
          completionRule: n.completion_rule,
          minQuizzes: n.min_quizzes,
          lockUntilPrereqs: n.lock_until_prereqs,
          materialIds: links.get(n.id) ?? [],
          accessMode: n.access_mode,
          studentIds: grants.get(n.id) ?? [],
        },
      },
    })),
    edges: data.edges.map((e) => ({ id: edgeId(e.source_id, e.target_id), source: e.source_id, target: e.target_id })),
  };
}

function toPayload(nodes: BuilderNode[], edges: Edge[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      ...n.data.config,
      title: n.data.config.title.trim() || "Untitled step",
      studentIds: n.data.config.accessMode === "all" ? [] : n.data.config.studentIds,
    })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
  };
}

const strip = (nodes: BuilderNode[]) => nodes.map((n) => ({ ...n, selected: false, dragging: false }));

/* ─── Builder ─── */

export function RoadmapBuilder({ data }: { data: RoadmapEditorData }) {
  return (
    <ReactFlowProvider>
      <Builder data={data} />
    </ReactFlowProvider>
  );
}

function Builder({ data }: { data: RoadmapEditorData }) {
  const roadmap = data.roadmap!;
  const router = useRouter();
  const flow = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [initial] = useState(() => initialState(data));
  const [nodes, setNodes] = useState<BuilderNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [version, setVersion] = useState(roadmap.version);
  const [savedKey, setSavedKey] = useState(() => JSON.stringify(toPayload(initial.nodes, initial.edges)));
  const [savedIds, setSavedIds] = useState(() => new Set(initial.nodes.map((n) => n.id)));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; students: number }[] | null>(null);
  const [preview, setPreview] = useState(false);
  const [settingsPending, startSettings] = useTransition();

  // ── Undo / redo ──
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const lastCommit = useRef<{ key: string; at: number } | null>(null);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const syncHistory = () => setHistory({ undo: past.current.length, redo: future.current.length });
  const latest = useRef<Snapshot>({ nodes, edges });
  useEffect(() => {
    latest.current = { nodes, edges };
  }, [nodes, edges]);

  const commit = useCallback((coalesceKey?: string) => {
    const now = Date.now();
    if (coalesceKey && lastCommit.current?.key === coalesceKey && now - lastCommit.current.at < 1500) {
      lastCommit.current.at = now;
      return;
    }
    lastCommit.current = coalesceKey ? { key: coalesceKey, at: now } : null;
    past.current = [...past.current.slice(-99), { nodes: strip(latest.current.nodes), edges: latest.current.edges }];
    future.current = [];
    syncHistory();
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ nodes: strip(latest.current.nodes), edges: latest.current.edges });
    lastCommit.current = null;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    syncHistory();
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ nodes: strip(latest.current.nodes), edges: latest.current.edges });
    lastCommit.current = null;
    setNodes(next.nodes);
    setEdges(next.edges);
    syncHistory();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // ── Dirty tracking ──
  const payload = useMemo(() => toPayload(nodes, edges), [nodes, edges]);
  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);
  const dirty = payloadKey !== savedKey;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ── React Flow handlers ──
  const onNodesChange = useCallback(
    (changes: NodeChange<BuilderNode>[]) => {
      if (preview) return;
      if (changes.some((c) => c.type === "remove")) commit();
      setNodes((ns) => applyNodeChanges(changes, ns));
    },
    [commit, preview],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (preview) return;
      if (changes.some((c) => c.type === "remove")) commit();
      setEdges((es) => applyEdgeChanges(changes, es));
    },
    [commit, preview],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      if (latest.current.edges.some((e) => e.source === c.source && e.target === c.target)) return;
      commit();
      setEdges((es) => addEdge({ ...c, id: edgeId(c.source, c.target) }, es));
    },
    [commit],
  );
  const onReconnect = useCallback(
    (old: Edge, c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      commit();
      setEdges((es) => reconnectEdge(old, c, es));
    },
    [commit],
  );

  const selectedNode = nodes.find((n) => n.selected) ?? null;
  const selectedEdge = edges.find((e) => e.selected) ?? null;

  const addStep = (kind: NodeKind) => {
    commit();
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect
      ? flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
    const offset = (nodes.length % 5) * 24;
    const id = crypto.randomUUID();
    const node: BuilderNode = {
      id,
      type: "step",
      position: { x: center.x - 110 + offset, y: center.y - 40 + offset },
      selected: true,
      data: {
        config: {
          kind,
          title: `New ${STEP_KIND[kind].label.toLowerCase()}`,
          description: "",
          topicId: null,
          isRequired: true,
          completionRule: kind === "quiz" || kind === "final" ? "all_required" : "student_mark",
          minQuizzes: null,
          lockUntilPrereqs: false,
          materialIds: [],
          accessMode: "all",
          studentIds: [],
        },
      },
    };
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node]);
    setEdges((es) => es.map((e) => ({ ...e, selected: false })));
  };

  const updateConfig = (id: string, patch: Partial<StepConfig>, key: string) => {
    commit(`${id}:${key}`);
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { config: { ...n.data.config, ...patch } } } : n)));
  };

  const removeStep = (id: string) => {
    commit();
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  };
  const removeEdge = (id: string) => {
    commit();
    setEdges((es) => es.filter((e) => e.id !== id));
  };

  // ── Saving ──
  const save = async (confirmRemoval = false): Promise<boolean> => {
    setSaving(true);
    setNotice(null);
    const key = payloadKey;
    const sent = payload;
    try {
      const res = await saveRoadmapAction({ roadmapId: roadmap.id, version, ...sent, confirmRemoval });
      if ("needsConfirm" in res) {
        setConfirm(res.needsConfirm);
        return false;
      }
      if (!res.ok) {
        setNotice({ ok: false, text: res.message });
        return false;
      }
      setVersion(res.version);
      setSavedKey(key);
      setSavedIds(new Set(sent.nodes.map((n) => n.id)));
      setConfirm(null);
      setNotice({ ok: true, text: "Roadmap saved." });
      return true;
    } catch {
      setNotice({ ok: false, text: "Could not save — check your connection and try again." });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const settings = (patch: { isPublished?: boolean; restrictedDisplay?: RestrictedDisplay }) =>
    startSettings(async () => {
      const res = await setRoadmapSettingsAction({ roadmapId: roadmap.id, ...patch });
      setNotice({ ok: res.ok, text: res.message ?? (res.ok ? "Saved." : "Could not save.") });
    });

  const addQuiz = async (nodeId: string) => {
    if (dirty && !(await save())) return;
    const res = await createQuizAction(nodeId);
    if (!res.ok) setNotice({ ok: false, text: res.message });
    else router.push(`/admin/quizzes/${res.quizId}`);
  };

  // ── Display ──
  const topicTitle = useMemo(() => new Map(data.topics.map((t) => [t.id, t.title])), [data.topics]);
  const quizzesByNode = useMemo(() => {
    const m = new Map<string, typeof data.quizzes>();
    for (const q of data.quizzes) m.set(q.node_id, [...(m.get(q.node_id) ?? []), q]);
    return m;
  }, [data]);

  const previewStates = useMemo(
    () =>
      stepStates(
        nodes.map((n) => ({ id: n.id, is_required: n.data.config.isRequired, lock_until_prereqs: n.data.config.lockUntilPrereqs, pos_x: 0, pos_y: 0 })),
        edges.map((e) => ({ source_id: e.source, target_id: e.target })),
        new Set(),
        new Set(),
      ),
    [nodes, edges],
  );

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        const c = n.data.config;
        const quizzes = quizzesByNode.get(n.id) ?? [];
        const meta = [
          c.topicId ? topicTitle.get(c.topicId) : null,
          c.materialIds.length ? plural(c.materialIds.length, "material") : null,
          quizzes.length ? plural(quizzes.length, "quiz", "quizzes") : null,
        ].filter(Boolean) as string[];
        const card: StepCardData = {
          kind: c.kind,
          title: c.title || "Untitled step",
          optional: !c.isRequired,
          meta,
          lockedByPrereqs: c.lockUntilPrereqs,
          limited: c.accessMode === "selected",
          editable: !preview,
          state: preview ? previewStates.get(n.id) : undefined,
        };
        return { ...n, draggable: !preview, connectable: !preview, data: { ...card, config: c } };
      }),
    [nodes, quizzesByNode, topicTitle, preview, previewStates],
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-orbit-border bg-white p-2.5 shadow-[var(--shadow-card)]">
        {!preview && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Add a step">
            <span className="px-1.5 text-xs font-medium text-orbit-text-muted">Add</span>
            {STEP_KINDS.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                onClick={() => addStep(kind)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-orbit-border bg-white px-2.5 text-xs font-medium text-orbit-text hover:border-orbit-primary/40 hover:bg-orbit-panel"
              >
                <Icon size={14} className="text-orbit-primary" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!preview && (
            <>
              <ToolButton label="Undo (⌘Z)" onClick={undo} disabled={history.undo === 0} icon={Undo2} />
              <ToolButton label="Redo (⇧⌘Z)" onClick={redo} disabled={history.redo === 0} icon={Redo2} />
            </>
          )}
          <ToolButton label="Fit to screen" onClick={() => flow.fitView({ padding: 0.2, maxZoom: 1, duration: 300 })} icon={Maximize} />
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            aria-pressed={preview}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium",
              preview ? "border-orbit-primary bg-orbit-panel-hover text-orbit-primary-hover" : "border-orbit-border bg-white text-orbit-text hover:bg-orbit-panel",
            )}
          >
            {preview ? <Pencil size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            {preview ? "Back to editing" : "Preview as student"}
          </button>
          <button
            type="button"
            onClick={() => save()}
            disabled={saving || !dirty}
            className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" className="min-h-0">
        {dirty && !notice && <p className="text-xs font-medium text-orbit-warning">Unsaved changes — students see the last saved version.</p>}
        {notice && (
          <p className={cn("inline-flex items-center gap-1.5 text-sm", notice.ok ? "text-orbit-primary-hover" : "text-orbit-error")}>
            {notice.ok ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />} {notice.text}
          </p>
        )}
      </div>

      {confirm && (
        <div role="alertdialog" aria-labelledby="confirm-title" className="rounded-2xl border border-[#f6d3ce] bg-orbit-error-muted p-4">
          <p id="confirm-title" className="text-sm font-medium text-orbit-error">Remove steps that students have completed?</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-orbit-text-secondary">
            {confirm.map((c) => (
              <li key={c.title}>
                “{c.title}” — completed by {plural(c.students, "student")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-orbit-text-secondary">Their completion and quiz attempts for these steps will be deleted. This can&apos;t be undone.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => save(true)} disabled={saving} className="rounded-xl bg-orbit-error px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
              Remove and save
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-medium">
              Keep editing
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div
          ref={canvasRef}
          className="roadmap-canvas relative h-[62vh] min-h-[420px] overflow-hidden rounded-2xl border border-orbit-border bg-orbit-canvas"
        >
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={stepNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeDragStart={() => commit()}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: "#166534", strokeWidth: 1.5 }}
            deleteKeyCode={preview ? null : ["Backspace", "Delete"]}
            nodesDraggable={!preview}
            nodesConnectable={!preview}
            edgesReconnectable={!preview}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            snapToGrid
            snapGrid={[10, 10]}
          >
            <Background gap={20} size={1} color="#dfe8e2" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <p className="rounded-xl border border-dashed border-orbit-border bg-white/90 px-4 py-3 text-center text-sm text-orbit-text-muted">
                Use <strong className="text-orbit-text">Add</strong> above to place your first step, then drag between the dots to connect steps.
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-orbit-border bg-white p-4 shadow-[var(--shadow-card)] lg:max-h-[62vh] lg:min-h-[420px] lg:overflow-y-auto">
          {preview ? (
            <PreviewHelp />
          ) : selectedNode ? (
            <StepPanel
              key={selectedNode.id}
              node={selectedNode}
              data={data}
              saved={savedIds.has(selectedNode.id)}
              completions={data.completions[selectedNode.id] ?? 0}
              quizzes={quizzesByNode.get(selectedNode.id) ?? []}
              prerequisites={edges
                .filter((e) => e.target === selectedNode.id)
                .map((e) => nodes.find((n) => n.id === e.source)?.data.config.title ?? "")
                .filter(Boolean)}
              onChange={(patch, key) => updateConfig(selectedNode.id, patch, key)}
              onDelete={() => removeStep(selectedNode.id)}
              onAddQuiz={() => addQuiz(selectedNode.id)}
              onNotice={setNotice}
            />
          ) : selectedEdge ? (
            <EdgePanel
              from={nodes.find((n) => n.id === selectedEdge.source)?.data.config.title ?? "?"}
              to={nodes.find((n) => n.id === selectedEdge.target)?.data.config.title ?? "?"}
              onDelete={() => removeEdge(selectedEdge.id)}
            />
          ) : (
            <RoadmapPanel
              published={roadmap.is_published}
              display={roadmap.restricted_display}
              pending={settingsPending}
              dirty={dirty}
              steps={nodes.length}
              connections={edges.length}
              onPublish={(v) => settings({ isPublished: v })}
              onDisplay={(v) => settings({ restrictedDisplay: v })}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function ToolButton({ label, onClick, disabled, icon: Icon }: { label: string; onClick: () => void; disabled?: boolean; icon: typeof Undo2 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-orbit-border bg-white text-orbit-text-secondary hover:bg-orbit-panel hover:text-orbit-text disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon size={15} />
    </button>
  );
}

/* ─── Side panels ─── */

function PanelTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-semibold text-orbit-text">{children}</h2>
      {hint && <p className="mt-0.5 text-xs text-orbit-text-muted">{hint}</p>}
    </div>
  );
}

function RoadmapPanel({
  published,
  display,
  pending,
  dirty,
  steps,
  connections,
  onPublish,
  onDisplay,
}: {
  published: boolean;
  display: RestrictedDisplay;
  pending: boolean;
  dirty: boolean;
  steps: number;
  connections: number;
  onPublish: (v: boolean) => void;
  onDisplay: (v: RestrictedDisplay) => void;
}) {
  return (
    <div className="space-y-5">
      <PanelTitle hint={`${plural(steps, "step")} · ${plural(connections, "connection")}`}>Roadmap</PanelTitle>

      <div className="rounded-xl border border-orbit-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-orbit-text">Visibility</p>
            <p className="text-xs text-orbit-text-muted">{published ? "Students with access can see it." : "Draft — hidden from students."}</p>
          </div>
          {published ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => onPublish(!published)}
          className={cn(
            "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium disabled:opacity-60",
            published ? "btn-secondary" : "btn-primary",
          )}
        >
          {published ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          {published ? "Unpublish roadmap" : "Publish roadmap"}
        </button>
        {dirty && <p className="mt-2 text-xs text-orbit-warning">Save your changes first — publishing shows the last saved version.</p>}
      </div>

      <fieldset className="rounded-xl border border-orbit-border p-3">
        <legend className="px-1 text-sm font-medium text-orbit-text">Steps a student can&apos;t access</legend>
        {(
          [
            ["hide", "Hide them", "Students only see steps they can open."],
            ["lock", "Show as locked", "Title and a lock only — no details, files or questions."],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1">
            <input
              type="radio"
              name="restricted-display"
              checked={display === value}
              disabled={pending}
              onChange={() => onDisplay(value)}
              className="mt-0.5 h-4 w-4 accent-[#166534]"
            />
            <span>
              <span className="block text-sm text-orbit-text">{label}</span>
              <span className="block text-xs text-orbit-text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2 text-xs leading-relaxed text-orbit-text-secondary">
        <p className="font-medium text-orbit-text">How to build</p>
        <p>Add steps from the toolbar and drag them into place. Drag from the dot on a step&apos;s right edge to another step to connect them. Several arrows out of one step make a branch.</p>
        <p>Click a step to configure it; click an arrow to remove it. Delete or Backspace removes the selection; ⌘Z / Ctrl+Z undoes.</p>
      </div>
    </div>
  );
}

function PreviewHelp() {
  return (
    <div className="space-y-3 text-sm text-orbit-text-secondary">
      <PanelTitle>Student preview</PanelTitle>
      <p>This is the roadmap a student with access to every step sees, before they start. Steps with prerequisite locking show as locked.</p>
      <p>Each student only sees the steps they are allowed to access. Steps go green as they complete them.</p>
      <ul className="space-y-1.5 pt-1 text-xs">
        <Legend className="border-orbit-border bg-white" label="Not started" />
        <Legend className="border-[#b9d9c4] bg-orbit-panel" label="In progress" />
        <Legend className="border-orbit-primary bg-orbit-panel-hover" label="Completed" />
        <Legend className="border-dashed border-orbit-border bg-orbit-canvas" label="Locked" />
      </ul>
    </div>
  );
}

export function Legend({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("h-3.5 w-5 rounded border", className)} aria-hidden="true" /> {label}
    </li>
  );
}

function EdgePanel({ from, to, onDelete }: { from: string; to: string; onDelete: () => void }) {
  return (
    <div className="space-y-4">
      <PanelTitle>Connection</PanelTitle>
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-orbit-text">
        <span className="font-medium">{from}</span> <ArrowRight size={14} className="text-orbit-text-muted" aria-hidden="true" />{" "}
        <span className="font-medium">{to}</span>
      </p>
      <p className="text-xs text-orbit-text-muted">
        To reconnect, drag either end of the arrow to another step. If “{to}” locks until earlier steps are done, “{from}” counts as one of them (when required).
      </p>
      <button type="button" onClick={onDelete} className="btn-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-orbit-error">
        <Trash2 size={15} aria-hidden="true" /> Remove connection
      </button>
    </div>
  );
}

function StepPanel({
  node,
  data,
  saved,
  completions,
  quizzes,
  prerequisites,
  onChange,
  onDelete,
  onAddQuiz,
  onNotice,
}: {
  node: BuilderNode;
  data: RoadmapEditorData;
  saved: boolean;
  completions: number;
  quizzes: RoadmapEditorData["quizzes"];
  prerequisites: string[];
  onChange: (patch: Partial<StepConfig>, key: string) => void;
  onDelete: () => void;
  onAddQuiz: () => Promise<void>;
  onNotice: (n: { ok: boolean; text: string }) => void;
}) {
  const c = node.data.config;
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingQuiz, setRemovingQuiz] = useState<string | null>(null);
  const requiredQuizzes = quizzes.filter((q) => q.is_required && q.is_published).length;
  const ruleNeedsQuiz = c.completionRule === "all_required" && requiredQuizzes === 0;

  const toggleMaterial = (id: string) =>
    onChange({ materialIds: c.materialIds.includes(id) ? c.materialIds.filter((m) => m !== id) : [...c.materialIds, id] }, "materials");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <PanelTitle hint={STEP_KIND[c.kind].hint}>Step settings</PanelTitle>
        {!saved && <Badge tone="warning">Not saved yet</Badge>}
      </div>

      <Labeled label="Title">
        <input className={inputClass} value={c.title} maxLength={200} onChange={(e) => onChange({ title: e.target.value }, "title")} />
      </Labeled>

      <Labeled label="Type">
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
          {STEP_KINDS.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={c.kind === kind}
              onClick={() => onChange({ kind }, "kind")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium",
                c.kind === kind ? "border-orbit-primary bg-orbit-panel-hover text-orbit-primary-hover" : "border-orbit-border bg-white text-orbit-text hover:bg-orbit-panel",
              )}
            >
              <Icon size={13} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </Labeled>

      <Labeled label="Description (optional)">
        <textarea className={inputClass + " resize-y"} rows={2} maxLength={2000} value={c.description} onChange={(e) => onChange({ description: e.target.value }, "description")} />
      </Labeled>

      <Labeled label="Linked subtopic">
        <select className={inputClass} value={c.topicId ?? ""} onChange={(e) => onChange({ topicId: e.target.value || null }, "topic")}>
          <option value="">None</option>
          {data.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
              {t.is_published ? "" : " (draft)"}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-orbit-text-muted">Students who can&apos;t access this subtopic won&apos;t see the step.</p>
      </Labeled>

      <Labeled label="Linked materials">
        {data.topics.every((t) => t.materials.length === 0) ? (
          <p className="text-xs text-orbit-text-muted">This unit has no materials yet.</p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-orbit-border p-2">
            {data.topics
              .filter((t) => t.materials.length)
              .map((t) => (
                <div key={t.id}>
                  <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-orbit-text-muted">{t.title}</p>
                  {t.materials.map((m) => {
                    const Icon = MATERIAL_ICONS[m.kind].icon;
                    return (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm hover:bg-orbit-panel">
                        <input type="checkbox" checked={c.materialIds.includes(m.id)} onChange={() => toggleMaterial(m.id)} className="h-4 w-4 accent-[#166534]" />
                        <Icon size={14} className="shrink-0 text-orbit-primary" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-orbit-text">{m.title}</span>
                        {!m.is_published && <span className="text-[11px] text-orbit-text-muted">draft</span>}
                      </label>
                    );
                  })}
                </div>
              ))}
          </div>
        )}
      </Labeled>

      <div className="space-y-2 rounded-xl border border-orbit-border p-3">
        <p className="text-sm font-medium text-orbit-text">Completion</p>
        <select className={inputClass} value={c.completionRule} onChange={(e) => onChange({ completionRule: e.target.value as CompletionRule }, "rule")} aria-label="How this step is completed">
          {RULES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {c.completionRule === "min_quizzes" && (
          <label className="flex items-center gap-2 text-sm text-orbit-text">
            At least
            <input
              type="number"
              min={1}
              max={100}
              value={c.minQuizzes ?? 1}
              onChange={(e) => onChange({ minQuizzes: Math.max(1, Math.min(100, Number(e.target.value) || 1)) }, "min")}
              className={inputClass + " w-20"}
            />
            quizzes
          </label>
        )}
        <p className="text-xs text-orbit-text-muted">{ruleSummary(c.completionRule, c.minQuizzes, requiredQuizzes)}.</p>
        {ruleNeedsQuiz && <p className="text-xs text-orbit-warning">Add and publish a required quiz, or choose another rule — otherwise this step can never be completed.</p>}
        <CheckRow
          label="Required step"
          hint="Counts towards unit progress and can be a prerequisite."
          checked={c.isRequired}
          onChange={(v) => onChange({ isRequired: v }, "required")}
        />
        <CheckRow
          label="Lock until earlier steps are done"
          hint={
            prerequisites.length
              ? `Earlier steps: ${prerequisites.join(", ")} (required ones only).`
              : "Connect arrows into this step to choose its earlier steps."
          }
          checked={c.lockUntilPrereqs}
          onChange={(v) => onChange({ lockUntilPrereqs: v }, "lock")}
        />
      </div>

      <div className="space-y-2 rounded-xl border border-orbit-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-orbit-text">Quizzes</p>
          <button
            type="button"
            disabled={adding}
            onClick={async () => {
              setAdding(true);
              await onAddQuiz();
              setAdding(false);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-orbit-border px-2.5 py-1.5 text-xs font-medium text-orbit-primary-text hover:bg-orbit-panel disabled:opacity-60"
          >
            {adding ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />} Add quiz
          </button>
        </div>
        {quizzes.length === 0 ? (
          <p className="text-xs text-orbit-text-muted">{saved ? "No quizzes yet." : "Adding a quiz saves the roadmap first."}</p>
        ) : (
          <ul className="space-y-1.5">
            {quizzes.map((q) => (
              <li key={q.id} className="rounded-lg border border-orbit-border-subtle bg-orbit-canvas px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/quizzes/${q.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-orbit-text hover:text-orbit-primary-hover">
                    {q.title}
                  </Link>
                  {q.is_published ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-orbit-text-muted">
                  {plural(q.question_count, "question")} · pass {q.pass_percent}% · {q.is_required ? "required" : "optional"}
                </p>
                <div className="mt-1.5 flex gap-3 text-xs">
                  <Link href={`/admin/quizzes/${q.id}`} className="font-medium text-orbit-primary-text hover:underline">
                    Edit
                  </Link>
                  {removingQuiz === q.id ? (
                    <span className="inline-flex gap-2">
                      <button
                        type="button"
                        className="font-medium text-orbit-error hover:underline"
                        onClick={async () => {
                          const r = await deleteQuizAction(q.id);
                          onNotice({ ok: r.ok, text: r.message ?? "" });
                          setRemovingQuiz(null);
                        }}
                      >
                        Delete with all attempts
                      </button>
                      <button type="button" className="text-orbit-text-secondary hover:underline" onClick={() => setRemovingQuiz(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="text-orbit-text-secondary hover:text-orbit-error" onClick={() => setRemovingQuiz(q.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-orbit-border p-3">
        <AccessPicker
          students={data.students}
          groupName={data.curriculum?.name}
          defaultMode={c.accessMode}
          defaultSelected={c.studentIds}
          intro={`Students also need access to the unit${c.topicId ? " and the linked subtopic" : ""}. Currently: ${accessSummary(c.accessMode, c.studentIds.length)}.`}
          onChange={(mode, ids) => onChange({ accessMode: mode, studentIds: ids }, "access")}
        />
      </div>

      {confirmDelete ? (
        <div className="rounded-xl border border-[#f6d3ce] bg-orbit-error-muted p-3">
          <p className="text-sm font-medium text-orbit-error">Delete “{c.title}”?</p>
          <p className="mt-1 text-xs text-orbit-text-secondary">
            {completions > 0
              ? `${plural(completions, "student")} completed this step. Their progress and its quizzes are deleted when you save.`
              : quizzes.length
                ? `Its ${plural(quizzes.length, "quiz", "quizzes")} and their attempts are deleted when you save.`
                : "Removed when you save. Undo is available until then."}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onDelete} className="rounded-lg bg-orbit-error px-3 py-2 text-xs font-medium text-white hover:opacity-90">
              Delete step
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary rounded-lg px-3 py-2 text-xs font-medium">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-orbit-text-secondary hover:text-orbit-error">
          <Trash2 size={15} aria-hidden="true" /> Delete step
        </button>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-orbit-text">{label}</p>
      {children}
    </div>
  );
}

function CheckRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 pt-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#166534]" />
      <span>
        <span className="block text-sm text-orbit-text">{label}</span>
        <span className="block text-xs text-orbit-text-muted">{hint}</span>
      </span>
    </label>
  );
}
