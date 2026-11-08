import { CloudOff, GitBranch, Network, ServerCrash, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { Alert, Device, ExternalSignal, Incident } from "../../../shared/types";
import { incidentKindLabel } from "../../../shared/causality";

const KIND_ICON: Record<string, LucideIcon> = {
  wan: CloudOff,
  switch: Network,
  network: Network,
  host: ServerCrash,
  agent: GitBranch,
  maintenance: Wrench,
  external: Zap,
};

export function CausalGraph({
  incident,
  devices,
  alerts,
  signals,
}: {
  incident: Incident;
  devices: Device[];
  alerts: Alert[];
  signals: ExternalSignal[];
}) {
  const rootDevice = incident.rootCauseDeviceId ? devices.find((device) => device.id === incident.rootCauseDeviceId) : undefined;
  const signal = incident.externalSignalId ? signals.find((entry) => entry.id === incident.externalSignalId) : undefined;
  const alertMap = new Map(alerts.map((alert) => [alert.uid, alert]));
  const impactDevices = [...new Set(incident.deviceIds)]
    .filter((id) => id !== incident.rootCauseDeviceId)
    .map((id) => devices.find((device) => device.id === id))
    .filter((device): device is Device => Boolean(device))
    .slice(0, 6);
  const alertNodes = incident.suppressedAlertUids
    .map((uid) => alertMap.get(uid))
    .filter((alert): alert is Alert => Boolean(alert))
    .slice(0, 4);
  const nodes =
    impactDevices.length > 0
      ? impactDevices.map((device) => ({
          id: `device:${device.id}`,
          label: device.displayName,
          sub: device.nodeClass,
          offline: device.offline,
          count: incident.suppressedAlertUids
            .map((uid) => alertMap.get(uid))
            .filter((alert) => alert?.deviceId === device.id).length,
        }))
      : alertNodes.map((alert) => ({
          id: `alert:${alert.uid}`,
          label: alert.message,
          sub: alert.sourceName,
          offline: true,
          count: 0,
        }));
  const hiddenDevices = Math.max(
    0,
    impactDevices.length > 0 ? incident.deviceIds.length - 1 - nodes.length : incident.suppressedAlertUids.length - nodes.length,
  );
  const rootLabel = signal?.title ?? rootDevice?.displayName ?? incident.title;
  const rootSub = signal ? `${signal.type}-Signal · ${signal.scope.label}` : rootDevice?.nodeClass ?? incidentKindLabel(incident.kind);
  const rootIcon = KIND_ICON[incident.kind] ?? GitBranch;
  const RootIcon = rootIcon;
  const width = 680;
  const height = 330;
  const centerX = width / 2;
  const deviceY = 245;
  const spacing = nodes.length > 1 ? Math.min(150, 520 / (nodes.length - 1)) : 0;
  const startX = centerX - (spacing * (nodes.length - 1)) / 2;

  return (
    <div className="causal-graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Kausalgraph: ${rootLabel} beeinflusst ${impactDevices.length} Geräte`}>
        <defs>
          <linearGradient id="graph-root" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.12" />
          </linearGradient>
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
          </marker>
        </defs>

        <rect x={centerX - 155} y={18} width={310} height={82} rx={14} fill="url(#graph-root)" stroke="var(--violet)" strokeOpacity="0.45" />
        <g transform={`translate(${centerX - 133} 38)`}>
          <RootIcon size={20} color="var(--violet)" />
        </g>
        <text x={centerX - 105} y={53} fill="var(--text)" fontSize="12" fontWeight="650">
          {rootLabel.length > 36 ? `${rootLabel.slice(0, 35)}…` : rootLabel}
        </text>
        <text x={centerX - 105} y={70} fill="var(--text-subtle)" fontSize="9.5">
          {rootSub}
        </text>
        <text x={centerX - 105} y={86} fill="var(--violet)" fontSize="8.5" fontWeight="700" letterSpacing="0.08em">
          ROOT CAUSE · {Math.round(incident.confidence * 100)} %
        </text>

        {nodes.map((node, index) => {
          const x = startX + spacing * index;
          const linePath = `M ${centerX} 100 C ${centerX} 150, ${x} 180, ${x} ${deviceY - 10}`;
          const label = node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label;
          return (
            <g key={node.id}>
              <path d={linePath} fill="none" stroke="var(--border-strong)" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#graph-arrow)" />
              <rect x={x - 72} y={deviceY - 8} width={144} height={52} rx={10} fill="var(--surface-2)" stroke="var(--border)" />
              <circle cx={x - 55} cy={deviceY + 12} r={5} fill={node.offline ? "var(--danger)" : "var(--success)"} />
              <text x={x - 44} y={deviceY + 15} fill="var(--text)" fontSize="9.5" fontWeight="600">
                {label}
              </text>
              <text x={x - 44} y={deviceY + 30} fill="var(--text-subtle)" fontSize="8">
                {node.sub}
              </text>
              {node.count > 0 ? (
                <g>
                  <rect x={x + 38} y={deviceY + 28} width={26} height={15} rx={7} fill="rgba(167,139,250,.14)" />
                  <text x={x + 51} y={deviceY + 39} textAnchor="middle" fill="var(--violet)" fontSize="8" fontWeight="700">
                    {node.count}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {nodes.length === 0 ? (
          <text x={centerX} y={220} textAnchor="middle" fill="var(--text-subtle)" fontSize="10">
            Keine abhängigen Geräte im aktuellen Snapshot.
          </text>
        ) : null}
        {hiddenDevices > 0 ? (
          <text x={centerX} y={315} textAnchor="middle" fill="var(--text-subtle)" fontSize="9">
            + {hiddenDevices} weitere Geräte
          </text>
        ) : null}
      </svg>
      <div className="causal-graph__legend">
        <span>
          <i className="legend-dot legend-dot--root" /> Root Cause
        </span>
        <span>
          <i className="legend-dot legend-dot--device" /> betroffenes Gerät
        </span>
        <span>
          <i className="legend-dot legend-dot--symptom" /> Symptom-Alarme
        </span>
      </div>
    </div>
  );
}
