import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SETTINGS } from "../../shared/constants";
import { analyzeCausality } from "../../shared/causality";
import { countByPriority, scoreAlerts, type ScoredAlert } from "../../shared/priority";
import type {
  Alert,
  BootstrapPayload,
  CausalityResult,
  CausalityRuleConfig,
  Condition,
  Device,
  ExternalSignal,
  Incident,
  Location,
  Organization,
  Policy,
  Priority,
  PriorityRule,
  Settings,
  Suppression,
  Task,
} from "../../shared/types";
import { api, type CreateSignalInput, type CreateTaskInput } from "../api";
import { useToast } from "./ToastContext";

export interface AlertView extends ScoredAlert {
  suppression?: Suppression;
  incident?: Incident;
  condition?: Condition;
}

interface AppContextValue {
  payload: BootstrapPayload | null;
  loading: boolean;
  error: string | null;
  syncing: boolean;
  settings: Settings;
  tasks: Task[];
  signals: ExternalSignal[];
  priorityRules: PriorityRule[];
  causalityRules: CausalityRuleConfig[];
  devices: Device[];
  organizations: Organization[];
  locations: Location[];
  alerts: Alert[];
  alertViews: AlertView[];
  conditions: Condition[];
  incidents: Incident[];
  causality: CausalityResult;
  deviceMap: Map<number, Device>;
  organizationMap: Map<number, Organization>;
  locationMap: Map<number, Location>;
  policyMap: Map<number, Policy>;
  incidentByAlert: Map<string, Incident>;
  alertsByDevice: Map<number, AlertView[]>;
  conditionsBySource: Map<string, Condition>;
  priorityCounts: Record<Priority, number>;
  suppressedCount: number;
  openTasks: Task[];
  overdueTasks: Task[];
  activeSignals: ExternalSignal[];
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task | undefined>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<Task | undefined>;
  deleteTask: (id: string) => Promise<boolean>;
  createSignal: (input: CreateSignalInput) => Promise<ExternalSignal | undefined>;
  resolveSignal: (id: string) => Promise<void>;
  deleteSignal: (id: string) => Promise<void>;
  ackAlert: (uid: string, acknowledged: boolean) => Promise<void>;
  setAlertPriority: (uid: string, priority: Priority | null) => Promise<void>;
  resetAlert: (uid: string) => Promise<void>;
  bulkCreateTasks: (input: {
    alertIds: string[];
    grouped?: boolean;
    assignee?: string;
    priority?: Priority;
    incidentId?: string;
    title?: string;
  }) => Promise<Task[]>;
  savePriorityRules: (rules: PriorityRule[]) => Promise<void>;
  saveCausalityRules: (rules: CausalityRuleConfig[]) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { push } = useToast();
  const [payload, setPayload] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.bootstrap();
      setPayload(next);
      setError(null);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .bootstrap()
      .then((next) => {
        if (!active) return;
        setPayload(next);
        setError(null);
      })
      .catch((cause) => {
        if (active) setError(messageOf(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const settings = payload?.settings ?? DEFAULT_SETTINGS;
  const tasks = payload?.tasks ?? [];
  const signals = payload?.signals ?? [];
  const priorityRules = payload?.priorityRules ?? [];
  const causalityRules = payload?.causalityRules ?? [];
  const devices = payload?.snapshot.devices ?? [];
  const alerts = payload?.snapshot.alerts ?? [];
  const conditions = payload?.snapshot.conditions ?? [];
  const organizations = payload?.snapshot.organizations ?? [];
  const locations = payload?.snapshot.locations ?? [];
  const policies = payload?.snapshot.policies ?? [];

  const deviceMap = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const organizationMap = useMemo(() => new Map(organizations.map((organization) => [organization.id, organization])), [organizations]);
  const locationMap = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);
  const policyMap = useMemo(() => new Map(policies.map((policy) => [policy.id, policy])), [policies]);

  const scoredAlerts = useMemo(
    () => scoreAlerts(alerts, devices, settings, priorityRules),
    [alerts, devices, settings, priorityRules],
  );

  const causality = useMemo(
    () =>
      analyzeCausality({
        alerts,
        devices,
        signals,
        rules: causalityRules,
        threshold: settings.suppressionThreshold,
        severityMatrix: settings.severityMatrix,
      }),
    [alerts, devices, signals, causalityRules, settings.suppressionThreshold, settings.severityMatrix],
  );

  const incidentByAlert = useMemo(() => {
    const map = new Map<string, Incident>();
    for (const incident of causality.incidents) {
      for (const uid of incident.alertUids) map.set(uid, incident);
    }
    return map;
  }, [causality.incidents]);

  const conditionsBySource = useMemo(() => {
    const map = new Map<string, Condition>();
    for (const condition of conditions) {
      if (condition.sourceType) map.set(condition.sourceType, condition);
      if (condition.name) map.set(condition.name, condition);
    }
    return map;
  }, [conditions]);

  const alertViews = useMemo<AlertView[]>(
    () =>
      scoredAlerts.map((scored) => ({
        ...scored,
        suppression: causality.suppressions[scored.alert.uid],
        incident: incidentByAlert.get(scored.alert.uid),
        condition: conditionsBySource.get(scored.alert.sourceType) ?? conditionsBySource.get(scored.alert.sourceName),
      })),
    [scoredAlerts, causality.suppressions, incidentByAlert, conditionsBySource],
  );

  const alertsByDevice = useMemo(() => {
    const map = new Map<number, AlertView[]>();
    for (const view of alertViews) {
      const list = map.get(view.alert.deviceId) ?? [];
      list.push(view);
      map.set(view.alert.deviceId, list);
    }
    return map;
  }, [alertViews]);

  const priorityCounts = useMemo(() => countByPriority(alertViews), [alertViews]);
  const suppressedCount = Object.keys(causality.suppressions).length;
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const overdueTasks = useMemo(
    () => openTasks.filter((task) => task.dueAt !== undefined && task.dueAt < Date.now()),
    [openTasks],
  );
  const activeSignals = useMemo(() => signals.filter((signal) => signal.status === "active"), [signals]);

  useEffect(() => {
    document.documentElement.dataset.compact = settings.compactTables ? "true" : "false";
  }, [settings.compactTables]);

  useEffect(() => {
    if (!settings.refreshSeconds || settings.refreshSeconds <= 0) return;
    const timer = window.setInterval(() => {
      api
        .sync()
        .then((next) => setPayload(next))
        .catch(() => undefined);
    }, settings.refreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [settings.refreshSeconds, settings.mode]);

  useEffect(() => {
    const theme = settings.theme;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "light" : "dark") : theme;
      root.dataset.theme = resolved;
      const meta = document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", resolved === "light" ? "#f4f7fb" : "#080c12");
    };
    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [settings.theme]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const next = await api.sync();
      setPayload(next);
      setError(null);
      push(
        next.snapshot.meta.stale
          ? "Sync abgeschlossen, letzter Stand wird angezeigt."
          : `Sync abgeschlossen · ${next.snapshot.meta.counts.alerts} Alarme`,
        next.snapshot.meta.stale ? "warning" : "success",
      );
    } catch (cause) {
      push(messageOf(cause), "error");
    } finally {
      setSyncing(false);
    }
  }, [push]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      setPayload((current) => (current ? { ...current, settings: { ...current.settings, ...patch } } : current));
      try {
        const response = await api.patchSettings(patch);
        setPayload((current) => (current ? { ...current, settings: response.settings } : current));
      } catch (cause) {
        push(messageOf(cause), "error");
        await refresh();
      }
    },
    [push, refresh],
  );

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      try {
        const { task } = await api.createTask(input);
        setPayload((current) => (current ? { ...current, tasks: [task, ...current.tasks] } : current));
        push("Aufgabe erstellt", "success");
        return task;
      } catch (cause) {
        push(messageOf(cause), "error");
        return undefined;
      }
    },
    [push],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      try {
        const { task } = await api.updateTask(id, patch);
        setPayload((current) =>
          current ? { ...current, tasks: current.tasks.map((entry) => (entry.id === id ? task : entry)) } : current,
        );
        return task;
      } catch (cause) {
        push(messageOf(cause), "error");
        return undefined;
      }
    },
    [push],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      try {
        await api.deleteTask(id);
        setPayload((current) => (current ? { ...current, tasks: current.tasks.filter((task) => task.id !== id) } : current));
        push("Aufgabe gelöscht", "success");
        return true;
      } catch (cause) {
        push(messageOf(cause), "error");
        return false;
      }
    },
    [push],
  );

  const createSignal = useCallback(
    async (input: CreateSignalInput) => {
      try {
        const { signal } = await api.createSignal(input);
        setPayload((current) => (current ? { ...current, signals: [signal, ...current.signals] } : current));
        push("Externes Signal aktiv – Kausalität neu berechnet", "success");
        return signal;
      } catch (cause) {
        push(messageOf(cause), "error");
        return undefined;
      }
    },
    [push],
  );

  const resolveSignal = useCallback(
    async (id: string) => {
      try {
        const { signal } = await api.updateSignal(id, { status: "resolved", endsAt: Date.now() });
        setPayload((current) =>
          current ? { ...current, signals: current.signals.map((entry) => (entry.id === id ? signal : entry)) } : current,
        );
        push("Signal beendet", "success");
      } catch (cause) {
        push(messageOf(cause), "error");
      }
    },
    [push],
  );

  const deleteSignal = useCallback(
    async (id: string) => {
      try {
        await api.deleteSignal(id);
        setPayload((current) =>
          current ? { ...current, signals: current.signals.filter((signal) => signal.id !== id) } : current,
        );
        push("Signal entfernt", "success");
      } catch (cause) {
        push(messageOf(cause), "error");
      }
    },
    [push],
  );

  const ackAlert = useCallback(
    async (uid: string, acknowledged: boolean) => {
      try {
        await api.ackAlert(uid, acknowledged);
        setPayload((current) =>
          current
            ? {
                ...current,
                snapshot: {
                  ...current.snapshot,
                  alerts: current.snapshot.alerts.map((alert) =>
                    alert.uid === uid ? { ...alert, acknowledged } : alert,
                  ),
                },
              }
            : current,
        );
        push(acknowledged ? "Alarm bestätigt" : "Bestätigung aufgehoben", "success");
      } catch (cause) {
        push(messageOf(cause), "error");
      }
    },
    [push],
  );

  const setAlertPriority = useCallback(
    async (uid: string, priority: Priority | null) => {
      try {
        await api.setAlertPriority(uid, priority);
        setPayload((current) =>
          current
            ? {
                ...current,
                snapshot: {
                  ...current.snapshot,
                  alerts: current.snapshot.alerts.map((alert) =>
                    alert.uid === uid ? { ...alert, priorityOverride: priority ?? undefined } : alert,
                  ),
                },
              }
            : current,
        );
        push(priority ? `Priorität auf ${priority} gesetzt` : "Prioritäts-Override entfernt", "success");
      } catch (cause) {
        push(messageOf(cause), "error");
      }
    },
    [push],
  );

  const resetAlert = useCallback(
    async (uid: string) => {
      try {
        const result = await api.resetAlert(uid);
        setPayload((current) =>
          current
            ? {
                ...current,
                snapshot: {
                  ...current.snapshot,
                  alerts: current.snapshot.alerts.map((alert) =>
                    alert.uid === uid ? { ...alert, acknowledged: true } : alert,
                  ),
                },
              }
            : current,
        );
        push(result.upstream ? "Alarm in NinjaOne zurückgesetzt" : "Alarm lokal zurückgesetzt", "success");
      } catch (cause) {
        push(messageOf(cause), "error");
      }
    },
    [push],
  );

  const bulkCreateTasks = useCallback(
    async (input: {
      alertIds: string[];
      grouped?: boolean;
      assignee?: string;
      priority?: Priority;
      incidentId?: string;
      title?: string;
    }) => {
      try {
        const { tasks: created } = await api.bulkCreateTasks(input);
        setPayload((current) => (current ? { ...current, tasks: [...created, ...current.tasks] } : current));
        push(`${created.length} ${created.length === 1 ? "Aufgabe" : "Aufgaben"} erstellt`, "success");
        return created;
      } catch (cause) {
        push(messageOf(cause), "error");
        return [];
      }
    },
    [push],
  );

  const savePriorityRules = useCallback(
    async (rules: PriorityRule[]) => {
      try {
        const response = await api.savePriorityRules(rules);
        setPayload((current) => (current ? { ...current, priorityRules: response.rules } : current));
        push("Prioritätsregeln gespeichert", "success");
      } catch (cause) {
        push(messageOf(cause), "error");
      }
    },
    [push],
  );

  const saveCausalityRules = useCallback(
    async (rules: CausalityRuleConfig[]) => {
      try {
        const response = await api.saveCausalityRules(rules);
        setPayload((current) => (current ? { ...current, causalityRules: response.rules } : current));
        push("Kausalitätsregeln gespeichert", "success");
      } catch (cause) {
        push(messageOf(cause), "error");
      }
    },
    [push],
  );

  const resetDemo = useCallback(async () => {
    try {
      const next = await api.resetDemo();
      setPayload(next);
      push("Demo-Daten zurückgesetzt", "success");
    } catch (cause) {
      push(messageOf(cause), "error");
    }
  }, [push]);

  const value: AppContextValue = {
    payload,
    loading,
    error,
    syncing,
    settings,
    tasks,
    signals,
    priorityRules,
    causalityRules,
    devices,
    organizations,
    locations,
    alerts,
    alertViews,
    conditions,
    incidents: causality.incidents,
    causality,
    deviceMap,
    organizationMap,
    locationMap,
    policyMap,
    incidentByAlert,
    alertsByDevice,
    conditionsBySource,
    priorityCounts,
    suppressedCount,
    openTasks,
    overdueTasks,
    activeSignals,
    refresh,
    sync,
    updateSettings,
    createTask,
    updateTask,
    deleteTask,
    createSignal,
    resolveSignal,
    deleteSignal,
    ackAlert,
    setAlertPriority,
    resetAlert,
    bulkCreateTasks,
    savePriorityRules,
    saveCausalityRules,
    resetDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
