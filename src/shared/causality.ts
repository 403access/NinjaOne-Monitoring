import {
  DEFAULT_CAUSALITY_RULES,
  DEFAULT_SEVERITY_MATRIX,
  isAgentSource,
  isInternetSource,
  isNetworkSource,
  isSecuritySource,
  priorityRank,
} from "./constants";
import type {
  Alert,
  CausalityResult,
  CausalityRuleConfig,
  CausalityStats,
  CausalLink,
  Device,
  ExternalSignal,
  Incident,
  IncidentKind,
  Priority,
  Severity,
  Suppression,
} from "./types";

export interface CausalityInput {
  alerts: Alert[];
  devices: Device[];
  signals: ExternalSignal[];
  rules?: CausalityRuleConfig[];
  threshold?: number;
  severityMatrix?: Record<Severity, Priority>;
  now?: number;
}

interface Candidate {
  ruleId: string;
  ruleName: string;
  confidence: number;
  rootCauseDeviceId?: number;
  rootCauseAlertUid?: string;
  externalSignalId?: string;
  explanation: string;
  evidence: string[];
}

const RULE_LABEL: Record<string, string> = {
  maintenance: "Wartungsfenster",
  "wan-outage": "WAN-/Internet-Ausfall",
  "switch-down": "Switch-Ausfall",
  "network-path": "Netzwerkpfad",
  "parent-offline": "Elternsystem offline",
  "agent-offline": "Agent offline",
  "external-signal": "Externes Signal",
};

const ROOT_ALERT_PREFERENCE = [
  "AGENT_OFFLINE",
  "CONDITION_PING_RESPONSE",
  "CONDITION_NMS_NETWORK_STATUS",
  "CONDITION_VM_HOST_DEVICE_DOWN",
  "CONDITION_PING",
];

function ruleConfidence(rules: CausalityRuleConfig[], id: string): number | null {
  const rule = rules.find((entry) => entry.id === id);
  if (!rule || !rule.enabled) return null;
  return rule.confidence;
}

function isSignalActive(signal: ExternalSignal, now: number): boolean {
  if (signal.status !== "active") return false;
  if (signal.startsAt > now) return false;
  if (signal.endsAt && signal.endsAt < now) return false;
  return true;
}

function signalMatchesDevice(signal: ExternalSignal, device: Device): boolean {
  const scope = signal.scope;
  if (scope.level === "device") return scope.deviceId === device.id;
  if (scope.level === "location") return scope.locationId === device.locationId;
  if (scope.level === "organization") return scope.organizationId === device.organizationId;
  return false;
}

function pickRootAlert(alerts: Alert[], deviceId: number): Alert | undefined {
  const deviceAlerts = alerts.filter((alert) => alert.deviceId === deviceId);
  for (const sourceType of ROOT_ALERT_PREFERENCE) {
    const match = deviceAlerts.find((alert) => alert.sourceType === sourceType);
    if (match) return match;
  }
  return deviceAlerts[0];
}

function rootDevicePriority(device: Device): Priority {
  if (device.nodeGroup === "server" || device.nodeGroup === "network" || device.nodeGroup === "virtualization") return "P1";
  return "P2";
}

function signalIncidentKind(signal: ExternalSignal): IncidentKind {
  if (signal.type === "ISP") return "wan";
  if (signal.type === "SWITCH") return "switch";
  if (signal.type === "POWER") return "external";
  if (signal.type === "MAINTENANCE") return "maintenance";
  return "external";
}

function signalRuleId(signal: ExternalSignal): string {
  if (signal.type === "ISP") return "wan-outage";
  if (signal.type === "SWITCH") return "switch-down";
  if (signal.type === "MAINTENANCE") return "maintenance";
  return "external-signal";
}

function signalSuppresses(signal: ExternalSignal, alert: Alert): boolean {
  if (signal.type === "MAINTENANCE") return true;
  if (signal.type === "POWER") {
    return (
      (signal.effects.suppressAgentAlerts && isAgentSource(alert.sourceType)) ||
      (signal.effects.suppressNetworkChecks && isNetworkSource(alert.sourceType)) ||
      (signal.effects.suppressInternetChecks && isInternetSource(alert.sourceType))
    );
  }
  if (signal.type === "ISP") {
    return (
      (signal.effects.suppressInternetChecks && isInternetSource(alert.sourceType)) ||
      (signal.effects.suppressAgentAlerts && isAgentSource(alert.sourceType)) ||
      (signal.effects.suppressNetworkChecks && isNetworkSource(alert.sourceType))
    );
  }
  if (signal.type === "SWITCH") {
    return (
      (signal.effects.suppressAgentAlerts && isAgentSource(alert.sourceType)) ||
      (signal.effects.suppressNetworkChecks && isNetworkSource(alert.sourceType)) ||
      (signal.effects.suppressInternetChecks && isInternetSource(alert.sourceType))
    );
  }
  return (
    (signal.effects.suppressAgentAlerts && isAgentSource(alert.sourceType)) ||
    (signal.effects.suppressNetworkChecks && isNetworkSource(alert.sourceType)) ||
    (signal.effects.suppressInternetChecks && isInternetSource(alert.sourceType))
  );
}

function hasOfflineAncestor(device: Device, deviceMap: Map<number, Device>, visited = new Set<number>()): Device | undefined {
  if (!device.parentDeviceId || visited.has(device.id)) return undefined;
  visited.add(device.id);
  const parent = deviceMap.get(device.parentDeviceId);
  if (!parent) return undefined;
  if (parent.offline) return parent;
  return hasOfflineAncestor(parent, deviceMap, visited);
}

function networkRootScore(device: Device): number {
  const nodeClass = device.nodeClass.toUpperCase();
  if (nodeClass.includes("FIREWALL")) return 4;
  if (nodeClass.includes("ROUTER")) return 3;
  if (nodeClass.includes("SWITCH")) return 2;
  if (nodeClass.includes("NETWORK")) return 1;
  return 0;
}

function highestPriority(alerts: Alert[], severityMatrix: Record<Severity, Priority>, fallback: Priority): Priority {
  let result = fallback;
  for (const alert of alerts) {
    const candidate = severityMatrix[alert.severity] ?? "P4";
    if (priorityRank(candidate) < priorityRank(result)) result = candidate;
  }
  return result;
}

function incidentMeta(
  kind: IncidentKind,
  rootDevice: Device | undefined,
  signal: ExternalSignal | undefined,
): { title: string; recommendation: string; suggestedTaskTitle: string } {
  const deviceName = rootDevice?.displayName ?? "Gerät";
  const location = rootDevice?.locationName ?? signal?.scope.label ?? "Standort";
  switch (kind) {
    case "wan":
      return {
        title: `WAN-Ausfall ${location}`,
        recommendation:
          "WAN-Uplink, Firewall und ISP-Verbindung prüfen. Lokale Geräte erst nach Wiederherstellung der Verbindung neu bewerten.",
        suggestedTaskTitle: `WAN-Uplink ${location} prüfen und ISP kontaktieren`,
      };
    case "switch":
      return {
        title: `Netzwerkausfall ${location}`,
        recommendation: `${deviceName} prüfen: Strom, Uplink, SFP/Ports. Danach alle Downstream-Geräte neu bewerten.`,
        suggestedTaskTitle: `Switch ${deviceName} prüfen (Strom, Uplink, Ports)`,
      };
    case "network":
      return {
        title: `Netzwerkpfad ${location} gestört`,
        recommendation: `${deviceName} und den vorgelagerten Pfad prüfen; Downstream-Alarme als Symptome behandeln.`,
        suggestedTaskTitle: `Netzwerkpfad über ${deviceName} prüfen`,
      };
    case "host":
      return {
        title: `Host ${deviceName} offline`,
        recommendation: `${deviceName} prüfen: Strom, Management, Hypervisor. VMs erst nach Host-Recovery einzeln bewerten.`,
        suggestedTaskTitle: `Host ${deviceName} prüfen und VMs validieren`,
      };
    case "agent":
      return {
        title: `Agent offline: ${deviceName}`,
        recommendation: `${deviceName} prüfen: Agent-Dienst, Konnektivität, letzter Kontakt. Veraltete Condition-Alarme nicht als aktuell behandeln.`,
        suggestedTaskTitle: `Agent auf ${deviceName} prüfen`,
      };
    case "maintenance":
      return {
        title: `Wartung: ${location}`,
        recommendation: "Wartung abwarten. Sicherheitsalarme bleiben sichtbar und werden nicht unterdrückt.",
        suggestedTaskTitle: `Wartung ${location} begleiten`,
      };
    default:
      return {
        title: signal?.title ?? `Externe Störung ${location}`,
        recommendation: "Externes Signal prüfen und nach Behebung die betroffenen Alarme neu bewerten.",
        suggestedTaskTitle: `Externe Störung ${location} prüfen`,
      };
  }
}

export function analyzeCausality(input: CausalityInput): CausalityResult {
  const now = input.now ?? Date.now();
  const rules = input.rules ?? DEFAULT_CAUSALITY_RULES;
  const threshold = input.threshold ?? 0.7;
  const severityMatrix = input.severityMatrix ?? DEFAULT_SEVERITY_MATRIX;
  const deviceMap = new Map(input.devices.map((device) => [device.id, device]));
  const alertMap = new Map(input.alerts.map((alert) => [alert.uid, alert]));
  const activeSignals = input.signals.filter((signal) => isSignalActive(signal, now));

  const networkRoots = new Map<number, Device>();
  for (const device of input.devices) {
    if (!device.offline || !device.isNetworkDevice) continue;
    const current = networkRoots.get(device.locationId);
    if (!current || networkRootScore(device) > networkRootScore(current)) {
      networkRoots.set(device.locationId, device);
    }
  }

  const signalCoversDevice = (device: Device): ExternalSignal | undefined =>
    activeSignals.find((signal) => {
      if (signal.type === "MAINTENANCE") return signalMatchesDevice(signal, device);
      if (signal.scope.level === "device") {
        if (signal.scope.deviceId === device.id) return true;
        const scopedDevice = signal.scope.deviceId ? deviceMap.get(signal.scope.deviceId) : undefined;
        if (scopedDevice && scopedDevice.locationId === device.locationId) return true;
      }
      return signalMatchesDevice(signal, device);
    });

  const rootDeviceIds = new Set<number>();
  const rootAlertUids = new Set<string>();
  const incidents: Incident[] = [];
  const rootDeviceIncident = new Map<number, string>();
  const signalIncident = new Map<string, Incident>();

  const addRootDevice = (device: Device, incident: Incident) => {
    rootDeviceIds.add(device.id);
    rootDeviceIncident.set(device.id, incident.id);
    if (!incident.deviceIds.includes(device.id)) incident.deviceIds.push(device.id);
    const rootAlert = pickRootAlert(input.alerts, device.id);
    if (rootAlert) {
      rootAlertUids.add(rootAlert.uid);
      if (!incident.alertUids.includes(rootAlert.uid)) incident.alertUids.push(rootAlert.uid);
      if (!incident.rootCauseAlertUid) incident.rootCauseAlertUid = rootAlert.uid;
    }
    if (!incident.rootCauseDeviceId) incident.rootCauseDeviceId = device.id;
  };

  // 1) Active external signals become incidents and absorb roots inside their scope.
  for (const signal of activeSignals) {
    const kind = signalIncidentKind(signal);
    const meta = incidentMeta(kind, undefined, signal);
    const scopeDevices = input.devices.filter((device) => signalMatchesDevice(signal, device));
    const expanded =
      signal.type === "SWITCH" && signal.scope.level === "device"
        ? input.devices.filter((device) => {
            const scoped = signal.scope.deviceId ? deviceMap.get(signal.scope.deviceId) : undefined;
            return scoped ? device.locationId === scoped.locationId : false;
          })
        : scopeDevices;

    const confidence = ruleConfidence(rules, signalRuleId(signal)) ?? (signal.type === "MAINTENANCE" ? 0.99 : 0.85);
    const incident: Incident = {
      id: `signal:${signal.id}`,
      kind,
      title: signal.title || meta.title,
      summary: signal.notes || `${signal.scope.label} ist von einem externen ${signal.type}-Signal betroffen.`,
      externalSignalId: signal.id,
      rootCauseDeviceId: signal.scope.deviceId,
      organizationId: signal.scope.organizationId ?? scopeDevices[0]?.organizationId,
      organizationName: scopeDevices[0]?.organizationName,
      locationId: signal.scope.locationId ?? scopeDevices[0]?.locationId,
      locationName: scopeDevices[0]?.locationName ?? signal.scope.label,
      alertUids: [],
      suppressedAlertUids: [],
      deviceIds: [],
      priority: kind === "maintenance" ? "P4" : "P1",
      confidence,
      evidence: [`Externes Signal: ${signal.title}`, `Scope: ${signal.scope.label}`, `Typ: ${signal.type}`],
      recommendation: meta.recommendation,
      suggestedTaskTitle: meta.suggestedTaskTitle,
      suggestedTaskPriority: kind === "maintenance" ? "P4" : "P1",
      detectedAt: signal.startsAt,
    };

    if (kind === "maintenance") {
      incident.priority = "P4";
      incident.suggestedTaskPriority = "P4";
    }

    for (const device of expanded) {
      if (!incident.deviceIds.includes(device.id)) incident.deviceIds.push(device.id);
    }

    const networkRoot = [...networkRoots.values()].find((device) => expanded.some((entry) => entry.id === device.id));
    if (networkRoot) {
      addRootDevice(networkRoot, incident);
      incident.rootCauseDeviceId = networkRoot.id;
    } else if (signal.scope.deviceId) {
      const scoped = deviceMap.get(signal.scope.deviceId);
      if (scoped) addRootDevice(scoped, incident);
    }

    incidents.push(incident);
    signalIncident.set(signal.id, incident);
  }

  // 2) Network roots not already explained by a signal.
  for (const root of networkRoots.values()) {
    if (signalCoversDevice(root)) continue;
    if (rootDeviceIncident.has(root.id)) continue;
    const kind: IncidentKind = root.nodeClass.toUpperCase().includes("SWITCH") ? "switch" : "wan";
    const meta = incidentMeta(kind, root, undefined);
    const ruleId = kind === "switch" ? "switch-down" : "wan-outage";
    const confidence = ruleConfidence(rules, ruleId);
    if (confidence === null) continue;
    const incident: Incident = {
      id: `device:${root.id}`,
      kind,
      title: meta.title,
      summary: `${root.displayName} ist offline. Abhängige Geräte und Alarme werden als Symptome gruppiert.`,
      rootCauseDeviceId: root.id,
      organizationId: root.organizationId,
      organizationName: root.organizationName,
      locationId: root.locationId,
      locationName: root.locationName,
      alertUids: [],
      suppressedAlertUids: [],
      deviceIds: [],
      priority: rootDevicePriority(root),
      confidence,
      evidence: [`${root.displayName} offline`, `Standort: ${root.locationName}`, `Geräteklasse: ${root.nodeClass}`],
      recommendation: meta.recommendation,
      suggestedTaskTitle: meta.suggestedTaskTitle,
      suggestedTaskPriority: "P1",
      detectedAt: root.lastContact,
    };
    addRootDevice(root, incident);
    for (const device of input.devices.filter((entry) => entry.locationId === root.locationId && entry.id !== root.id && entry.offline)) {
      if (!incident.deviceIds.includes(device.id)) incident.deviceIds.push(device.id);
    }
    incidents.push(incident);
  }

  // 3) Offline virtual hosts (parent of VMs) become host incidents.
  for (const device of input.devices) {
    if (!device.offline || !device.isVirtualHost) continue;
    if (rootDeviceIncident.has(device.id) || signalCoversDevice(device)) continue;
    if (networkRoots.has(device.locationId)) continue;
    const confidence = ruleConfidence(rules, "parent-offline");
    if (confidence === null) continue;
    const meta = incidentMeta("host", device, undefined);
    const incident: Incident = {
      id: `device:${device.id}`,
      kind: "host",
      title: meta.title,
      summary: `${device.displayName} ist offline. ${input.devices.filter((entry) => entry.parentDeviceId === device.id).length} abhängige VMs sind betroffen.`,
      rootCauseDeviceId: device.id,
      organizationId: device.organizationId,
      organizationName: device.organizationName,
      locationId: device.locationId,
      locationName: device.locationName,
      alertUids: [],
      suppressedAlertUids: [],
      deviceIds: [],
      priority: "P1",
      confidence,
      evidence: [`${device.displayName} offline`, `Parent von ${input.devices.filter((entry) => entry.parentDeviceId === device.id).length} VMs`],
      recommendation: meta.recommendation,
      suggestedTaskTitle: meta.suggestedTaskTitle,
      suggestedTaskPriority: "P1",
      detectedAt: device.lastContact,
    };
    addRootDevice(device, incident);
    incidents.push(incident);
  }

  // 4) Remaining offline devices are agent/device incidents, unless a parent or signal explains them.
  for (const device of input.devices) {
    if (!device.offline) continue;
    if (rootDeviceIncident.has(device.id)) continue;
    if (signalCoversDevice(device)) continue;
    if (networkRoots.has(device.locationId)) continue;
    if (device.isNetworkDevice || device.isVirtualHost) continue;
    if (hasOfflineAncestor(device, deviceMap)) continue;
    const confidence = ruleConfidence(rules, "agent-offline");
    if (confidence === null) continue;
    const meta = incidentMeta("agent", device, undefined);
    const incident: Incident = {
      id: `device:${device.id}`,
      kind: "agent",
      title: meta.title,
      summary: `${device.displayName} hat seit ${Math.max(1, Math.round((now - device.lastContact) / 60_000))} Minuten keinen Kontakt.`,
      rootCauseDeviceId: device.id,
      organizationId: device.organizationId,
      organizationName: device.organizationName,
      locationId: device.locationId,
      locationName: device.locationName,
      alertUids: [],
      suppressedAlertUids: [],
      deviceIds: [device.id],
      priority: rootDevicePriority(device),
      confidence,
      evidence: [`Letzter Kontakt: ${new Date(device.lastContact).toISOString()}`, `Geräteklasse: ${device.nodeClass}`],
      recommendation: meta.recommendation,
      suggestedTaskTitle: meta.suggestedTaskTitle,
      suggestedTaskPriority: rootDevicePriority(device),
      detectedAt: device.lastContact,
    };
    addRootDevice(device, incident);
    incidents.push(incident);
  }

  // 5) Suppress symptoms.
  const suppressions: Record<string, Suppression> = {};
  const byRule: Record<string, number> = {};

  for (const alert of input.alerts) {
    if (rootAlertUids.has(alert.uid)) continue;
    if (isSecuritySource(alert.sourceType)) continue;
    const device = deviceMap.get(alert.deviceId);
    if (!device) continue;

    const candidates: Candidate[] = [];
    const matchingSignals = activeSignals.filter((signal) => signalMatchesDevice(signal, device));
    const suppressingSignals = matchingSignals.filter((signal) => signalSuppresses(signal, alert));
    const offlineAncestor = hasOfflineAncestor(device, deviceMap);
    const networkRoot = networkRoots.get(device.locationId);

    // Maintenance
    if (device.maintenance) {
      const confidence = ruleConfidence(rules, "maintenance");
      if (confidence !== null) {
        candidates.push({
          ruleId: "maintenance",
          ruleName: RULE_LABEL.maintenance,
          confidence,
          rootCauseDeviceId: device.id,
          explanation: `${device.displayName} befindet sich im Wartungsfenster.`,
          evidence: ["Device maintenance = true"],
        });
      }
    }

    // External signals take precedence: they explain the whole scope, not just one device.
    for (const signal of suppressingSignals) {
      const ruleId = signalRuleId(signal);
      const confidence = ruleConfidence(rules, ruleId);
      if (confidence === null) continue;
      candidates.push({
        ruleId,
        ruleName: RULE_LABEL[ruleId] ?? RULE_LABEL["external-signal"],
        confidence,
        externalSignalId: signal.id,
        rootCauseDeviceId: signal.scope.deviceId,
        explanation: `Aktives externes Signal „${signal.title}“ (${signal.type}) erklärt diesen Alarm.`,
        evidence: [`Signal: ${signal.title}`, `Scope: ${signal.scope.label}`],
      });
    }

    if (suppressingSignals.length === 0) {
      // Network path / switch / WAN root at the same location
      if (networkRoot && networkRoot.id !== device.id) {
        const rootKind: IncidentKind = networkRoot.nodeClass.toUpperCase().includes("SWITCH") ? "switch" : "wan";
        const ruleId = rootKind === "switch" ? "switch-down" : "wan-outage";
        const confidence = ruleConfidence(rules, ruleId);
        if (confidence !== null) {
          const downstreamOffline =
            device.offline && (isAgentSource(alert.sourceType) || isNetworkSource(alert.sourceType) || isInternetSource(alert.sourceType));
          const internetSymptom = rootKind === "wan" && isInternetSource(alert.sourceType);
          if (downstreamOffline || internetSymptom) {
            candidates.push({
              ruleId,
              ruleName: RULE_LABEL[ruleId],
              confidence,
              rootCauseDeviceId: networkRoot.id,
              rootCauseAlertUid: pickRootAlert(input.alerts, networkRoot.id)?.uid,
              explanation: `${networkRoot.displayName} ist offline; ${device.displayName} liegt im selben Netzwerkpfad.`,
              evidence: [`Root: ${networkRoot.displayName} (${networkRoot.nodeClass})`, `Standort: ${networkRoot.locationName}`],
            });
          }
        }
      }

      // Parent / host offline
      if (offlineAncestor) {
        const confidence = ruleConfidence(rules, "parent-offline");
        if (confidence !== null) {
          candidates.push({
            ruleId: "parent-offline",
            ruleName: RULE_LABEL["parent-offline"],
            confidence,
            rootCauseDeviceId: offlineAncestor.id,
            rootCauseAlertUid: pickRootAlert(input.alerts, offlineAncestor.id)?.uid,
            explanation: `Das Elternsystem ${offlineAncestor.displayName} ist offline; ${device.displayName} kann nicht zuverlässig berichten.`,
            evidence: [`Parent: ${offlineAncestor.displayName}`, `Parent offline = true`],
          });
        }
      }

      // Agent offline on the same device — only when no stronger topology cause exists.
      if (
        device.offline &&
        !offlineAncestor &&
        !networkRoot &&
        isAgentSource(alert.sourceType) &&
        alert.sourceType !== "AGENT_OFFLINE"
      ) {
        const confidence = ruleConfidence(rules, "agent-offline");
        if (confidence !== null) {
          candidates.push({
            ruleId: "agent-offline",
            ruleName: RULE_LABEL["agent-offline"],
            confidence,
            rootCauseDeviceId: device.id,
            rootCauseAlertUid: pickRootAlert(input.alerts, device.id)?.uid,
            explanation: `${device.displayName} ist offline. Der Alarm ist ein veralteter letzter Stand und aktuell nicht belastbar.`,
            evidence: [`Letzter Kontakt: ${new Date(device.lastContact).toISOString()}`],
          });
        }
      }
    }

    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0]!;
    if (best.confidence < threshold) continue;

    suppressions[alert.uid] = {
      alertUid: alert.uid,
      ruleId: best.ruleId,
      ruleName: best.ruleName,
      rootCauseAlertUid: best.rootCauseAlertUid,
      rootCauseDeviceId: best.rootCauseDeviceId,
      externalSignalId: best.externalSignalId,
      confidence: best.confidence,
      explanation: best.explanation,
      evidence: best.evidence,
    };
    byRule[best.ruleId] = (byRule[best.ruleId] ?? 0) + 1;
  }

  // 6) Attach suppressions to incidents and finalize.
  for (const alertUid of Object.keys(suppressions)) {
    const suppression = suppressions[alertUid]!;
    const alert = alertMap.get(alertUid);
    if (!alert) continue;
    let incident: Incident | undefined;
    if (suppression.externalSignalId) incident = signalIncident.get(suppression.externalSignalId);
    if (!incident && suppression.rootCauseDeviceId) {
      const incidentId = rootDeviceIncident.get(suppression.rootCauseDeviceId);
      if (incidentId) incident = incidents.find((entry) => entry.id === incidentId);
    }
    if (!incident) continue;
    if (!incident.suppressedAlertUids.includes(alertUid)) incident.suppressedAlertUids.push(alertUid);
    if (!incident.alertUids.includes(alertUid)) incident.alertUids.push(alertUid);
    if (!incident.deviceIds.includes(alert.deviceId)) incident.deviceIds.push(alert.deviceId);
  }

  for (const incident of incidents) {
    const relatedAlerts = incident.alertUids.map((uid) => alertMap.get(uid)).filter((alert): alert is Alert => Boolean(alert));
    incident.priority = highestPriority(relatedAlerts, severityMatrix, incident.priority);
    incident.suggestedTaskPriority = incident.priority;
    if (incident.kind === "maintenance") {
      incident.priority = "P4";
      incident.suggestedTaskPriority = "P4";
    }
    const suppressionConfidence = incident.suppressedAlertUids
      .map((uid) => suppressions[uid]?.confidence ?? 0)
      .reduce((max, value) => Math.max(max, value), 0);
    incident.confidence = Math.max(incident.confidence, suppressionConfidence);
    if (incident.alertUids.length > 0) {
      incident.summary = `${incident.summary} ${incident.alertUids.length} Alarme, ${incident.deviceIds.length} Geräte betroffen.`;
    }
  }

  incidents.sort((a, b) => {
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return a.detectedAt - b.detectedAt;
  });

  const links: CausalLink[] = [];
  for (const incident of incidents) {
    const from = incident.externalSignalId ? `signal:${incident.externalSignalId}` : `device:${incident.rootCauseDeviceId}`;
    for (const deviceId of incident.deviceIds) {
      if (deviceId === incident.rootCauseDeviceId) continue;
      links.push({
        from,
        to: `device:${deviceId}`,
        kind: "root-cause",
        label: incident.kind,
        confidence: incident.confidence,
      });
    }
    for (const alertUid of incident.suppressedAlertUids) {
      links.push({
        from,
        to: `alert:${alertUid}`,
        kind: "suppresses",
        label: suppressions[alertUid]?.ruleName ?? "suppressed",
        confidence: suppressions[alertUid]?.confidence ?? incident.confidence,
      });
    }
  }

  const affectedDeviceIds = new Set<number>();
  const affectedLocationIds = new Set<number>();
  for (const incident of incidents) {
    for (const deviceId of incident.deviceIds) affectedDeviceIds.add(deviceId);
    if (incident.locationId) affectedLocationIds.add(incident.locationId);
  }

  const stats: CausalityStats = {
    totalAlerts: input.alerts.length,
    suppressedAlerts: Object.keys(suppressions).length,
    rootCauses: incidents.length,
    incidents: incidents.length,
    byRule,
    affectedDevices: affectedDeviceIds.size,
    affectedLocations: affectedLocationIds.size,
  };

  return { incidents, suppressions, links, stats };
}

export function incidentKindLabel(kind: IncidentKind): string {
  switch (kind) {
    case "wan":
      return "WAN / Internet";
    case "switch":
      return "Switch";
    case "network":
      return "Netzwerk";
    case "host":
      return "Host";
    case "agent":
      return "Agent";
    case "maintenance":
      return "Wartung";
    case "external":
      return "Extern";
    default:
      return "Einzelalarm";
  }
}
