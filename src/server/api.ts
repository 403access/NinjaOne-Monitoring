import {
  DEFAULT_SEVERITY_MATRIX,
  priorityRank,
} from "../shared/constants";
import { scoreAlerts } from "../shared/priority";
import type {
  Alert,
  CausalityRuleConfig,
  Device,
  ExternalSignal,
  Priority,
  PriorityRule,
  Settings,
  SignalEffects,
  SignalScope,
  SignalType,
  Task,
  TaskStatus,
} from "../shared/types";
import { NinjaClient } from "./ninja/client";
import { SnapshotService } from "./snapshot";
import { getStore, type Store } from "./store";

const MAX_BODY_BYTES = 1_000_000;
const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4"];
const TASK_STATUSES: TaskStatus[] = ["open", "in_progress", "blocked", "done"];
const SIGNAL_TYPES: SignalType[] = ["ISP", "POWER", "SWITCH", "MAINTENANCE", "OTHER"];

interface Services {
  store: Store;
  client?: NinjaClient;
  snapshots: SnapshotService;
}

let services: Services | undefined;

function getServices(): Services {
  if (!services) {
    const store = getStore();
    const client = NinjaClient.fromEnv();
    services = { store, client, snapshots: new SnapshotService(store, client) };
  }
  return services;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function fail(message: string, status = 400, details?: unknown): Response {
  return json({ error: message, details }, status);
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  if (text.length > MAX_BODY_BYTES) throw new Error("Request body too large");
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Request body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry)) : [];
}

function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && PRIORITIES.includes(value as Priority);
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus);
}

function isSignalType(value: unknown): value is SignalType {
  return typeof value === "string" && SIGNAL_TYPES.includes(value as SignalType);
}

function defaultSignalEffects(type: SignalType): SignalEffects {
  if (type === "MAINTENANCE") {
    return { suppressInternetChecks: true, suppressNetworkChecks: true, suppressAgentAlerts: true };
  }
  if (type === "POWER") {
    return { suppressInternetChecks: true, suppressNetworkChecks: true, suppressAgentAlerts: true };
  }
  if (type === "SWITCH") {
    return { suppressInternetChecks: true, suppressNetworkChecks: true, suppressAgentAlerts: true };
  }
  if (type === "ISP") {
    return { suppressInternetChecks: true, suppressNetworkChecks: true, suppressAgentAlerts: false };
  }
  return { suppressInternetChecks: false, suppressNetworkChecks: false, suppressAgentAlerts: false };
}

function normalizeScope(value: unknown): SignalScope | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const level = record.level;
  if (level !== "organization" && level !== "location" && level !== "device") return undefined;
  return {
    level,
    organizationId: asNumber(record.organizationId),
    locationId: asNumber(record.locationId),
    deviceId: asNumber(record.deviceId),
    label: asString(record.label, "Scope"),
  };
}

function normalizeEffects(value: unknown, type: SignalType): SignalEffects {
  const defaults = defaultSignalEffects(type);
  if (!value || typeof value !== "object") return defaults;
  const record = value as Record<string, unknown>;
  return {
    suppressInternetChecks: typeof record.suppressInternetChecks === "boolean" ? record.suppressInternetChecks : defaults.suppressInternetChecks,
    suppressNetworkChecks: typeof record.suppressNetworkChecks === "boolean" ? record.suppressNetworkChecks : defaults.suppressNetworkChecks,
    suppressAgentAlerts: typeof record.suppressAgentAlerts === "boolean" ? record.suppressAgentAlerts : defaults.suppressAgentAlerts,
  };
}

function dueForPriority(priority: Priority, now: number): number {
  const hours = priority === "P1" ? 2 : priority === "P2" ? 8 : priority === "P3" ? 48 : 168;
  return now + hours * 3_600_000;
}

function taskFromAlerts(
  alerts: Alert[],
  devices: Map<number, Device>,
  settings: Settings,
  rules: Parameters<typeof scoreAlerts>[3],
  options: { assignee?: string; priority?: Priority; grouped?: boolean; incidentId?: string; title?: string },
): Task {
  const now = Date.now();
  const scored = scoreAlerts(alerts, [...devices.values()], settings, rules, now);
  const best = [...scored].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))[0];
  const priority = options.priority ?? best?.priority ?? "P3";
  const firstAlert = alerts[0];
  const firstDevice = firstAlert ? devices.get(firstAlert.deviceId) : undefined;
  const uniqueDevices = [...new Set(alerts.map((alert) => alert.deviceId))];
  const tags = [...new Set(alerts.flatMap((alert) => alert.tags ?? []))].slice(0, 8);

  if (options.grouped && alerts.length > 1) {
    const location = firstDevice?.locationName ?? "Standort";
    const title = options.title ?? `Incident: ${alerts.length} Alarme · ${location}`;
    return {
      id: `tsk_${crypto.randomUUID()}`,
      title,
      description: [
        `${alerts.length} Alarme wurden zu einer Aufgabe zusammengefasst.`,
        "",
        ...alerts.slice(0, 20).map((alert) => {
          const device = devices.get(alert.deviceId);
          return `• ${device?.displayName ?? alert.deviceId}: ${alert.message}`;
        }),
      ].join("\n"),
      status: "open",
      priority,
      assignee: options.assignee?.trim() || "Unassigned",
      dueAt: dueForPriority(priority, now),
      createdAt: now,
      updatedAt: now,
      alertIds: alerts.map((alert) => alert.uid),
      deviceIds: uniqueDevices,
      tags,
      checklist: [
        { id: `chk_${crypto.randomUUID()}`, text: "Alarmlage verifizieren", done: false },
        { id: `chk_${crypto.randomUUID()}`, text: "Ursache eingrenzen", done: false },
        { id: `chk_${crypto.randomUUID()}`, text: "Maßnahme dokumentieren", done: false },
      ],
      source: options.incidentId ? "causality" : "alert",
      incidentId: options.incidentId,
    };
  }

  const device = firstDevice;
  return {
    id: `tsk_${crypto.randomUUID()}`,
    title: options.title ?? `${firstAlert?.subject ?? "Alarm"} · ${device?.displayName ?? "Gerät"}`,
    description: [
      firstAlert?.message ?? "Alarm aus NinjaOne",
      "",
      `Quelle: ${firstAlert?.sourceName ?? "—"}`,
      `Gerät: ${device?.displayName ?? "—"} · ${device?.locationName ?? "—"}`,
      `Severity: ${firstAlert?.severity ?? "—"} · Ninja-Priority: ${firstAlert?.ninjaPriority ?? "—"}`,
    ].join("\n"),
    status: "open",
    priority,
    assignee: options.assignee?.trim() || "Unassigned",
    dueAt: dueForPriority(priority, now),
    createdAt: now,
    updatedAt: now,
    alertIds: alerts.map((alert) => alert.uid),
    deviceIds: uniqueDevices,
    tags,
    checklist: [
      { id: `chk_${crypto.randomUUID()}`, text: "Alarm verifizieren", done: false },
      { id: `chk_${crypto.randomUUID()}`, text: "Ursache prüfen", done: false },
      { id: `chk_${crypto.randomUUID()}`, text: "Maßnahme dokumentieren", done: false },
    ],
    source: options.incidentId ? "causality" : "alert",
    incidentId: options.incidentId,
  };
}

export async function handleApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();
  const segments = path.split("/").filter(Boolean);
  const { store, client, snapshots } = getServices();

  try {
    if (path === "/api/health" && method === "GET") {
      return json({
        ok: true,
        version: "0.1.0",
        mode: store.getSettings().mode,
        credentials: Boolean(client?.configured),
        host: client?.host ?? null,
        now: Date.now(),
      });
    }

    if (path === "/api/bootstrap" && method === "GET") {
      return json(await snapshots.bootstrap());
    }

    if (path === "/api/sync" && method === "POST") {
      const payload = await snapshots.sync();
      store.audit("sync", { mode: payload.settings.mode, stale: payload.snapshot.meta.stale });
      return json(payload);
    }

    if (path === "/api/settings" && method === "PATCH") {
      const body = await readJson(req);
      const patch: Partial<Settings> = {};
      if (body.mode === "demo" || body.mode === "live") patch.mode = body.mode;
      if (body.theme === "dark" || body.theme === "light" || body.theme === "system") patch.theme = body.theme;
      if (typeof body.refreshSeconds === "number") patch.refreshSeconds = Math.max(0, Math.min(3600, body.refreshSeconds));
      if (typeof body.showSuppressed === "boolean") patch.showSuppressed = body.showSuppressed;
      if (typeof body.suppressionThreshold === "number") {
        patch.suppressionThreshold = Math.max(0.5, Math.min(0.999, body.suppressionThreshold));
      }
      if (typeof body.autoTaskSuggestions === "boolean") patch.autoTaskSuggestions = body.autoTaskSuggestions;
      if (typeof body.compactTables === "boolean") patch.compactTables = body.compactTables;
      if (body.severityMatrix && typeof body.severityMatrix === "object") {
        const matrix = body.severityMatrix as Record<string, unknown>;
        const next = { ...DEFAULT_SEVERITY_MATRIX };
        for (const key of Object.keys(next) as Array<keyof typeof next>) {
          const value = matrix[key];
          if (isPriority(value)) next[key] = value;
        }
        patch.severityMatrix = next;
      }
      const settings = store.saveSettings(patch);
      store.audit("settings.update", patch);
      return json({ settings });
    }

    if (path === "/api/tasks" && method === "GET") {
      return json({ tasks: store.getTasks() });
    }

    if (path === "/api/tasks" && method === "POST") {
      const body = await readJson(req);
      const now = Date.now();
      const status = isTaskStatus(body.status) ? body.status : "open";
      const priority = isPriority(body.priority) ? body.priority : "P3";
      const task: Task = {
        id: `tsk_${crypto.randomUUID()}`,
        title: asString(body.title).trim() || "Neue Aufgabe",
        description: asString(body.description),
        status,
        priority,
        assignee: asString(body.assignee, "Unassigned"),
        dueAt: asNumber(body.dueAt),
        createdAt: now,
        updatedAt: now,
        alertIds: asStringArray(body.alertIds),
        deviceIds: asNumberArray(body.deviceIds),
        tags: asStringArray(body.tags),
        checklist: Array.isArray(body.checklist)
          ? body.checklist
              .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
              .map((entry) => ({
                id: asString(entry.id, `chk_${crypto.randomUUID()}`),
                text: asString(entry.text),
                done: Boolean(entry.done),
              }))
          : [],
        source: body.source === "causality" || body.source === "manual" ? body.source : "manual",
        incidentId: asString(body.incidentId) || undefined,
      };
      store.upsertTask(task);
      store.audit("task.create", task);
      return json({ task }, 201);
    }

    if (segments[0] === "api" && segments[1] === "tasks" && segments[2] && segments.length === 3) {
      const id = decodeURIComponent(segments[2]);
      if (method === "PATCH") {
        const existing = store.getTasks().find((task) => task.id === id);
        if (!existing) return fail("Aufgabe nicht gefunden", 404);
        const body = await readJson(req);
        const next: Task = {
          ...existing,
          title: typeof body.title === "string" ? body.title : existing.title,
          description: typeof body.description === "string" ? body.description : existing.description,
          status: isTaskStatus(body.status) ? body.status : existing.status,
          priority: isPriority(body.priority) ? body.priority : existing.priority,
          assignee: typeof body.assignee === "string" ? body.assignee : existing.assignee,
          dueAt: body.dueAt === null ? undefined : asNumber(body.dueAt) ?? existing.dueAt,
          tags: Array.isArray(body.tags) ? asStringArray(body.tags) : existing.tags,
          checklist: Array.isArray(body.checklist)
            ? body.checklist
                .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
                .map((entry) => ({
                  id: asString(entry.id, `chk_${crypto.randomUUID()}`),
                  text: asString(entry.text),
                  done: Boolean(entry.done),
                }))
            : existing.checklist,
          updatedAt: Date.now(),
        };
        store.upsertTask(next);
        store.audit("task.update", { id, patch: body });
        return json({ task: next });
      }
      if (method === "DELETE") {
        const removed = store.deleteTask(id);
        store.audit("task.delete", { id, removed });
        return removed ? json({ ok: true }) : fail("Aufgabe nicht gefunden", 404);
      }
    }

    if (path === "/api/signals" && method === "GET") {
      return json({ signals: store.getSignals() });
    }

    if (path === "/api/signals" && method === "POST") {
      const body = await readJson(req);
      const type = isSignalType(body.type) ? body.type : "OTHER";
      const scope = normalizeScope(body.scope);
      if (!scope) return fail("Signal-Scope fehlt oder ist ungültig");
      const now = Date.now();
      const signal: ExternalSignal = {
        id: `sig_${crypto.randomUUID()}`,
        type,
        title: asString(body.title).trim() || `${type}-Störung`,
        scope,
        startsAt: asNumber(body.startsAt) ?? now,
        endsAt: asNumber(body.endsAt),
        status: "active",
        notes: asString(body.notes),
        effects: normalizeEffects(body.effects, type),
        createdBy: asString(body.createdBy, "UI"),
        createdAt: now,
      };
      store.upsertSignal(signal);
      store.audit("signal.create", signal);
      return json({ signal }, 201);
    }

    if (segments[0] === "api" && segments[1] === "signals" && segments[2] && segments.length === 3) {
      const id = decodeURIComponent(segments[2]);
      if (method === "PATCH") {
        const existing = store.getSignals().find((signal) => signal.id === id);
        if (!existing) return fail("Signal nicht gefunden", 404);
        const body = await readJson(req);
        const next: ExternalSignal = {
          ...existing,
          title: typeof body.title === "string" ? body.title : existing.title,
          notes: typeof body.notes === "string" ? body.notes : existing.notes,
          status: body.status === "resolved" ? "resolved" : body.status === "active" ? "active" : existing.status,
          endsAt: body.endsAt === null ? undefined : asNumber(body.endsAt) ?? existing.endsAt,
          effects: body.effects ? normalizeEffects(body.effects, existing.type) : existing.effects,
        };
        if (next.status === "resolved" && !next.endsAt) next.endsAt = Date.now();
        store.upsertSignal(next);
        store.audit("signal.update", { id, patch: body });
        return json({ signal: next });
      }
      if (method === "DELETE") {
        const removed = store.deleteSignal(id);
        store.audit("signal.delete", { id, removed });
        return removed ? json({ ok: true }) : fail("Signal nicht gefunden", 404);
      }
    }

    if (path === "/api/priority-rules" && method === "GET") {
      return json({ rules: store.getPriorityRules() });
    }

    if (path === "/api/priority-rules" && method === "PUT") {
      const body = await readJson(req);
      if (!Array.isArray(body.rules)) return fail("rules muss ein Array sein");
      const rules = body.rules.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
      store.savePriorityRules(rules as unknown as PriorityRule[]);
      store.audit("priorityRules.update", rules);
      return json({ rules: store.getPriorityRules() });
    }

    if (path === "/api/causality-rules" && method === "GET") {
      return json({ rules: store.getCausalityRules() });
    }

    if (path === "/api/causality-rules" && method === "PUT") {
      const body = await readJson(req);
      if (!Array.isArray(body.rules)) return fail("rules muss ein Array sein");
      store.saveCausalityRules(body.rules as CausalityRuleConfig[]);
      store.audit("causalityRules.update", body.rules);
      return json({ rules: store.getCausalityRules() });
    }

    if (segments[0] === "api" && segments[1] === "alerts" && segments[2] && segments[3] === "ack" && method === "POST") {
      const uid = decodeURIComponent(segments[2]);
      const body = await readJson(req);
      const state = store.setAlertState(uid, { acknowledged: Boolean(body.acknowledged) });
      store.audit("alert.ack", { uid, acknowledged: state.acknowledged });
      return json({ state });
    }

    if (segments[0] === "api" && segments[1] === "alerts" && segments[2] && segments[3] === "priority" && method === "POST") {
      const uid = decodeURIComponent(segments[2]);
      const body = await readJson(req);
      const priority = body.priority === null ? undefined : isPriority(body.priority) ? body.priority : undefined;
      if (body.priority !== null && !priority) return fail("Ungültige Priorität");
      const state = store.setAlertState(uid, { priorityOverride: priority });
      store.audit("alert.priority", { uid, priority });
      return json({ state });
    }

    if (segments[0] === "api" && segments[1] === "alerts" && segments[2] && segments[3] === "reset" && method === "POST") {
      const uid = decodeURIComponent(segments[2]);
      const body = await readJson(req);
      const settings = store.getSettings();
      let upstream = false;
      if (settings.mode === "live" && client?.configured) {
        await client.resetAlert(uid, { comment: asString(body.comment, "Reset via Signal") });
        upstream = true;
      } else {
        store.setAlertState(uid, { acknowledged: true });
      }
      store.audit("alert.reset", { uid, upstream });
      return json({ ok: true, upstream });
    }

    if (path === "/api/alerts/bulk-task" && method === "POST") {
      const body = await readJson(req);
      const alertIds = asStringArray(body.alertIds);
      if (alertIds.length === 0) return fail("alertIds fehlt");
      const payload = await snapshots.bootstrap();
      const alertMap = new Map(payload.snapshot.alerts.map((alert) => [alert.uid, alert]));
      const alerts = alertIds.map((id) => alertMap.get(id)).filter((alert): alert is Alert => Boolean(alert));
      if (alerts.length === 0) return fail("Keine passenden Alarme gefunden", 404);
      const deviceMap = new Map(payload.snapshot.devices.map((device) => [device.id, device]));
      const options = {
        assignee: asString(body.assignee),
        priority: isPriority(body.priority) ? body.priority : undefined,
        grouped: Boolean(body.grouped),
        incidentId: asString(body.incidentId) || undefined,
        title: asString(body.title) || undefined,
      };
      const created = options.grouped
        ? [taskFromAlerts(alerts, deviceMap, payload.settings, payload.priorityRules, options)]
        : alerts.map((alert) => taskFromAlerts([alert], deviceMap, payload.settings, payload.priorityRules, options));
      for (const task of created) store.upsertTask(task);
      store.audit("task.bulkCreate", { alertIds, count: created.length, grouped: options.grouped });
      return json({ tasks: created }, 201);
    }

    if (path === "/api/webhook/ninjaone" && method === "POST") {
      const body = await readJson(req).catch(() => ({}));
      store.audit("webhook.received", body);
      return new Response(null, { status: 204 });
    }

    if (path === "/api/export" && method === "GET") {
      const payload = await snapshots.bootstrap();
      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="signal-export-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    if (path === "/api/demo/reset" && method === "POST") {
      store.resetDemo();
      const payload = await snapshots.bootstrap();
      store.audit("demo.reset", {});
      return json(payload);
    }

    return fail("Nicht gefunden", 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return fail(message, 500);
  }
}
