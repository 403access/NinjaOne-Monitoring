import {
  Check,
  ClipboardPlus,
  ExternalLink,
  GitBranch,
  RotateCcw,
  Server,
  ShieldAlert,
  Waypoints,
} from "lucide-react";
import { useState } from "react";
import { CATEGORY_LABEL, PRIORITY_LABEL, SEVERITY_LABEL } from "../../../shared/constants";
import type { Priority } from "../../../shared/types";
import type { AlertView } from "../../context/AppContext";
import { cn } from "../../lib/cn";
import { confidenceLabel, formatDateTime, formatJson, formatRelative, shortUid } from "../../lib/format";
import { AlertRow } from "./AlertRow";
import { Drawer, ConfirmDialog } from "../ui/Overlay";
import { Badge, Button, EmptyState, PriorityBadge, Progress, SeverityBadge } from "../ui/Primitives";

export function AlertDrawer({
  view,
  related,
  onClose,
  onAck,
  onTask,
  onReset,
  onPriority,
  onOpenAlert,
  onOpenDevice,
  onOpenIncident,
}: {
  view: AlertView;
  related: AlertView[];
  onClose: () => void;
  onAck: () => void;
  onTask: () => void;
  onReset: () => void;
  onPriority: (priority: Priority | null) => void;
  onOpenAlert: (view: AlertView) => void;
  onOpenDevice: () => void;
  onOpenIncident: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { alert, device, suppression, incident } = view;
  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width="wide"
        title={alert.message}
        subtitle={`${alert.sourceName} · ${device?.displayName ?? `Gerät ${alert.deviceId}`}`}
        headerExtra={
          <div className="detail-header-badges">
            <PriorityBadge priority={view.priority} />
            <SeverityBadge severity={alert.severity} />
          </div>
        }
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
              Reset
            </Button>
            <Button variant="secondary" icon={ClipboardPlus} onClick={onTask}>
              Aufgabe
            </Button>
            <Button variant={alert.acknowledged ? "soft" : "primary"} icon={Check} onClick={onAck}>
              {alert.acknowledged ? "Bestätigung aufheben" : "Bestätigen"}
            </Button>
          </>
        }
      >
        <div className="detail-badges">
          <Badge tone={alert.acknowledged ? "success" : "neutral"} dot>
            {alert.acknowledged ? "Bestätigt" : "Offen"}
          </Badge>
          <Badge tone="neutral">{CATEGORY_LABEL[alert.category]}</Badge>
          {alert.flapping ? <Badge tone="warning">Flapping</Badge> : null}
          {suppression ? <Badge tone="violet">Symptom · {suppression.ruleName}</Badge> : null}
          {incident?.rootCauseAlertUid === alert.uid ? <Badge tone="danger">Ursache</Badge> : null}
          {view.overridden ? <Badge tone="warning">Priorität manuell</Badge> : null}
        </div>

        <div className="detail-grid">
          <div>
            <span>Gerät</span>
            <strong>{device?.displayName ?? `Gerät ${alert.deviceId}`}</strong>
            <small>{device?.nodeClass ?? "Unbekannt"}</small>
          </div>
          <div>
            <span>Organisation</span>
            <strong>{device?.organizationName ?? "—"}</strong>
            <small>{device?.locationName ?? "—"}</small>
          </div>
          <div>
            <span>Quelle</span>
            <strong>{alert.sourceName}</strong>
            <small>{alert.sourceType}</small>
          </div>
          <div>
            <span>Erstellt</span>
            <strong>{formatRelative(alert.createdAt)}</strong>
            <small>{formatDateTime(alert.createdAt)}</small>
          </div>
          <div>
            <span>NinjaOne Priority</span>
            <strong>{alert.ninjaPriority}</strong>
            <small>Severity {SEVERITY_LABEL[alert.severity]}</small>
          </div>
          <div>
            <span>UID</span>
            <strong className="mono">{shortUid(alert.uid, 12)}</strong>
            <small>Activity-Series-UID</small>
          </div>
        </div>

        <section className="detail-section">
          <div className="detail-section__header">
            <h3>Prioritätsentscheidung</h3>
            <Badge tone="neutral">{PRIORITY_LABEL[view.priority]}</Badge>
          </div>
          <div className="priority-reasons">
            {view.reasons.map((reason) => (
              <div className="priority-reason" key={reason}>
                <ShieldAlert size={13} aria-hidden />
                <span>{reason}</span>
              </div>
            ))}
          </div>
          <div className="priority-override">
            <span>Manueller Override</span>
            <select
              value={alert.priorityOverride ?? ""}
              onChange={(event) => onPriority((event.target.value as Priority) || null)}
              aria-label="Priorität manuell überschreiben"
            >
              <option value="">Automatisch ({view.priority})</option>
              <option value="P1">P1 · Kritisch</option>
              <option value="P2">P2 · Hoch</option>
              <option value="P3">P3 · Normal</option>
              <option value="P4">P4 · Beobachten</option>
            </select>
          </div>
        </section>

        {suppression ? (
          <section className="detail-section">
            <div className="suppression-box">
              <div className="suppression-box__header">
                <GitBranch size={16} aria-hidden />
                <div>
                  <strong>Als Symptom unterdrückt</strong>
                  <span>
                    {suppression.ruleName} · Konfidenz {confidenceLabel(suppression.confidence)}
                  </span>
                </div>
                <Progress value={suppression.confidence * 100} tone="violet" />
              </div>
              <p>{suppression.explanation}</p>
              <div className="evidence-list">
                {suppression.evidence.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              {incident ? (
                <Button size="sm" variant="soft" icon={Waypoints} onClick={onOpenIncident}>
                  Ursache öffnen: {incident.title}
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {incident ? (
          <section className="detail-section">
            <div className="incident-box">
              <div className="incident-box__icon">
                <Waypoints size={17} aria-hidden />
              </div>
              <div className="incident-box__text">
                <span>Teil von Incident</span>
                <strong>{incident.title}</strong>
                <small>
                  {incident.alertUids.length} Alarme · {incident.suppressedAlertUids.length} Symptome · Konfidenz{" "}
                  {confidenceLabel(incident.confidence)}
                </small>
              </div>
              <Button size="sm" variant="ghost" icon={ExternalLink} onClick={onOpenIncident}>
                Details
              </Button>
            </div>
          </section>
        ) : null}

        <section className="detail-section">
          <div className="detail-section__header">
            <h3>Gerät</h3>
            <Button size="sm" variant="ghost" icon={Server} onClick={onOpenDevice}>
              Gerät öffnen
            </Button>
          </div>
          {device ? (
            <div className="device-summary">
              <div>
                <span>Status</span>
                <strong className={cn(device.offline ? "text-danger" : "text-success")}>
                  {device.offline ? "Offline" : "Online"}
                </strong>
                <small>Letzter Kontakt {formatRelative(device.lastContact)}</small>
              </div>
              <div>
                <span>System</span>
                <strong>{device.os}</strong>
                <small>{device.role}</small>
              </div>
              <div>
                <span>Netz</span>
                <strong className="mono">{device.ip ?? "—"}</strong>
                <small>{device.publicIp ? `Public ${device.publicIp}` : "Keine Public IP"}</small>
              </div>
              <div>
                <span>Policy</span>
                <strong>{device.policyName ?? "—"}</strong>
                <small>{device.tags.join(" · ") || "Keine Tags"}</small>
              </div>
            </div>
          ) : (
            <EmptyState compact title="Gerät nicht im Snapshot" description="Der Alarm verweist auf ein Gerät, das nicht geladen wurde." />
          )}
        </section>

        <section className="detail-section">
          <div className="detail-section__header">
            <h3>Zusammenhängende Alarme</h3>
            <Badge tone="neutral">{related.length}</Badge>
          </div>
          {related.length === 0 ? (
            <EmptyState compact title="Keine weiteren Alarme" description="Dieser Alarm steht aktuell allein." />
          ) : (
            <div className="alert-list detail-alert-list">
              {related.slice(0, 6).map((entry) => (
                <AlertRow key={entry.alert.uid} view={entry} compact onOpen={onOpenAlert} />
              ))}
            </div>
          )}
        </section>

        <section className="detail-section">
          <h3>Rohdaten</h3>
          <pre className="raw-json">{formatJson(alert.data)}</pre>
        </section>
      </Drawer>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={onReset}
        title="Alarm zurücksetzen?"
        description="Im Live-Modus wird der Alarm in NinjaOne geschlossen. Im Demo-Modus wird er lokal als bestätigt markiert."
        confirmLabel="Zurücksetzen"
      />
    </>
  );
}
