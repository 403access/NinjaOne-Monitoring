import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  DEFAULT_CAUSALITY_RULES,
  DEFAULT_PRIORITY_RULES,
  DEFAULT_SETTINGS,
} from "../shared/constants";
import type {
  CausalityRuleConfig,
  ExternalSignal,
  Priority,
  PriorityRule,
  Settings,
  Task,
} from "../shared/types";

interface SettingRow {
  value: string;
}

interface PayloadRow {
  payload: string;
}

interface AlertStateRow {
  uid: string;
  acknowledged: number;
  priority_override: string | null;
}

interface CacheRow {
  payload: string;
  fetched_at: number;
}

export interface AlertState {
  acknowledged: boolean;
  priorityOverride?: Priority;
}

export interface SnapshotCacheEntry {
  payload: string;
  fetchedAt: number;
}

const SETTINGS_KEY = "settings";
const DEMO_SEEDED_KEY = "demo_seeded";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function initialMode(): "demo" | "live" {
  const requested = process.env.NINJA_MODE?.toLowerCase();
  if (requested === "live") return "live";
  if (requested === "auto" && process.env.NINJA_CLIENT_ID && process.env.NINJA_CLIENT_SECRET) return "live";
  return "demo";
}

export class Store {
  private db: Database;

  constructor(path = process.env.DATABASE_PATH ?? ".data/signal.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA foreign_keys = ON;");
    this.migrate();
    this.ensureDefaults();
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS priority_rules (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS causality_rules (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS alert_state (
        uid TEXT PRIMARY KEY,
        acknowledged INTEGER NOT NULL DEFAULT 0,
        priority_override TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS snapshot_cache (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at INTEGER NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at);
      CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
    `);
  }

  private ensureDefaults(): void {
    const existing = this.db.query<SettingRow, [string]>("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY);
    if (!existing) {
      const settings: Settings = { ...DEFAULT_SETTINGS, mode: initialMode() };
      this.db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [SETTINGS_KEY, JSON.stringify(settings)]);
    }
    const rules = this.db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM priority_rules").get();
    if (!rules || rules.count === 0) {
      this.savePriorityRules(DEFAULT_PRIORITY_RULES);
    }
    const causality = this.db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM causality_rules").get();
    if (!causality || causality.count === 0) {
      this.saveCausalityRules(DEFAULT_CAUSALITY_RULES);
    }
  }

  getSettings(): Settings {
    const row = this.db.query<SettingRow, [string]>("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY);
    const stored = row ? parseJson<Partial<Settings>>(row.value, {}) : {};
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  saveSettings(patch: Partial<Settings>): Settings {
    const next: Settings = { ...this.getSettings(), ...patch };
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [SETTINGS_KEY, JSON.stringify(next)],
    );
    return next;
  }

  getTasks(): Task[] {
    return this.db
      .query<PayloadRow, []>("SELECT payload FROM tasks ORDER BY updated_at DESC")
      .all()
      .map((row) => parseJson<Task | null>(row.payload, null))
      .filter((task): task is Task => Boolean(task));
  }

  upsertTask(task: Task): Task {
    this.db.run(
      `INSERT INTO tasks (id, payload, status, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, status = excluded.status, updated_at = excluded.updated_at`,
      [task.id, JSON.stringify(task), task.status, task.updatedAt],
    );
    return task;
  }

  deleteTask(id: string): boolean {
    const result = this.db.run("DELETE FROM tasks WHERE id = ?", [id]);
    return result.changes > 0;
  }

  getSignals(): ExternalSignal[] {
    return this.db
      .query<PayloadRow, []>("SELECT payload FROM signals ORDER BY updated_at DESC")
      .all()
      .map((row) => parseJson<ExternalSignal | null>(row.payload, null))
      .filter((signal): signal is ExternalSignal => Boolean(signal));
  }

  upsertSignal(signal: ExternalSignal): ExternalSignal {
    this.db.run(
      `INSERT INTO signals (id, payload, status, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, status = excluded.status, updated_at = excluded.updated_at`,
      [signal.id, JSON.stringify(signal), signal.status, signal.createdAt],
    );
    return signal;
  }

  deleteSignal(id: string): boolean {
    const result = this.db.run("DELETE FROM signals WHERE id = ?", [id]);
    return result.changes > 0;
  }

  getPriorityRules(): PriorityRule[] {
    const rows = this.db.query<PayloadRow, []>("SELECT payload FROM priority_rules ORDER BY id").all();
    if (rows.length === 0) return DEFAULT_PRIORITY_RULES;
    return rows
      .map((row) => parseJson<PriorityRule | null>(row.payload, null))
      .filter((rule): rule is PriorityRule => Boolean(rule));
  }

  savePriorityRules(rules: PriorityRule[]): void {
    const transaction = this.db.transaction(() => {
      this.db.run("DELETE FROM priority_rules");
      for (const rule of rules) {
        this.db.run("INSERT INTO priority_rules (id, payload, updated_at) VALUES (?, ?, ?)", [
          rule.id,
          JSON.stringify(rule),
          Date.now(),
        ]);
      }
    });
    transaction();
  }

  getCausalityRules(): CausalityRuleConfig[] {
    const rows = this.db.query<PayloadRow, []>("SELECT payload FROM causality_rules ORDER BY id").all();
    const stored = rows
      .map((row) => parseJson<CausalityRuleConfig | null>(row.payload, null))
      .filter((rule): rule is CausalityRuleConfig => Boolean(rule));
    const storedMap = new Map(stored.map((rule) => [rule.id, rule]));
    return DEFAULT_CAUSALITY_RULES.map((rule) => ({ ...rule, ...(storedMap.get(rule.id) ?? {}) }));
  }

  saveCausalityRules(rules: CausalityRuleConfig[]): void {
    const transaction = this.db.transaction(() => {
      this.db.run("DELETE FROM causality_rules");
      for (const rule of rules) {
        this.db.run("INSERT INTO causality_rules (id, payload, updated_at) VALUES (?, ?, ?)", [
          rule.id,
          JSON.stringify(rule),
          Date.now(),
        ]);
      }
    });
    transaction();
  }

  getAllAlertStates(): Record<string, AlertState> {
    const rows = this.db
      .query<AlertStateRow, []>("SELECT uid, acknowledged, priority_override FROM alert_state")
      .all();
    const result: Record<string, AlertState> = {};
    for (const row of rows) {
      result[row.uid] = {
        acknowledged: Boolean(row.acknowledged),
        priorityOverride: (row.priority_override as Priority | null) ?? undefined,
      };
    }
    return result;
  }

  setAlertState(uid: string, patch: Partial<AlertState>): AlertState {
    const current = this.getAllAlertStates()[uid] ?? { acknowledged: false };
    const next: AlertState = { ...current, ...patch };
    this.db.run(
      `INSERT INTO alert_state (uid, acknowledged, priority_override, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(uid) DO UPDATE SET acknowledged = excluded.acknowledged, priority_override = excluded.priority_override, updated_at = excluded.updated_at`,
      [uid, next.acknowledged ? 1 : 0, next.priorityOverride ?? null, Date.now()],
    );
    return next;
  }

  getSnapshotCache(key = "live"): SnapshotCacheEntry | undefined {
    const row = this.db.query<CacheRow, [string]>("SELECT payload, fetched_at FROM snapshot_cache WHERE key = ?").get(key);
    if (!row) return undefined;
    return { payload: row.payload, fetchedAt: row.fetched_at };
  }

  setSnapshotCache(payload: string, fetchedAt = Date.now(), key = "live"): void {
    this.db.run(
      `INSERT INTO snapshot_cache (key, payload, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
      [key, payload, fetchedAt],
    );
  }

  isDemoSeeded(): boolean {
    return Boolean(this.db.query<{ value: string }, [string]>("SELECT value FROM meta WHERE key = ?").get(DEMO_SEEDED_KEY));
  }

  markDemoSeeded(): void {
    this.db.run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
      DEMO_SEEDED_KEY,
      "1",
    ]);
  }

  resetDemo(): void {
    this.db.transaction(() => {
      this.db.run("DELETE FROM tasks");
      this.db.run("DELETE FROM signals");
      this.db.run("DELETE FROM alert_state");
      this.db.run("DELETE FROM meta WHERE key = ?", [DEMO_SEEDED_KEY]);
    })();
  }

  audit(action: string, payload: unknown, actor = "system"): void {
    this.db.run("INSERT INTO audit_log (at, actor, action, payload) VALUES (?, ?, ?, ?)", [
      Date.now(),
      actor,
      action,
      JSON.stringify(payload),
    ]);
  }

  close(): void {
    this.db.close();
  }
}

let singleton: Store | undefined;

export function getStore(): Store {
  if (!singleton) singleton = new Store();
  return singleton;
}
