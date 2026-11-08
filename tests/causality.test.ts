import { describe, expect, test } from "bun:test";
import { createDemoSignals, createDemoSnapshot } from "../src/server/demo/data";
import { DEFAULT_CAUSALITY_RULES, DEFAULT_SEVERITY_MATRIX } from "../src/shared/constants";
import { analyzeCausality } from "../src/shared/causality";
import type { ExternalSignal } from "../src/shared/types";

const now = Date.UTC(2026, 10, 8, 12, 0, 0);
const snapshot = createDemoSnapshot(now);
const signals = createDemoSignals(now);

const baseInput = {
  alerts: snapshot.alerts,
  devices: snapshot.devices,
  signals,
  rules: DEFAULT_CAUSALITY_RULES,
  threshold: 0.7,
  severityMatrix: DEFAULT_SEVERITY_MATRIX,
  now,
};

describe("causality engine", () => {
  test("builds one incident per real root cause", () => {
    const result = analyzeCausality(baseInput);
    const ids = result.incidents.map((incident) => incident.id).sort();
    expect(ids).toEqual([
      "device:102",
      "device:132",
      "device:141",
      "device:160",
      "signal:sig-isp-bremen",
    ]);
  });

  test("WAN signal suppresses downstream symptoms but keeps the root alert", () => {
    const result = analyzeCausality(baseInput);
    expect(result.suppressions["a-bremen-srv-file"]).toBeDefined();
    expect(result.suppressions["a-bremen-sw"]).toBeDefined();
    expect(result.suppressions["a-bremen-http"]).toBeDefined();
    expect(result.suppressions["a-bremen-fw"]).toBeUndefined();

    const incident = result.incidents.find((entry) => entry.id === "signal:sig-isp-bremen")!;
    expect(incident.kind).toBe("wan");
    expect(incident.rootCauseAlertUid).toBe("a-bremen-fw");
    expect(incident.suppressedAlertUids.length).toBeGreaterThanOrEqual(9);
    expect(incident.deviceIds).toContain(120);
    expect(incident.deviceIds).toContain(127);
  });

  test("switch outage suppresses downstream devices and protects the switch", () => {
    const result = analyzeCausality(baseInput);
    expect(result.suppressions["a-dui-grid1-offline"]?.ruleId).toBe("switch-down");
    expect(result.suppressions["a-dui-grid2-offline"]?.ruleId).toBe("switch-down");
    expect(result.suppressions["a-dui-wks-offline"]?.ruleId).toBe("switch-down");
    expect(result.suppressions["a-dui-grid-ping"]?.ruleId).toBe("switch-down");
    expect(result.suppressions["a-dui-sw"]).toBeUndefined();

    const incident = result.incidents.find((entry) => entry.id === "device:160")!;
    expect(incident.kind).toBe("switch");
    expect(incident.rootCauseAlertUid).toBe("a-dui-sw");
    expect(incident.suppressedAlertUids).toContain("a-dui-grid1-offline");
  });

  test("host offline suppresses VM symptoms via parent topology", () => {
    const result = analyzeCausality(baseInput);
    expect(result.suppressions["a-ber-vm1"]?.ruleId).toBe("parent-offline");
    expect(result.suppressions["a-ber-vm2"]?.ruleId).toBe("parent-offline");
    expect(result.suppressions["a-ber-vm3"]?.ruleId).toBe("parent-offline");
    expect(result.suppressions["a-ber-vm-tools"]?.ruleId).toBe("parent-offline");
    expect(result.suppressions["a-ber-esx"]).toBeUndefined();

    const incident = result.incidents.find((entry) => entry.id === "device:141")!;
    expect(incident.kind).toBe("host");
    expect(incident.suppressedAlertUids).toContain("a-ber-vm1");
  });

  test("agent offline suppresses stale local alerts", () => {
    const result = analyzeCausality(baseInput);
    expect(result.suppressions["a-hh-file-disk"]?.ruleId).toBe("agent-offline");
    expect(result.suppressions["a-hh-file-offline"]).toBeUndefined();
    expect(result.suppressions["a-kiel-wks-disk"]?.ruleId).toBe("agent-offline");

    const incident = result.incidents.find((entry) => entry.id === "device:102")!;
    expect(incident.suppressedAlertUids).toContain("a-hh-file-disk");
  });

  test("security alerts are never suppressed", () => {
    const result = analyzeCausality(baseInput);
    const security = snapshot.alerts.filter((alert) => alert.sourceType.startsWith("AV_") || alert.sourceType.startsWith("BITDEFENDER_"));
    for (const alert of security) {
      expect(result.suppressions[alert.uid]).toBeUndefined();
    }
    expect(result.suppressions["a-hh-wks-av"]).toBeUndefined();
  });

  test("standalone hardware alerts remain visible", () => {
    const result = analyzeCausality(baseInput);
    expect(result.suppressions["a-hh-dc-smart"]).toBeUndefined();
    expect(result.suppressions["a-hh-core-port"]).toBeUndefined();
    expect(result.suppressions["a-ber-pacs-disk"]).toBeUndefined();
  });

  test("disabling a rule prevents its suppression", () => {
    const result = analyzeCausality({
      ...baseInput,
      rules: DEFAULT_CAUSALITY_RULES.map((rule) =>
        rule.id === "agent-offline" ? { ...rule, enabled: false } : rule,
      ),
    });
    expect(result.suppressions["a-hh-file-disk"]).toBeUndefined();
    expect(result.suppressions["a-kiel-wks-disk"]).toBeUndefined();
  });

  test("a high threshold prevents low-confidence suppression", () => {
    const result = analyzeCausality({ ...baseInput, threshold: 0.995 });
    expect(Object.keys(result.suppressions)).toHaveLength(0);
  });

  test("power signal suppresses all operational alerts in scope", () => {
    const powerSignal: ExternalSignal = {
      id: "sig-power-test",
      type: "POWER",
      title: "Stromausfall Test",
      scope: { level: "location", locationId: 1011, label: "Berlin · Campus" },
      startsAt: now - 5 * 60_000,
      status: "active",
      notes: "",
      effects: { suppressInternetChecks: true, suppressNetworkChecks: true, suppressAgentAlerts: true },
      createdBy: "test",
      createdAt: now - 5 * 60_000,
    };
    const result = analyzeCausality({
      ...baseInput,
      signals: [...signals, powerSignal],
    });
    expect(result.suppressions["a-ber-pacs-disk"]).toBeDefined();
    expect(result.suppressions["a-ber-pacs-service"]).toBeDefined();
    expect(result.suppressions["a-ber-wks-battery"]).toBeDefined();
    expect(result.suppressions["a-ber-pacs-mem"]).toBeDefined();
    // Security is still protected.
    expect(result.suppressions["a-hh-wks-av"]).toBeUndefined();
  });

  test("stats are internally consistent", () => {
    const result = analyzeCausality(baseInput);
    expect(result.stats.totalAlerts).toBe(snapshot.alerts.length);
    expect(result.stats.suppressedAlerts).toBe(Object.keys(result.suppressions).length);
    expect(result.stats.incidents).toBe(result.incidents.length);
    expect(result.stats.suppressedAlerts).toBeGreaterThanOrEqual(14);
    expect(result.stats.byRule["wan-outage"]).toBeGreaterThan(0);
    expect(result.stats.byRule["parent-offline"]).toBeGreaterThan(0);
    expect(result.stats.byRule["agent-offline"]).toBeGreaterThan(0);
  });
});
