import { describe, expect, test } from "bun:test";
import { normalizeLiveSnapshot } from "../src/server/ninja/normalize";

const now = Date.UTC(2026, 10, 8, 12, 0, 0);

const bundle = {
  devices: [
    {
      id: 1,
      organizationId: 10,
      locationId: 20,
      nodeClass: "WINDOWS_SERVER",
      displayName: "SRV-TEST",
      systemName: "srv-test",
      offline: true,
      lastContact: 1_760_000_000,
      lastUpdate: 1_760_000_000,
      maintenance: { status: "IN_MAINTENANCE", start: 1_760_000_000, end: 1_760_003_600 },
      tags: ["prod"],
      ipAddresses: ["10.0.0.10"],
      policyId: 30,
      references: {
        organization: { id: 10, name: "Test Org" },
        location: { id: 20, name: "Test Site" },
        policy: { id: 30, name: "Test Policy" },
      },
    },
  ],
  alerts: [
    {
      uid: "alert-1",
      deviceId: 1,
      message: "Agent offline",
      subject: "Agent Offline",
      sourceType: "AGENT_OFFLINE",
      sourceName: "Device Down",
      createTime: 1_760_000_000,
      updateTime: 1_760_000_100,
      data: { priority: "HIGH" },
    },
  ],
  policies: [{ id: 30, name: "Test Policy", nodeClass: "WINDOWS_SERVER", nodeClassDefault: true, tags: [] }],
  organizations: [{ id: 10, name: "Test Org", tags: [] }],
  locations: [{ id: 20, organizationId: 10, name: "Test Site", tags: [] }],
  activities: [
    {
      id: 99,
      deviceId: 1,
      activityTime: 1_760_000_000,
      type: "CONDITION_AGENT_CPU",
      activityType: "CONDITION",
      severity: "MAJOR",
      priority: "MEDIUM",
      status: "TRIGGERED",
      sourceName: "CPU",
      sourceConfigUid: "cfg-cpu",
      message: "CPU high",
    },
  ],
  health: { results: [{ deviceId: 1, healthStatus: "UNHEALTHY", offline: true, parentOffline: false, alertCount: 1 }] },
};

describe("live normalization", () => {
  test("maps official fields into the Signal domain", () => {
    const snapshot = normalizeLiveSnapshot(bundle, {
      mode: "live",
      sourceLabel: "Live · test",
      generatedAt: now,
      lastSync: now,
      stale: false,
      version: "0.1.0",
      tenant: "test.ninjarmm.local",
    });

    expect(snapshot.meta.counts.devices).toBe(1);
    expect(snapshot.meta.counts.alerts).toBe(1);
    expect(snapshot.meta.counts.conditions).toBe(1);
    expect(snapshot.devices[0]?.organizationName).toBe("Test Org");
    expect(snapshot.devices[0]?.nodeGroup).toBe("server");
    expect(snapshot.devices[0]?.maintenance).toBe(true);
    expect(snapshot.devices[0]?.lastContact).toBe(1_760_000_000_000);
    expect(snapshot.alerts[0]?.severity).toBe("CRITICAL");
    expect(snapshot.alerts[0]?.ninjaPriority).toBe("HIGH");
    expect(snapshot.alerts[0]?.tags).toEqual(["prod"]);
    expect(snapshot.conditions[0]?.source).toBe("ninjaone-activity");
    expect(snapshot.conditions[0]?.triggerCount).toBe(1);
    expect(snapshot.health[0]?.healthStatus).toBe("UNHEALTHY");
  });

  test("falls back gracefully when optional data is missing", () => {
    const snapshot = normalizeLiveSnapshot(
      { ...bundle, alerts: [], activities: [], health: undefined, policies: [], organizations: [], locations: [] },
      {
        mode: "live",
        sourceLabel: "Live · test",
        generatedAt: now,
        lastSync: now,
        stale: false,
        version: "0.1.0",
      },
    );
    expect(snapshot.alerts).toHaveLength(0);
    expect(snapshot.conditions).toHaveLength(0);
    expect(snapshot.health).toHaveLength(0);
    expect(snapshot.devices[0]?.organizationName).toBe("Test Org");
  });
});
