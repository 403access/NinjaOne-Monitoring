import type {
  BootstrapPayload,
  CausalityRuleConfig,
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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }
  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as { error: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : `Anfrage fehlgeschlagen (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return parsed as T;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assignee?: string;
  dueAt?: number;
  alertIds?: string[];
  deviceIds?: number[];
  tags?: string[];
  source?: Task["source"];
  incidentId?: string;
}

export interface CreateSignalInput {
  type: SignalType;
  title: string;
  scope: SignalScope;
  startsAt?: number;
  endsAt?: number;
  notes?: string;
  effects?: SignalEffects;
}

export const api = {
  bootstrap: () => request<BootstrapPayload>("/api/bootstrap"),
  sync: () => request<BootstrapPayload>("/api/sync", { method: "POST" }),
  patchSettings: (patch: Partial<Settings>) =>
    request<{ settings: Settings }>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  createTask: (input: CreateTaskInput) =>
    request<{ task: Task }>("/api/tasks", { method: "POST", body: JSON.stringify(input) }),
  updateTask: (id: string, patch: Partial<Task>) =>
    request<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteTask: (id: string) => request<{ ok: true }>(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createSignal: (input: CreateSignalInput) =>
    request<{ signal: ExternalSignal }>("/api/signals", { method: "POST", body: JSON.stringify(input) }),
  updateSignal: (id: string, patch: Partial<ExternalSignal>) =>
    request<{ signal: ExternalSignal }>(`/api/signals/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteSignal: (id: string) =>
    request<{ ok: true }>(`/api/signals/${encodeURIComponent(id)}`, { method: "DELETE" }),
  ackAlert: (uid: string, acknowledged: boolean) =>
    request<{ state: { acknowledged: boolean } }>(`/api/alerts/${encodeURIComponent(uid)}/ack`, {
      method: "POST",
      body: JSON.stringify({ acknowledged }),
    }),
  setAlertPriority: (uid: string, priority: Priority | null) =>
    request<{ state: { priorityOverride?: Priority } }>(`/api/alerts/${encodeURIComponent(uid)}/priority`, {
      method: "POST",
      body: JSON.stringify({ priority }),
    }),
  resetAlert: (uid: string) =>
    request<{ ok: true; upstream: boolean }>(`/api/alerts/${encodeURIComponent(uid)}/reset`, {
      method: "POST",
      body: JSON.stringify({ comment: "Reset via Signal" }),
    }),
  bulkCreateTasks: (input: {
    alertIds: string[];
    grouped?: boolean;
    assignee?: string;
    priority?: Priority;
    incidentId?: string;
    title?: string;
  }) =>
    request<{ tasks: Task[] }>("/api/alerts/bulk-task", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  savePriorityRules: (rules: PriorityRule[]) =>
    request<{ rules: PriorityRule[] }>("/api/priority-rules", {
      method: "PUT",
      body: JSON.stringify({ rules }),
    }),
  saveCausalityRules: (rules: CausalityRuleConfig[]) =>
    request<{ rules: CausalityRuleConfig[] }>("/api/causality-rules", {
      method: "PUT",
      body: JSON.stringify({ rules }),
    }),
  resetDemo: () => request<BootstrapPayload>("/api/demo/reset", { method: "POST" }),
};
