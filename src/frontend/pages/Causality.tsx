import {
  Activity,
  CheckCircle2,
  CloudOff,
  GitBranch,
  Network,
  Plus,
  RadioTower,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Waypoints,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { incidentKindLabel } from "../../shared/causality";
import { SIGNAL_TYPE_LABEL } from "../../shared/constants";
import type { CausalityRuleConfig, ExternalSignal, Incident, SignalType } from "../../shared/types";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/cn";
import { confidenceLabel, formatRelative } from "../lib/format";
import { matchesQuery } from "../lib/filters";
import { PageHeader } from "../components/PageHeader";
import { CausalGraph } from "../components/causality/CausalGraph";
import { SignalModal } from "../components/causality/SignalModal";
import { IncidentCard } from "../components/incidents/IncidentCard";
import { ConfirmDialog } from "../components/ui/Overlay";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  PriorityBadge,
  Progress,
  SearchInput,
  Select,
  Toggle,
} from "../components/ui/Primitives";

type Tab = "incidents" | "suppressed" | "rules";

const RULE_META: Record<string, { name: string; description: string }> = {
  maintenance: {
    name: "Wartungsfenster",
    description: "Geräte in Maintenance werden als geplant behandelt. Sicherheitsalarme bleiben sichtbar.",
  },
  "wan-outage": {
    name: "WAN-/Internet-Ausfall",
    description: "Ein ISP- oder WAN-Signal erklärt internetabhängige Checks und isolierte Standorte.",
  },
  "switch-down": {
    name: "Switch-Ausfall",
    description: "Ein offline Switch erklärt Downstream-Geräte und deren Agent-/Netzwerk-Alarme.",
  },
  "network-path": {
    name: "Netzwerkpfad",
    description: "Ein Router oder Firewall-Ausfall erklärt Alarme im selben Netzwerkpfad.",
  },
  "parent-offline": {
    name: "Elternsystem offline",
    description: "VMs und abhängige Geräte werden als Symptom behandelt, wenn der Host offline ist.",
  },
  "agent-offline": {
    name: "Agent offline",
    description: "Veraltete CPU-, Disk-, Service- und Event-Alarme eines offline Geräts werden unterdrückt.",
  },
  "external-signal": {
    name: "Externes Signal",
    description: "Manuelle Signale für Strom, Switch-Wartung oder sonstige NinjaOne-Blindspots.",
  },
  flapping: {
    name: "Flapping",
    description: "Häufige Trigger/Resets werden markiert und in der Priorität herabgestuft, nicht unterdrückt.",
  },
};

const SIGNAL_ICON: Record<SignalType, LucideIcon> = {
  ISP: CloudOff,
  POWER: Zap,
  SWITCH: Network,
  MAINTENANCE: Wrench,
  OTHER: RadioTower,
};

const SIGNAL_TONE: Record<SignalType, "danger" | "warning" | "violet" | "info" | "neutral"> = {
  ISP: "danger",
  POWER: "warning",
  SWITCH: "violet",
  MAINTENANCE: "info",
  OTHER: "neutral",
};

function SignalCard({
  signal,
  onResolve,
  onDelete,
}: {
  signal: ExternalSignal;
  onResolve: () => void;
  onDelete: () => void;
}) {
  const Icon = SIGNAL_ICON[signal.type];
  return (
    <article className={cn("signal-card", `signal-card--${SIGNAL_TONE[signal.type]}`)}>
      <div className="signal-card__icon">
        <Icon size={18} aria-hidden />
      </div>
      <div className="signal-card__body">
        <div className="signal-card__title-line">
          <strong>{signal.title}</strong>
          <Badge tone={SIGNAL_TONE[signal.type]} dot>
            {SIGNAL_TYPE_LABEL[signal.type]}
          </Badge>
          {signal.status === "resolved" ? <Badge tone="neutral">beendet</Badge> : null}
        </div>
        <div className="signal-card__meta">
          <span>{signal.scope.label}</span>
          <span className="dot-sep">·</span>
          <span>seit {formatRelative(signal.startsAt)}</span>
          {signal.notes ? (
            <>
              <span className="dot-sep">·</span>
              <span className="signal-card__notes">{signal.notes}</span>
            </>
          ) : null}
        </div>
        <div className="signal-card__effects">
          {signal.effects.suppressInternetChecks ? <span>Internet</span> : null}
          {signal.effects.suppressNetworkChecks ? <span>Netzwerk</span> : null}
          {signal.effects.suppressAgentAlerts ? <span>Agent</span> : null}
          {!signal.effects.suppressInternetChecks && !signal.effects.suppressNetworkChecks && !signal.effects.suppressAgentAlerts ? (
            <span>nur Dokumentation</span>
          ) : null}
        </div>
      </div>
      <div className="signal-card__actions">
        {signal.status === "active" ? (
          <Button size="sm" variant="soft" icon={CheckCircle2} onClick={onResolve}>
            Beenden
          </Button>
        ) : null}
        <button type="button" className="icon-btn" aria-label={`Signal ${signal.title} löschen`} onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

function IncidentDetail({
  incident,
  onTask,
  onShowAlerts,
  onOpenAlert,
}: {
  incident: Incident;
  onTask: () => void;
  onShowAlerts: () => void;
  onOpenAlert: (uid: string) => void;
}) {
  const { devices, alerts, signals, alertViews } = useApp();
  const suppressed = alertViews.filter((view) => incident.suppressedAlertUids.includes(view.alert.uid));
  const rootDevice = incident.rootCauseDeviceId ? devices.find((device) => device.id === incident.rootCauseDeviceId) : undefined;
  const signal = incident.externalSignalId ? signals.find((entry) => entry.id === incident.externalSignalId) : undefined;
  return (
    <Panel className="incident-detail">
      <div className="incident-detail__header">
        <div>
          <div className="incident-detail__eyebrow">
            <Waypoints size={13} aria-hidden />
            {incidentKindLabel(incident.kind)}
            <span className="dot-sep">·</span>
            {incident.locationName ?? "Mehrere Standorte"}
          </div>
          <h2>{incident.title}</h2>
          <p>{incident.summary}</p>
        </div>
        <div className="incident-detail__badges">
          <PriorityBadge priority={incident.priority} />
          <Badge tone="violet">{confidenceLabel(incident.confidence)} Konfidenz</Badge>
        </div>
      </div>

      <CausalGraph incident={incident} devices={devices} alerts={alerts} signals={signals} />

      <div className="incident-detail__metrics">
        <div>
          <span>Impact</span>
          <strong>{incident.alertUids.length} Alarme</strong>
          <small>{incident.deviceIds.length} Geräte</small>
        </div>
        <div>
          <span>Symptome</span>
          <strong>{incident.suppressedAlertUids.length}</strong>
          <small>durch Regel erklärt</small>
        </div>
        <div>
          <span>Root Cause</span>
          <strong>{signal ? signal.type : rootDevice?.displayName ?? "Extern"}</strong>
          <small>{signal ? signal.scope.label : rootDevice?.nodeClass ?? "Signal"}</small>
        </div>
        <div>
          <span>Erkannt</span>
          <strong>{formatRelative(incident.detectedAt)}</strong>
          <small>{new Date(incident.detectedAt).toLocaleString("de-DE")}</small>
        </div>
      </div>

      <div className="incident-detail__recommendation">
        <ShieldAlert size={16} aria-hidden />
        <div>
          <strong>Empfohlene Aktion</strong>
          <p>{incident.recommendation}</p>
        </div>
      </div>

      <section className="detail-section">
        <div className="detail-section__header">
          <h3>Evidenz</h3>
          <Badge tone="neutral">{incident.evidence.length}</Badge>
        </div>
        <div className="incident-detail__evidence">
          {incident.evidence.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <div className="detail-section__header">
          <h3>Unterdrückte Symptome</h3>
          <Badge tone="violet">{suppressed.length}</Badge>
        </div>
        {suppressed.length === 0 ? (
          <EmptyState compact icon={CheckCircle2} title="Keine Symptome" description="Alle Alarme dieses Incidents sind eigenständig." />
        ) : (
          <div className="symptom-list">
            {suppressed.slice(0, 8).map((view) => (
              <button
                type="button"
                key={view.alert.uid}
                className="symptom-row"
                onClick={() => onOpenAlert(view.alert.uid)}
              >
                <PriorityBadge priority={view.priority} compact />
                <span className="symptom-row__message">{view.alert.message}</span>
                <span className="symptom-row__device">{view.device?.displayName ?? view.alert.deviceId}</span>
                <span className="symptom-row__rule">{view.suppression?.ruleName ?? "Symptom"}</span>
                <span className="symptom-row__confidence">{confidenceLabel(view.suppression?.confidence ?? incident.confidence)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="incident-detail__actions">
        <Button variant="ghost" icon={Activity} onClick={onShowAlerts}>
          Alarme anzeigen
        </Button>
        <Button variant="primary" icon={Plus} onClick={onTask}>
          Aufgabe erstellen
        </Button>
      </div>
    </Panel>
  );
}

export function Causality() {
  const {
    incidents,
    causality,
    alertViews,
    signals,
    activeSignals,
    organizations,
    locations,
    devices,
    settings,
    updateSettings,
    createSignal,
    resolveSignal,
    deleteSignal,
    bulkCreateTasks,
    causalityRules,
    saveCausalityRules,
  } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || "incidents");
  const [suppressionQuery, setSuppressionQuery] = useState("");
  const [suppressionRule, setSuppressionRule] = useState("");
  const [suppressionSort, setSuppressionSort] = useState("confidence");
  const [signalToDelete, setSignalToDelete] = useState<ExternalSignal | null>(null);
  const [ruleSaving, setRuleSaving] = useState(false);

  const selectedId = searchParams.get("incident");
  const selected = incidents.find((incident) => incident.id === selectedId) ?? incidents[0];
  const signalModalOpen = searchParams.get("signal") === "1";
  const resolvedSignals = signals.filter((signal) => signal.status === "resolved");

  const suppressionRows = useMemo(
    () =>
      Object.values(causality.suppressions)
        .map((suppression) => {
          const view = alertViews.find((entry) => entry.alert.uid === suppression.alertUid);
          const incident = view?.incident ?? incidents.find((entry) => entry.suppressedAlertUids.includes(suppression.alertUid));
          return view ? { view, suppression, incident } : undefined;
        })
        .filter((entry): entry is { view: (typeof alertViews)[number]; suppression: (typeof causality.suppressions)[string]; incident: Incident | undefined } => Boolean(entry))
        .filter(
          (entry) =>
            (!suppressionRule || entry.suppression.ruleId === suppressionRule) &&
            matchesQuery(
              suppressionQuery,
              entry.view.alert.message,
              entry.view.alert.sourceName,
              entry.view.device?.displayName,
              entry.view.device?.organizationName,
              entry.suppression.explanation,
              entry.suppression.ruleName,
            ),
        )
        .sort((a, b) => {
          if (suppressionSort === "age") return b.view.alert.createdAt - a.view.alert.createdAt;
          if (suppressionSort === "device") return (a.view.device?.displayName ?? "").localeCompare(b.view.device?.displayName ?? "", "de");
          return b.suppression.confidence - a.suppression.confidence;
        }),
    [causality.suppressions, alertViews, incidents, suppressionRule, suppressionQuery, suppressionSort],
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const setTabAndParam = (next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "incidents") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const updateRule = async (id: string, patch: Partial<CausalityRuleConfig>) => {
    setRuleSaving(true);
    await saveCausalityRules(causalityRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
    setRuleSaving(false);
  };

  const openSignalModal = () => setParam("signal", "1");
  const closeSignalModal = () => setParam("signal", null);

  return (
    <div className="page causality-page">
      <PageHeader
        eyebrow={
          <span className="eyebrow-status">
            <GitBranch size={13} aria-hidden />
            {incidents.length} Ursachen · {causality.stats.suppressedAlerts} Symptome · {causality.stats.affectedDevices} Geräte
          </span>
        }
        title="Kausalität"
        description="Welche Alarme sind Ursache, welche sind nur Folge? Signal gruppiert Symptome, erklärt jede Unterdrückung und macht NinjaOne-Blindspots sichtbar."
        actions={
          <>
            <Button variant="ghost" icon={SlidersHorizontal} onClick={() => setTabAndParam("rules")}>
              Regeln
            </Button>
            <Button variant="primary" icon={RadioTower} onClick={openSignalModal}>
              Signal melden
            </Button>
          </>
        }
      />

      <div className="causality-stats">
        <div className="causality-stat">
          <span className="causality-stat__icon causality-stat__icon--danger">
            <Waypoints size={18} />
          </span>
          <div>
            <strong>{incidents.length}</strong>
            <span>Root Causes</span>
          </div>
        </div>
        <div className="causality-stat">
          <span className="causality-stat__icon causality-stat__icon--violet">
            <GitBranch size={18} />
          </span>
          <div>
            <strong>{causality.stats.suppressedAlerts}</strong>
            <span>Symptome erklärt</span>
          </div>
        </div>
        <div className="causality-stat">
          <span className="causality-stat__icon causality-stat__icon--warning">
            <Activity size={18} />
          </span>
          <div>
            <strong>{causality.stats.affectedDevices}</strong>
            <span>betroffene Geräte</span>
          </div>
        </div>
        <div className="causality-stat">
          <span className="causality-stat__icon causality-stat__icon--info">
            <Network size={18} />
          </span>
          <div>
            <strong>{causality.stats.affectedLocations}</strong>
            <span>Standorte</span>
          </div>
        </div>
        <div className="causality-stat causality-stat--confidence">
          <div>
            <strong>{Math.round((1 - causality.stats.suppressedAlerts / Math.max(1, causality.stats.totalAlerts)) * 100)} %</strong>
            <span>Signal-Reduktion</span>
          </div>
          <Progress
            value={(1 - causality.stats.suppressedAlerts / Math.max(1, causality.stats.totalAlerts)) * 100}
            tone="violet"
          />
        </div>
      </div>

      <section className="signal-section">
        <div className="signal-section__header">
          <div>
            <h2>
              <RadioTower size={15} aria-hidden /> Externe Signale
            </h2>
            <p>Für Störungen, die NinjaOne nicht sehen kann – ISP, Strom, Switch-Wartung.</p>
          </div>
          <Button size="sm" variant="soft" icon={Plus} onClick={openSignalModal}>
            Signal melden
          </Button>
        </div>
        {activeSignals.length === 0 ? (
          <div className="signal-empty">
            <CloudOff size={18} aria-hidden />
            <span>Keine aktiven externen Signale. Die Kausalität basiert ausschließlich auf NinjaOne-Daten.</span>
            <Button size="sm" variant="ghost" onClick={openSignalModal}>
              ISP-Ausfall melden
            </Button>
          </div>
        ) : (
          <div className="signal-list">
            {activeSignals.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onResolve={() => void resolveSignal(signal.id)}
                onDelete={() => setSignalToDelete(signal)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="causality-tabs">
        <button type="button" className={cn("causality-tab", tab === "incidents" && "is-active")} onClick={() => setTabAndParam("incidents")}>
          <Waypoints size={15} /> Ursachen <span>{incidents.length}</span>
        </button>
        <button type="button" className={cn("causality-tab", tab === "suppressed" && "is-active")} onClick={() => setTabAndParam("suppressed")}>
          <GitBranch size={15} /> Symptome <span>{causality.stats.suppressedAlerts}</span>
        </button>
        <button type="button" className={cn("causality-tab", tab === "rules" && "is-active")} onClick={() => setTabAndParam("rules")}>
          <SlidersHorizontal size={15} /> Regeln <span>{causalityRules.filter((rule) => rule.enabled).length}</span>
        </button>
      </div>

      {tab === "incidents" ? (
        <div className="causality-layout">
          <div className="causality-list">
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onOpen={(entry) => setParam("incident", entry.id)}
                onCreateTask={(entry) =>
                  void bulkCreateTasks({
                    alertIds: entry.alertUids,
                    grouped: true,
                    incidentId: entry.id,
                    title: entry.suggestedTaskTitle,
                    priority: entry.suggestedTaskPriority,
                  })
                }
              />
            ))}
            {incidents.length === 0 ? (
              <Panel>
                <EmptyState
                  icon={CheckCircle2}
                  title="Keine Ursachen erkannt"
                  description="Aktuell gibt es keine offensichtlichen Root Causes. Prüfe die Alarme oder melde ein externes Signal."
                />
              </Panel>
            ) : null}
          </div>
          <div className="causality-detail-wrap">
            {selected ? (
              <IncidentDetail
                incident={selected}
                onTask={() =>
                  void bulkCreateTasks({
                    alertIds: selected.alertUids,
                    grouped: true,
                    incidentId: selected.id,
                    title: selected.suggestedTaskTitle,
                    priority: selected.suggestedTaskPriority,
                  })
                }
                onShowAlerts={() => navigate(`/alerts?incident=${encodeURIComponent(selected.id)}`)}
                onOpenAlert={(uid) => navigate(`/alerts?alert=${encodeURIComponent(uid)}`)}
              />
            ) : (
              <Panel>
                <EmptyState icon={Waypoints} title="Incident auswählen" description="Wähle links eine Ursache, um Impact, Graph und Evidenz zu sehen." />
              </Panel>
            )}
          </div>
        </div>
      ) : tab === "suppressed" ? (
        <Panel>
          <PanelHeader
            title="Suppression-Explorer"
            subtitle="Jeder ausgeblendete Alarm mit Regel, Ursache und Konfidenz"
            icon={GitBranch}
            action={<Badge tone="violet">{suppressionRows.length} Symptome</Badge>}
          />
          <div className="toolbar toolbar--inline">
            <div className="toolbar__row">
              <SearchInput
                className="toolbar__search"
                value={suppressionQuery}
                onChange={(event) => setSuppressionQuery(event.target.value)}
                placeholder="Symptom, Gerät, Regel oder Erklärung suchen …"
              />
              <Select value={suppressionRule} onChange={(event) => setSuppressionRule(event.target.value)} aria-label="Regel">
                <option value="">Alle Regeln</option>
                {Object.keys(causality.stats.byRule).map((ruleId) => (
                  <option key={ruleId} value={ruleId}>
                    {RULE_META[ruleId]?.name ?? ruleId}
                  </option>
                ))}
              </Select>
              <Select value={suppressionSort} onChange={(event) => setSuppressionSort(event.target.value)} aria-label="Sortierung">
                <option value="confidence">Konfidenz</option>
                <option value="age">Neueste</option>
                <option value="device">Gerät</option>
              </Select>
            </div>
          </div>
          {suppressionRows.length === 0 ? (
            <EmptyState icon={Search} title="Keine Symptome gefunden" description="Passe Suche oder Regel-Filter an." />
          ) : (
            <div className="table-wrap">
              <table className="data-table suppression-table">
                <thead>
                  <tr>
                    <th>Alarm</th>
                    <th>Gerät</th>
                    <th>Regel</th>
                    <th>Ursache</th>
                    <th>Konfidenz</th>
                    <th>Erklärung</th>
                  </tr>
                </thead>
                <tbody>
                  {suppressionRows.map(({ view, suppression, incident }) => (
                    <tr key={view.alert.uid} onClick={() => navigate(`/alerts?alert=${encodeURIComponent(view.alert.uid)}`)}>
                      <td>
                        <div className="cell-main">
                          <strong>{view.alert.message}</strong>
                          <span>
                            {view.priority} · {view.alert.sourceName}
                          </span>
                        </div>
                      </td>
                      <td>{view.device?.displayName ?? view.alert.deviceId}</td>
                      <td>
                        <Badge tone="violet">{suppression.ruleName}</Badge>
                      </td>
                      <td>{incident?.title ?? "—"}</td>
                      <td>
                        <div className="confidence-cell">
                          <Progress value={suppression.confidence * 100} tone="violet" />
                          <span>{confidenceLabel(suppression.confidence)}</span>
                        </div>
                      </td>
                      <td className="suppression-table__explanation">{suppression.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <div className="rules-layout">
          <Panel>
            <PanelHeader
              title="Kausalitätsregeln"
              subtitle="Welche Muster dürfen Symptome erklären?"
              icon={SlidersHorizontal}
              action={<Badge tone={ruleSaving ? "warning" : "success"}>{ruleSaving ? "Speichert …" : "Aktiv"}</Badge>}
            />
            <div className="rules-intro">
              <div>
                <strong>So arbeitet die Engine</strong>
                <p>
                  1. Root Causes bestimmen → 2. Symptome mit der stärksten passenden Regel unterdrücken → 3. Incidents,
                  Evidenz und Aufgaben ableiten. Sicherheitsalarme werden nie unterdrückt.
                </p>
              </div>
              <div className="threshold-control">
                <div>
                  <span>Unterdrückungsschwelle</span>
                  <strong>{Math.round(settings.suppressionThreshold * 100)} %</strong>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  value={settings.suppressionThreshold}
                  onChange={(event) => void updateSettings({ suppressionThreshold: Number(event.target.value) })}
                  aria-label="Unterdrückungsschwelle"
                />
                <small>Regeln unterhalb dieser Konfidenz unterdrücken nicht.</small>
              </div>
            </div>
            <div className="rule-list">
              {causalityRules.map((rule) => {
                const meta = RULE_META[rule.id] ?? { name: rule.id, description: "Kausalitätsregel" };
                const count = causality.stats.byRule[rule.id] ?? 0;
                return (
                  <div className={cn("rule-row", !rule.enabled && "is-disabled")} key={rule.id}>
                    <div className="rule-row__main">
                      <div className="rule-row__title">
                        <strong>{meta.name}</strong>
                        <Badge tone={rule.enabled ? "success" : "neutral"} dot>
                          {rule.enabled ? "aktiv" : "aus"}
                        </Badge>
                        {count > 0 ? <Badge tone="violet">{count} Symptome</Badge> : null}
                      </div>
                      <p>{meta.description}</p>
                    </div>
                    <div className="rule-row__controls">
                      <label>
                        <span>Konfidenz</span>
                        <select
                          value={rule.confidence}
                          onChange={(event) => void updateRule(rule.id, { confidence: Number(event.target.value) })}
                          disabled={!rule.enabled}
                        >
                          {[0.7, 0.75, 0.8, 0.85, 0.9, 0.94, 0.96, 0.98, 0.99].map((value) => (
                            <option key={value} value={value}>
                              {Math.round(value * 100)} %
                            </option>
                          ))}
                        </select>
                      </label>
                      <Toggle checked={rule.enabled} onChange={(next) => void updateRule(rule.id, { enabled: next })} label={`${meta.name} aktivieren`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Signal-Historie" subtitle="Externe Signale und ihre Wirkung" icon={RadioTower} />
            <div className="signal-history">
              {signals.length === 0 ? (
                <EmptyState compact icon={RadioTower} title="Keine Signale" description="Melde einen ISP- oder Switch-Ausfall, um die Kausalität zu verbessern." />
              ) : (
                signals.map((signal) => (
                  <div className="signal-history__row" key={signal.id}>
                    <span className={cn("signal-history__dot", signal.status === "active" ? "is-active" : "is-resolved")} />
                    <div>
                      <strong>{signal.title}</strong>
                      <span>
                        {SIGNAL_TYPE_LABEL[signal.type]} · {signal.scope.label} · {formatRelative(signal.startsAt)}
                      </span>
                    </div>
                    <Badge tone={signal.status === "active" ? "danger" : "neutral"}>{signal.status === "active" ? "aktiv" : "beendet"}</Badge>
                  </div>
                ))
              )}
            </div>
            <div className="info-box rules-note">
              <ShieldAlert size={16} aria-hidden />
              <div>
                <strong>Grenzen der Public API</strong>
                <p>
                  Switch-Port-Topologie und Policy-Rohkonfiguration sind nicht Teil der offiziellen API. Signal nutzt
                  Parent-Beziehungen, Standort, Tags und externe Signale. Konfidenz und Evidenz machen diese Heuristik
                  transparent.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <SignalModal
        open={signalModalOpen}
        onClose={closeSignalModal}
        organizations={organizations}
        locations={locations}
        devices={devices}
        onSubmit={async (input) => {
          const signal = await createSignal(input);
          if (signal) {
            setTab("incidents");
            const next = new URLSearchParams(searchParams);
            next.delete("signal");
            next.delete("tab");
            next.set("incident", `signal:${signal.id}`);
            setSearchParams(next, { replace: true });
          }
          return signal;
        }}
      />

      <ConfirmDialog
        open={Boolean(signalToDelete)}
        onClose={() => setSignalToDelete(null)}
        onConfirm={() => {
          if (signalToDelete) void deleteSignal(signalToDelete.id);
          setSignalToDelete(null);
        }}
        title="Signal löschen?"
        description="Das Signal wird entfernt. Die Kausalität wird sofort neu berechnet; betroffene Alarme können wieder sichtbar werden."
        confirmLabel="Löschen"
      />
    </div>
  );
}
