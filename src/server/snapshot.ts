import { APP_VERSION } from "../shared/constants";
import type { BootstrapPayload, Snapshot } from "../shared/types";
import { createDemoSignals, createDemoSnapshot, createDemoTasks } from "./demo/data";
import { NinjaClient } from "./ninja/client";
import { normalizeLiveSnapshot, type RawNinjaBundle } from "./ninja/normalize";
import { Store } from "./store";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class SnapshotService {
  constructor(
    private readonly store: Store,
    private readonly client?: NinjaClient,
  ) {}

  async bootstrap(): Promise<BootstrapPayload> {
    const settings = this.store.getSettings();
    this.ensureDemoSeed(settings.mode);
    const snapshot = settings.mode === "live" ? await this.loadLive() : this.loadDemo();
    const withState = this.applyAlertState(snapshot);
    return {
      snapshot: withState,
      tasks: this.store.getTasks(),
      signals: this.store.getSignals(),
      settings,
      priorityRules: this.store.getPriorityRules(),
      causalityRules: this.store.getCausalityRules(),
    };
  }

  async sync(): Promise<BootstrapPayload> {
    const settings = this.store.getSettings();
    if (settings.mode === "live") {
      const snapshot = await this.loadLive(true);
      return {
        snapshot: this.applyAlertState(snapshot),
        tasks: this.store.getTasks(),
        signals: this.store.getSignals(),
        settings,
        priorityRules: this.store.getPriorityRules(),
        causalityRules: this.store.getCausalityRules(),
      };
    }
    return this.bootstrap();
  }

  private ensureDemoSeed(mode: "demo" | "live"): void {
    if (mode !== "demo") return;
    if (this.store.isDemoSeeded()) return;
    if (this.store.getTasks().length === 0 && this.store.getSignals().length === 0) {
      for (const task of createDemoTasks()) this.store.upsertTask(task);
      for (const signal of createDemoSignals()) this.store.upsertSignal(signal);
    }
    this.store.markDemoSeeded();
  }

  private loadDemo(): Snapshot {
    return createDemoSnapshot();
  }

  private async loadLive(force = false): Promise<Snapshot> {
    const now = Date.now();
    const cached = this.store.getSnapshotCache("live");
    if (!force && cached && now - cached.fetchedAt < 30_000) {
      const parsed = this.parseCache(cached.payload);
      if (parsed) return { ...parsed, meta: { ...parsed.meta, lastSync: cached.fetchedAt, stale: false } };
    }

    if (!this.client?.configured) {
      if (cached) {
        const parsed = this.parseCache(cached.payload);
        if (parsed) {
          return {
            ...parsed,
            meta: {
              ...parsed.meta,
              stale: true,
              staleReason: "Keine NinjaOne-Credentials konfiguriert. Letzter bekannter Stand wird angezeigt.",
              lastSync: cached.fetchedAt,
            },
          };
        }
      }
      const demo = createDemoSnapshot(now);
      return {
        ...demo,
        meta: {
          ...demo.meta,
          mode: "live",
          sourceLabel: "Live · Demo-Fallback (keine Credentials)",
          stale: true,
          staleReason: "NINJA_CLIENT_ID / NINJA_CLIENT_SECRET fehlen.",
        },
      };
    }

    try {
      const [alerts, devices, policies, organizations, locations, activities, health] = await Promise.all([
        this.client.getAlerts(),
        this.client.getDevices(),
        this.client.getPolicies(),
        this.client.getOrganizations(),
        this.client.getLocations(),
        this.client.getActivities(),
        this.client.getDeviceHealth(),
      ]);

      const bundle: RawNinjaBundle = { alerts, devices, policies, organizations, locations, activities, health };
      const snapshot = normalizeLiveSnapshot(bundle, {
        mode: "live",
        sourceLabel: `Live · ${this.client.host}`,
        generatedAt: now,
        lastSync: now,
        stale: false,
        version: APP_VERSION,
        tenant: this.client.host,
      });
      this.store.setSnapshotCache(JSON.stringify(snapshot), now, "live");
      return snapshot;
    } catch (error) {
      const reason = errorMessage(error);
      if (cached) {
        const parsed = this.parseCache(cached.payload);
        if (parsed) {
          return {
            ...parsed,
            meta: {
              ...parsed.meta,
              stale: true,
              staleReason: `Live-Sync fehlgeschlagen: ${reason}`,
              lastSync: cached.fetchedAt,
            },
          };
        }
      }
      const demo = createDemoSnapshot(now);
      return {
        ...demo,
        meta: {
          ...demo.meta,
          mode: "live",
          sourceLabel: "Live · Fallback (Demo-Daten)",
          stale: true,
          staleReason: `Live-Sync fehlgeschlagen: ${reason}`,
        },
      };
    }
  }

  private parseCache(payload: string): Snapshot | undefined {
    try {
      return JSON.parse(payload) as Snapshot;
    } catch {
      return undefined;
    }
  }

  private applyAlertState(snapshot: Snapshot): Snapshot {
    const states = this.store.getAllAlertStates();
    if (Object.keys(states).length === 0) return snapshot;
    return {
      ...snapshot,
      alerts: snapshot.alerts.map((alert) => {
        const state = states[alert.uid];
        if (!state) return alert;
        return {
          ...alert,
          acknowledged: state.acknowledged,
          priorityOverride: state.priorityOverride,
        };
      }),
    };
  }
}
