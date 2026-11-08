import { Check, ChevronRight, ClipboardPlus, GitBranch, MapPin, Server } from "lucide-react";
import type { AlertView } from "../../context/AppContext";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/format";
import { Badge, IconButton, PriorityBadge, SeverityBadge } from "../ui/Primitives";

export function AlertRow({
  view,
  selected,
  onToggle,
  onOpen,
  onAck,
  onTask,
  compact = false,
  showCheckbox = false,
}: {
  view: AlertView;
  selected?: boolean;
  onToggle?: (uid: string) => void;
  onOpen?: (view: AlertView) => void;
  onAck?: (view: AlertView) => void;
  onTask?: (view: AlertView) => void;
  compact?: boolean;
  showCheckbox?: boolean;
}) {
  const { alert, device, suppression, incident } = view;
  const isRoot = incident?.rootCauseAlertUid === alert.uid;
  return (
    <div
      className={cn(
        "alert-row",
        compact && "alert-row--compact",
        selected && "is-selected",
        suppression && "is-suppressed",
      )}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(view)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(view);
        }
      }}
    >
      {showCheckbox ? (
        <input
          type="checkbox"
          className="alert-row__check"
          checked={Boolean(selected)}
          onChange={() => onToggle?.(alert.uid)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Alarm ${alert.message} auswählen`}
        />
      ) : null}

      <div className="alert-row__priority">
        <PriorityBadge priority={view.priority} compact />
      </div>

      <div className="alert-row__main">
        <div className="alert-row__title-line">
          <span className="alert-row__title">{alert.message}</span>
          {isRoot ? (
            <Badge tone="danger" dot>
              Ursache
            </Badge>
          ) : null}
          {suppression ? (
            <Badge tone="violet" dot>
              Symptom
            </Badge>
          ) : null}
          {alert.acknowledged ? <Badge tone="success">Bestätigt</Badge> : null}
          {alert.flapping ? <Badge tone="warning">Flapping</Badge> : null}
        </div>
        <div className="alert-row__meta">
          <span className="alert-row__meta-item">
            <Server size={12} aria-hidden />
            {device?.displayName ?? `Gerät ${alert.deviceId}`}
          </span>
          <span className="alert-row__meta-item">
            <MapPin size={12} aria-hidden />
            {device?.locationName ?? "—"}
          </span>
          <span className="alert-row__meta-item alert-row__source">{alert.sourceName}</span>
          {suppression ? (
            <span className="alert-row__meta-item alert-row__suppression" title={suppression.explanation}>
              <GitBranch size={12} aria-hidden />
              {suppression.ruleName}
            </span>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <div className="alert-row__severity">
          <SeverityBadge severity={alert.severity} />
        </div>
      ) : null}

      <div className="alert-row__time" title={new Date(alert.createdAt).toLocaleString("de-DE")}>
        {formatRelative(alert.createdAt)}
      </div>

      <div className="alert-row__actions">
        {onAck ? (
          <IconButton
            icon={Check}
            label={alert.acknowledged ? "Bestätigung aufheben" : "Alarm bestätigen"}
            onClick={(event) => {
              event.stopPropagation();
              onAck(view);
            }}
          />
        ) : null}
        {onTask ? (
          <IconButton
            icon={ClipboardPlus}
            label="Aufgabe aus Alarm erstellen"
            onClick={(event) => {
              event.stopPropagation();
              onTask(view);
            }}
          />
        ) : null}
        <ChevronRight size={16} className="alert-row__chevron" aria-hidden />
      </div>
    </div>
  );
}
