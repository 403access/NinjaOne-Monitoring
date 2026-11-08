import {
  ArrowUpRight,
  CloudOff,
  GitBranch,
  MonitorOff,
  Network,
  RadioTower,
  ServerCrash,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { cn } from "../../lib/cn";
import { confidenceLabel } from "../../lib/format";
import { incidentKindLabel } from "../../../shared/causality";
import type { Incident } from "../../../shared/types";
import { Badge, Button, PriorityBadge, Progress } from "../ui/Primitives";

const KIND_ICON: Record<string, LucideIcon> = {
  wan: CloudOff,
  switch: Network,
  network: Network,
  host: ServerCrash,
  agent: MonitorOff,
  maintenance: Wrench,
  external: RadioTower,
  standalone: GitBranch,
};

const KIND_TONE = {
  wan: "danger",
  switch: "violet",
  network: "violet",
  host: "warning",
  agent: "info",
  maintenance: "neutral",
  external: "warning",
  standalone: "neutral",
} as const;

export function IncidentCard({
  incident,
  onOpen,
  onCreateTask,
  compact = false,
}: {
  incident: Incident;
  onOpen?: (incident: Incident) => void;
  onCreateTask?: (incident: Incident) => void;
  compact?: boolean;
}) {
  const { deviceMap } = useApp();
  const Icon = KIND_ICON[incident.kind] ?? GitBranch;
  const rootDevice = incident.rootCauseDeviceId ? deviceMap.get(incident.rootCauseDeviceId) : undefined;
  const devices = [...new Set(incident.deviceIds)].map((id) => deviceMap.get(id)).filter((device) => Boolean(device));
  const tone = KIND_TONE[incident.kind] ?? "neutral";

  return (
    <article className={cn("incident-card", compact && "incident-card--compact", `incident-card--${tone}`)}>
      <header className="incident-card__header">
        <span className={cn("incident-card__icon", `incident-card__icon--${tone}`)}>
          <Icon size={19} aria-hidden />
        </span>
        <div className="incident-card__heading">
          <div className="incident-card__eyebrow">
            <span>{incidentKindLabel(incident.kind)}</span>
            <span className="dot-sep">·</span>
            <span>{incident.locationName ?? "Mehrere Standorte"}</span>
          </div>
          <h3>{incident.title}</h3>
        </div>
        <PriorityBadge priority={incident.priority} compact />
      </header>

      <p className="incident-card__summary">{incident.summary}</p>

      <div className="incident-card__metrics">
        <span>
          <strong>{incident.alertUids.length}</strong> Alarme
        </span>
        <span>
          <strong>{incident.suppressedAlertUids.length}</strong> Symptome
        </span>
        <span>
          <strong>{devices.length}</strong> Geräte
        </span>
        <span className="incident-card__confidence">
          <Progress value={incident.confidence * 100} tone={incident.confidence >= 0.9 ? "success" : "warning"} />
          <strong>{confidenceLabel(incident.confidence)}</strong>
        </span>
      </div>

      {!compact ? (
        <>
          <div className="incident-card__evidence">
            {incident.evidence.slice(0, 3).map((item) => (
              <span key={item} className="evidence-chip">
                {item}
              </span>
            ))}
          </div>
          <div className="incident-card__recommendation">
            <GitBranch size={15} aria-hidden />
            <p>{incident.recommendation}</p>
          </div>
        </>
      ) : null}

      <footer className="incident-card__footer">
        <div className="incident-card__devices">
          {devices.slice(0, 2).map((device) => (
            <span key={device!.id} className="device-chip">
              {device!.displayName}
            </span>
          ))}
          {devices.length > 2 ? <span className="device-chip">+{devices.length - 2}</span> : null}
          {rootDevice ? (
            <span className="incident-card__root">
              Root: <strong>{rootDevice.displayName}</strong>
            </span>
          ) : null}
        </div>
        <div className="incident-card__actions">
          {onCreateTask ? (
            <Button size="sm" variant="soft" onClick={() => onCreateTask(incident)}>
              Aufgabe
            </Button>
          ) : null}
          {onOpen ? (
            <Button size="sm" variant="ghost" icon={ArrowUpRight} onClick={() => onOpen(incident)}>
              Details
            </Button>
          ) : null}
        </div>
      </footer>

      {incident.kind === "wan" ? <Badge tone="danger" className="incident-card__flag">NinjaOne-Blindspot ausgeglichen</Badge> : null}
    </article>
  );
}
