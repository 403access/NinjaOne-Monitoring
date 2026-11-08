import { describe, expect, test } from "bun:test";
import { createDemoSnapshot } from "../src/server/demo/data";
import { DEFAULT_PRIORITY_RULES, DEFAULT_SEVERITY_MATRIX } from "../src/shared/constants";
import { computePriority, scoreAlerts, sortScoredAlerts } from "../src/shared/priority";
import type { Alert, Device, PriorityRule, Settings } from "../src/shared/types";

const now = Date.UTC(2026, 10, 8, 12, 0, 0);
const snapshot = createDemoSnapshot(now);
const devices = snapshot.devices;
const alerts = snapshot.alerts;
const deviceMap = new Map(devices.map((device) => [device.id, device]));

const settings: Pick<Settings, "severityMatrix" | "suppressionThreshold"> = {
  severityMatrix: DEFAULT_SEVERITY_MATRIX,
  suppressionThreshold: 0.7,
};

function alert(uid: string): Alert {
  const found = alerts.find((entry) => entry.uid === uid);
  if (!found) throw new Error(`missing alert ${uid}`);
  return found;
}

describe("priority engine", () => {
  test("security threats are always P1", () => {
    const result = computePriority({
      alert: alert("a-hh-wks-av"),
      device: deviceMap.get(108),
      settings,
      rules: DEFAULT_PRIORITY_RULES,
      now,
    });
    expect(result.priority).toBe("P1");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test("disk below 5 percent is escalated to P1 by rule", () => {
    const result = computePriority({
      alert: alert("a-hh-file-disk"),
      device: deviceMap.get(102),
      settings,
      rules: DEFAULT_PRIORITY_RULES,
      now,
    });
    expect(result.priority).toBe("P1");
    expect(result.reasons.some((reason) => reason.includes("Speicher fast voll"))).toBe(true);
  });

  test("SMART failure is P1", () => {
    const result = computePriority({
      alert: alert("a-hh-dc-smart"),
      device: deviceMap.get(101),
      settings,
      rules: DEFAULT_PRIORITY_RULES,
      now,
    });
    expect(result.priority).toBe("P1");
  });

  test("manual override wins", () => {
    const base = alert("a-hh-sql-cpu");
    const result = computePriority({
      alert: { ...base, priorityOverride: "P1" },
      device: deviceMap.get(103),
      settings,
      rules: DEFAULT_PRIORITY_RULES,
      now,
    });
    expect(result.priority).toBe("P1");
    expect(result.overridden).toBe(true);
  });

  test("maintenance lowers operational alerts but not security", () => {
    const device = deviceMap.get(103)!;
    const maintenanceDevice: Device = { ...device, maintenance: true };
    const operational = computePriority({
      alert: alert("a-hh-sql-cpu"),
      device: maintenanceDevice,
      settings,
      rules: DEFAULT_PRIORITY_RULES,
      now,
    });
    expect(operational.priority).toBe("P4");

    const security = computePriority({
      alert: alert("a-hh-wks-av"),
      device: { ...deviceMap.get(108)!, maintenance: true },
      settings,
      rules: DEFAULT_PRIORITY_RULES,
      now,
    });
    expect(security.priority).toBe("P1");
  });

  test("flapping lowers priority one step", () => {
    const result = computePriority({
      alert: alert("a-dui-grid-cpu"),
      device: deviceMap.get(162),
      settings,
      rules: DEFAULT_PRIORITY_RULES,
      now,
    });
    expect(result.priority).toBe("P4");
    expect(result.reasons.some((reason) => reason.includes("Flapping"))).toBe(true);
  });

  test("disabling a rule removes its escalation", () => {
    const rules: PriorityRule[] = DEFAULT_PRIORITY_RULES.map((rule) =>
      rule.id === "rule-disk-critical" ? { ...rule, enabled: false } : rule,
    );
    const result = computePriority({
      alert: alert("a-hh-file-disk"),
      device: deviceMap.get(102),
      settings,
      rules,
      now,
    });
    expect(result.priority).toBe("P2");
  });

  test("sorting puts P1 before P4 and respects score", () => {
    const scored = scoreAlerts(alerts, devices, settings, DEFAULT_PRIORITY_RULES, now).sort(sortScoredAlerts);
    expect(scored[0]?.priority).toBe("P1");
    const last = scored[scored.length - 1]!;
    expect(last.priority).toBe("P4");
  });

  test("severity matrix is configurable", () => {
    const custom = {
      severityMatrix: { ...DEFAULT_SEVERITY_MATRIX, MAJOR: "P1" as const },
      suppressionThreshold: 0.7,
    };
    const result = computePriority({
      alert: alert("a-hh-erp-disk"),
      device: deviceMap.get(104),
      settings: custom,
      rules: [],
      now,
    });
    expect(result.priority).toBe("P1");
  });
});
