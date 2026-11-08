import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ClipboardPlus,
  GripVertical,
  LayoutGrid,
  Link2,
  List,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from "../../shared/constants";
import type { ChecklistItem, Priority, Task, TaskStatus } from "../../shared/types";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/cn";
import { dueLabel, formatDateTime, formatRelative, toLocalInput, fromLocalInput } from "../lib/format";
import { matchesQuery } from "../lib/filters";
import { useSavedViews } from "../lib/useSavedViews";
import { PageHeader } from "../components/PageHeader";
import { AlertRow } from "../components/alerts/AlertRow";
import { ConfirmDialog, Drawer, Modal } from "../components/ui/Overlay";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Panel,
  PriorityBadge,
  Progress,
  SearchInput,
  Segmented,
  Select,
  TaskStatusBadge,
} from "../components/ui/Primitives";
import { SavedViews } from "../components/ui/SavedViews";

const STATUSES: TaskStatus[] = ["open", "in_progress", "blocked", "done"];
const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4"];
const ASSIGNEES = ["Unassigned", "N. Weber", "A. Schmidt", "M. Yilmaz", "L. Fischer"];

function TaskCard({
  task,
  deviceNames,
  onOpen,
  onDragStart,
  dragging,
}: {
  task: Task;
  deviceNames: string[];
  onOpen: () => void;
  onDragStart: (event: React.DragEvent) => void;
  dragging: boolean;
}) {
  const due = task.status === "done" ? { label: "Erledigt", tone: "success" as const } : dueLabel(task.dueAt);
  const done = task.checklist.filter((item) => item.done).length;
  const progress = task.checklist.length > 0 ? (done / task.checklist.length) * 100 : 0;
  return (
    <article
      className={cn("task-card", dragging && "is-dragging", task.status === "done" && "is-done")}
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <div className="task-card__top">
        <PriorityBadge priority={task.priority} compact />
        <span className="task-card__grip" aria-hidden>
          <GripVertical size={14} />
        </span>
        <span className={cn("task-card__due", `task-card__due--${due.tone}`)}>
          <CalendarClock size={11} aria-hidden />
          {due.label}
        </span>
      </div>
      <h3 className={cn(task.status === "done" && "is-done")}>{task.title}</h3>
      {task.description ? <p className="task-card__description">{task.description}</p> : null}
      <div className="task-card__devices">
        {deviceNames.slice(0, 2).map((name) => (
          <span className="device-chip" key={name}>
            {name}
          </span>
        ))}
        {deviceNames.length > 2 ? <span className="device-chip">+{deviceNames.length - 2}</span> : null}
        {task.alertIds.length > 0 ? (
          <span className="task-card__link">
            <Link2 size={10} aria-hidden /> {task.alertIds.length}
          </span>
        ) : null}
      </div>
      {task.checklist.length > 0 ? (
        <div className="task-card__checklist">
          <Progress value={progress} tone={progress === 100 ? "success" : "accent"} />
          <span>
            {done}/{task.checklist.length}
          </span>
        </div>
      ) : null}
      <footer className="task-card__footer">
        <span className="task-card__assignee">
          <Avatar name={task.assignee} size={20} />
          {task.assignee}
        </span>
        <div className="task-card__tags">
          {task.tags.slice(0, 2).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </footer>
    </article>
  );
}

function TaskDrawer({
  task,
  onClose,
  onSave,
  onDelete,
  onOpenAlert,
  onOpenIncident,
}: {
  task: Task;
  onClose: () => void;
  onSave: (patch: Partial<Task>) => Promise<Task | undefined>;
  onDelete: () => void;
  onOpenAlert: (uid: string) => void;
  onOpenIncident: () => void;
}) {
  const { alertViews, deviceMap } = useApp();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assignee, setAssignee] = useState(task.assignee);
  const [dueAt, setDueAt] = useState(toLocalInput(task.dueAt));
  const [tags, setTags] = useState(task.tags.join(", "));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist);
  const [newCheck, setNewCheck] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setStatus(task.status);
    setPriority(task.priority);
    setAssignee(task.assignee);
    setDueAt(toLocalInput(task.dueAt));
    setTags(task.tags.join(", "));
    setChecklist(task.checklist);
  }, [task.id, task.updatedAt]);

  const linkedAlerts = alertViews.filter((view) => task.alertIds.includes(view.alert.uid));
  const devices = task.deviceIds.map((id) => deviceMap.get(id)).filter((device) => Boolean(device));

  const save = async () => {
    setSaving(true);
    await onSave({
      title,
      description,
      status,
      priority,
      assignee,
      dueAt: fromLocalInput(dueAt),
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      checklist,
    });
    setSaving(false);
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width="wide"
        title={task.title}
        subtitle={`${TASK_STATUS_LABEL[task.status]} · ${task.priority} · erstellt ${formatRelative(task.createdAt)}`}
        headerExtra={<TaskStatusBadge status={task.status} />}
        footer={
          <>
            <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Löschen
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Schließen
            </Button>
            <Button variant="primary" icon={Save} loading={saving} onClick={() => void save()}>
              Speichern
            </Button>
          </>
        }
      >
        <div className="form-stack">
          <label className="field">
            <span>Titel</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Beschreibung</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
                {STATUSES.map((entry) => (
                  <option key={entry} value={entry}>
                    {TASK_STATUS_LABEL[entry]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Priorität</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                {PRIORITIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {PRIORITY_LABEL[entry]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Assignee</span>
              <input value={assignee} onChange={(event) => setAssignee(event.target.value)} list="assignee-list" />
              <datalist id="assignee-list">
                {ASSIGNEES.map((entry) => (
                  <option key={entry} value={entry} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>Fällig</span>
              <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
            <label className="field form-grid__full">
              <span>Tags (kommagetrennt)</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="network, hamburg, critical" />
            </label>
          </div>
        </div>

        <section className="detail-section">
          <div className="detail-section__header">
            <h3>Checkliste</h3>
            <Badge tone="neutral">
              {checklist.filter((item) => item.done).length}/{checklist.length}
            </Badge>
          </div>
          <div className="checklist">
            {checklist.map((item) => (
              <button
                type="button"
                className={cn("checklist-item", item.done && "is-done")}
                key={item.id}
                onClick={() =>
                  setChecklist((current) => current.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)))
                }
              >
                {item.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                <span>{item.text}</span>
              </button>
            ))}
          </div>
          <form
            className="checklist-add"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newCheck.trim()) return;
              setChecklist((current) => [...current, { id: `chk_${crypto.randomUUID()}`, text: newCheck.trim(), done: false }]);
              setNewCheck("");
            }}
          >
            <input value={newCheck} onChange={(event) => setNewCheck(event.target.value)} placeholder="Schritt hinzufügen …" />
            <Button size="sm" variant="secondary" icon={Plus} type="submit">
              Hinzufügen
            </Button>
          </form>
        </section>

        {devices.length > 0 ? (
          <section className="detail-section">
            <div className="detail-section__header">
              <h3>Geräte</h3>
              <Badge tone="neutral">{devices.length}</Badge>
            </div>
            <div className="detail-tags">
              {devices.map((device) => (
                <span className="device-chip" key={device!.id}>
                  {device!.displayName}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="detail-section">
          <div className="detail-section__header">
            <h3>Verknüpfte Alarme</h3>
            <Badge tone="neutral">{linkedAlerts.length}</Badge>
          </div>
          {linkedAlerts.length === 0 ? (
            <EmptyState compact icon={Link2} title="Keine Alarme verknüpft" description="Diese Aufgabe wurde manuell erstellt." />
          ) : (
            <div className="alert-list detail-alert-list">
              {linkedAlerts.slice(0, 5).map((view) => (
                <AlertRow key={view.alert.uid} view={view} compact onOpen={() => onOpenAlert(view.alert.uid)} />
              ))}
            </div>
          )}
        </section>

        {task.incidentId ? (
          <section className="detail-section">
            <div className="incident-box">
              <div className="incident-box__icon">
                <AlertTriangle size={17} aria-hidden />
              </div>
              <div className="incident-box__text">
                <span>Aus Kausalität erstellt</span>
                <strong>{task.incidentId}</strong>
                <small>Diese Aufgabe ist mit einem Incident verknüpft.</small>
              </div>
              <Button size="sm" variant="ghost" onClick={onOpenIncident}>
                Incident
              </Button>
            </div>
          </section>
        ) : null}

        <div className="task-meta-foot">
          <span>Erstellt {formatDateTime(task.createdAt)}</span>
          <span>Aktualisiert {formatRelative(task.updatedAt)}</span>
          <span>Quelle: {task.source}</span>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title="Aufgabe löschen?"
        description="Die Aufgabe wird dauerhaft entfernt. Verknüpfte Alarme bleiben bestehen."
        confirmLabel="Löschen"
      />
    </>
  );
}

function NewTaskModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description: string;
    priority: Priority;
    assignee: string;
    dueAt?: number;
    tags: string[];
  }) => Promise<Task | undefined>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("P3");
  const [assignee, setAssignee] = useState("Unassigned");
  const [dueAt, setDueAt] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority("P3");
    setAssignee("Unassigned");
    setDueAt("");
    setTags("");
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Neue Aufgabe"
      subtitle="Manuelle Aufgabe anlegen – ohne Alarmbezug."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            icon={ClipboardPlus}
            loading={saving}
            disabled={!title.trim()}
            onClick={async () => {
              setSaving(true);
              const task = await onCreate({
                title: title.trim(),
                description,
                priority,
                assignee,
                dueAt: fromLocalInput(dueAt),
                tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
              });
              setSaving(false);
              if (task) onClose();
            }}
          >
            Erstellen
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <label className="field">
          <span>Titel</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Was ist zu tun?" />
        </label>
        <label className="field">
          <span>Beschreibung</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Kontext, Schritte, Erwartung …" />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Priorität</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {PRIORITIES.map((entry) => (
                <option key={entry} value={entry}>
                  {PRIORITY_LABEL[entry]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Assignee</span>
            <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              {ASSIGNEES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fällig</span>
            <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </label>
          <label className="field">
            <span>Tags</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="network, hamburg" />
          </label>
        </div>
      </div>
    </Modal>
  );
}

export function Tasks() {
  const { tasks, alertViews, deviceMap, createTask, updateTask, deleteTask, openTasks, overdueTasks } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState("priority");
  const [view, setView] = useState<"board" | "list">("board");
  const [dragging, setDragging] = useState<string | null>(null);
  const { views, save, remove } = useSavedViews("tasks");

  const taskParam = searchParams.get("task");
  const selectedTask = taskParam ? tasks.find((task) => task.id === taskParam) : undefined;
  const newOpen = searchParams.get("new") === "1";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const assignees = useMemo(() => [...new Set(tasks.map((task) => task.assignee))].sort((a, b) => a.localeCompare(b, "de")), [tasks]);
  const tags = useMemo(() => [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b, "de")), [tasks]);

  const filtered = useMemo(() => {
    const list = tasks.filter((task) => {
      const deviceNames = task.deviceIds.map((id) => deviceMap.get(id)?.displayName ?? "");
      if (
        query &&
        !matchesQuery(query, task.title, task.description, task.assignee, task.tags.join(" "), deviceNames.join(" "), task.alertIds.join(" "))
      ) {
        return false;
      }
      if (statusFilter && task.status !== statusFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (assigneeFilter && task.assignee !== assigneeFilter) return false;
      if (tagFilter && !task.tags.includes(tagFilter)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "due") return (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER);
      if (sort === "updated") return b.updatedAt - a.updatedAt;
      if (sort === "created") return b.createdAt - a.createdAt;
      if (sort === "title") return a.title.localeCompare(b.title, "de");
      return a.priority.localeCompare(b.priority) || (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER);
    });
  }, [tasks, deviceMap, query, statusFilter, priorityFilter, assigneeFilter, tagFilter, sort]);

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const status of STATUSES) map.set(status, []);
    for (const task of filtered) map.get(task.status)?.push(task);
    return map;
  }, [filtered]);

  const applyView = (saved: (typeof views)[number]) => {
    setQuery(saved.query);
    setStatusFilter((saved.filters.status?.[0] as TaskStatus) ?? "");
    setPriorityFilter((saved.filters.priority?.[0] as Priority) ?? "");
    setAssigneeFilter(saved.filters.assignee?.[0] ?? "");
    setTagFilter(saved.filters.tag?.[0] ?? "");
    setSort(saved.sort || "priority");
    setView((saved.groupBy as "board" | "list") || "board");
  };

  const saveView = (name: string) => {
    save({
      name,
      query,
      filters: {
        ...(statusFilter ? { status: [statusFilter] } : {}),
        ...(priorityFilter ? { priority: [priorityFilter] } : {}),
        ...(assigneeFilter ? { assignee: [assigneeFilter] } : {}),
        ...(tagFilter ? { tag: [tagFilter] } : {}),
      },
      sort,
      groupBy: view,
    });
  };

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("");
    setPriorityFilter("");
    setAssigneeFilter("");
    setTagFilter("");
  };

  const hasFilters = Boolean(query || statusFilter || priorityFilter || assigneeFilter || tagFilter);

  return (
    <div className="page tasks-page">
      <PageHeader
        eyebrow={
          <span className="eyebrow-status">
            <ClipboardCheck size={13} aria-hidden />
            {openTasks.length} offen · {overdueTasks.length} überfällig
          </span>
        }
        title="Aufgaben"
        description="Aus Alarmen und Ursachen werden nachvollziehbare Aufgaben. Board, Fristen, Assignees und verknüpfte Alarme an einem Ort."
        actions={
          <Button variant="primary" icon={ClipboardPlus} onClick={() => setParam("new", "1")}>
            Aufgabe erstellen
          </Button>
        }
      />

      <div className="task-stats">
        {STATUSES.map((status) => (
          <button
            type="button"
            key={status}
            className={cn("task-stat", `task-stat--${status}`, statusFilter === status && "is-active")}
            onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
          >
            <span>{TASK_STATUS_LABEL[status]}</span>
            <strong>{tasks.filter((task) => task.status === status).length}</strong>
          </button>
        ))}
        <div className="task-stat task-stat--overdue">
          <span>Überfällig</span>
          <strong>{overdueTasks.length}</strong>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__row">
          <SearchInput
            className="toolbar__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Aufgabe, Assignee, Tag oder Gerät suchen …"
          />
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "")} aria-label="Status">
            <option value="">Alle Status</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
          <Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | "")} aria-label="Priorität">
            <option value="">Alle Prioritäten</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </Select>
          <Select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} aria-label="Assignee">
            <option value="">Alle Assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </Select>
          <Select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="Tag">
            <option value="">Alle Tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sortierung">
            <option value="priority">Priorität</option>
            <option value="due">Fälligkeit</option>
            <option value="updated">Zuletzt aktualisiert</option>
            <option value="created">Neueste</option>
            <option value="title">Titel</option>
          </Select>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board", icon: LayoutGrid },
              { value: "list", label: "Liste", icon: List },
            ]}
            ariaLabel="Ansicht"
          />
          <SavedViews views={views} onApply={applyView} onSave={saveView} onRemove={remove} />
        </div>
        {hasFilters ? (
          <div className="active-filters">
            {query ? <span className="active-filter">Suche: {query}</span> : null}
            {statusFilter ? <span className="active-filter">Status: {TASK_STATUS_LABEL[statusFilter]}</span> : null}
            {priorityFilter ? <span className="active-filter">Priorität: {priorityFilter}</span> : null}
            {assigneeFilter ? <span className="active-filter">Assignee: {assigneeFilter}</span> : null}
            {tagFilter ? <span className="active-filter">Tag: {tagFilter}</span> : null}
            <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
              <X size={13} /> Zurücksetzen
            </button>
          </div>
        ) : null}
        <div className="toolbar__meta">
          <span>
            <strong>{filtered.length}</strong> von {tasks.length} Aufgaben
          </span>
          <span className="dot-sep">·</span>
          <span>{view === "board" ? "Kanban-Board" : "Listenansicht"}</span>
        </div>
      </div>

      {view === "board" ? (
        <div className="task-board">
          {STATUSES.map((status) => {
            const columnTasks = grouped.get(status) ?? [];
            return (
              <div
                className={cn("task-column", `task-column--${status}`)}
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/task-id") || dragging;
                  if (id) void updateTask(id, { status });
                  setDragging(null);
                }}
              >
                <div className="task-column__header">
                  <span className={cn("task-column__dot", `task-column__dot--${status}`)} />
                  <h2>{TASK_STATUS_LABEL[status]}</h2>
                  <Badge tone="neutral">{columnTasks.length}</Badge>
                </div>
                <div className="task-column__body">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      deviceNames={task.deviceIds.map((id) => deviceMap.get(id)?.displayName ?? "").filter(Boolean)}
                      dragging={dragging === task.id}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/task-id", task.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDragging(task.id);
                      }}
                      onOpen={() => setParam("task", task.id)}
                    />
                  ))}
                  {columnTasks.length === 0 ? (
                    <div className="task-column__empty">
                      <Circle size={14} aria-hidden />
                      Keine Aufgaben
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Panel>
          {filtered.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Keine Aufgaben gefunden" description="Passe Suche oder Filter an." action={<Button onClick={resetFilters}>Filter zurücksetzen</Button>} />
          ) : (
            <div className="table-wrap">
              <table className="data-table task-table">
                <thead>
                  <tr>
                    <th>Aufgabe</th>
                    <th>Status</th>
                    <th>Priorität</th>
                    <th>Assignee</th>
                    <th>Fällig</th>
                    <th>Geräte</th>
                    <th>Alarme</th>
                    <th>Checkliste</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task) => {
                    const due = dueLabel(task.dueAt);
                    const done = task.checklist.filter((item) => item.done).length;
                    return (
                      <tr key={task.id} onClick={() => setParam("task", task.id)}>
                        <td>
                          <div className="cell-main">
                            <strong>{task.title}</strong>
                            <span>{task.tags.join(" · ") || "Keine Tags"}</span>
                          </div>
                        </td>
                        <td>
                          <TaskStatusBadge status={task.status} />
                        </td>
                        <td>
                          <PriorityBadge priority={task.priority} compact />
                        </td>
                        <td>
                          <span className="task-table__assignee">
                            <Avatar name={task.assignee} size={20} /> {task.assignee}
                          </span>
                        </td>
                        <td>
                          <span className={cn("task-card__due", `task-card__due--${due.tone}`)}>{due.label}</span>
                        </td>
                        <td>{task.deviceIds.length}</td>
                        <td>{task.alertIds.length}</td>
                        <td>
                          {done}/{task.checklist.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {selectedTask ? (
        <TaskDrawer
          task={selectedTask}
          onClose={() => setParam("task", null)}
          onSave={(patch) => updateTask(selectedTask.id, patch)}
          onDelete={async () => {
            await deleteTask(selectedTask.id);
            setParam("task", null);
          }}
          onOpenAlert={(uid) => navigate(`/alerts?alert=${encodeURIComponent(uid)}`)}
          onOpenIncident={() => selectedTask.incidentId && navigate(`/causality?incident=${encodeURIComponent(selectedTask.incidentId)}`)}
        />
      ) : null}

      <NewTaskModal
        open={newOpen}
        onClose={() => setParam("new", null)}
        onCreate={(input) => createTask({ ...input, status: "open", source: "manual" })}
      />
    </div>
  );
}
