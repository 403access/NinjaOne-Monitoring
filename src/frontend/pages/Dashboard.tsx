import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  MapPin,
  RadioTower,
  RefreshCw,
  ShieldAlert,
  Siren,
  TriangleAlert,
  Waypoints,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CATEGORY_LABEL } from "../../shared/constants";
import { sortScoredAlerts } from "../../shared/priority";
import type { Incident } from "../../shared/types";
import type { LucideIcon } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/cn";
import { formatNumber, formatPercent, formatRelative } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { AlertRow } from "../components/alerts/AlertRow";
import { BarList, MiniBars, Sparkline } from "../components/charts/Charts";
import { IncidentCard } from "../components/incidents/IncidentCard";
import { Badge, Button, EmptyState, Panel, PanelHeader, Progress } from "../components/ui/Primitives";

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  trend,
  footer,
  progress,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "danger" | "warning" | "violet" | "accent" | "success";
  trend?: number[];
  footer: string;
  progress?: { value: number; tone: "danger" | "warning" | "accent" | "success" };
  onClick?: () => void;
}) {
  return (
    <button type="button" className={cn("kpi-card", `kpi-card--${tone}`)} onClick={onClick}>
      <div className="kpi-card__top">
        <span className="kpi-card__icon">
          <Icon size={18} aria-hidden />
        </span>
        {trend ? <Sparkline data={trend} tone={tone === "violet" ? "violet" : tone} width={104} height={32} /> : null}
      </div>
      <div className="kpi-card__value">{value}</div>
      <div className="kpi-card__label">{label}</div>
      {progress ? <Progress value={progress.value} tone={progress.tone} className="kpi-card__progress" /> : null}
      <div className="kpi-card__footer">{footer}</div>
    </button>
  );
}

export function Dashboard() {
  const {
    payload,
    alertViews,
    incidents,
    tasks,
    openTasks,
    overdueTasks,
    priorityCounts,
    suppressedCount,
    causality,
    deviceMap,
    sync,
    syncing,
    bulkCreateTasks,
    ackAlert,
  } = useApp();
  const navigate = useNavigate();
  const now = Date.now();

  const attention = useMemo(
    () => [...alertViews].filter((view) => !view.suppression).sort(sortScoredAlerts).slice(0, 8),
    [alertViews],
  );

  const topIncidents = useMemo(
    () => [...incidents].sort((a, b) => b.alertUids.length - a.alertUids.length).slice(0, 4),
    [incidents],
  );

  const trend = useMemo(() => {
    const buckets = Array.from({ length: 12 }, () => 0);
    for (const view of alertViews) {
      const age = now - view.alert.createdAt;
      if (age < 0 || age > 12 * 3_600_000) continue;
      const index = 11 - Math.floor(age / 3_600_000);
      buckets[index] = (buckets[index] ?? 0) + 1;
    }
    return buckets;
  }, [alertViews, now]);

  const locationRows = useMemo(() => {
    const map = new Map<
      number,
      { id: number; name: string; organization: string; total: number; offline: number; alerts: number; p1: number }
    >();
    for (const device of payload?.snapshot.devices ?? []) {
      const row = map.get(device.locationId) ?? {
        id: device.locationId,
        name: device.locationName,
        organization: device.organizationName,
        total: 0,
        offline: 0,
        alerts: 0,
        p1: 0,
      };
      row.total += 1;
      if (device.offline) row.offline += 1;
      map.set(device.locationId, row);
    }
    for (const view of alertViews) {
      if (view.suppression) continue;
      const row = map.get(view.device?.locationId ?? 0);
      if (!row) continue;
      row.alerts += 1;
      if (view.priority === "P1") row.p1 += 1;
    }
    return [...map.values()].sort((a, b) => b.offline - a.offline || b.p1 - a.p1 || b.alerts - a.alerts).slice(0, 6);
  }, [payload, alertViews]);

  const categoryRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const view of alertViews) {
      if (view.suppression) continue;
      counts.set(view.alert.category, (counts.get(view.alert.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([category, value]) => ({
        label: CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL] ?? category,
        value,
        tone: category === "security" ? ("danger" as const) : category === "network" ? ("violet" as const) : ("accent" as const),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [alertViews]);

  const suppressedPercent = alertViews.length > 0 ? suppressedCount / alertViews.length : 0;
  const onlineDevices = payload?.snapshot.devices.filter((device) => !device.offline).length ?? 0;
  const totalDevices = payload?.snapshot.devices.length ?? 0;
  const healthPercent = totalDevices > 0 ? onlineDevices / totalDevices : 1;

  const createIncidentTask = (incident: Incident) => {
    void bulkCreateTasks({
      alertIds: incident.alertUids,
      grouped: true,
      incidentId: incident.id,
      title: incident.suggestedTaskTitle,
      priority: incident.suggestedTaskPriority,
    });
  };

  return (
    <div className="page dashboard">
      <PageHeader
        eyebrow={
          <span className="eyebrow-status">
            <span className={cn("status-dot", payload?.snapshot.meta.stale ? "status-dot--warning" : "status-dot--success")} />
            {payload?.snapshot.meta.sourceLabel ?? "Demo-Tenant"}
            <span className="dot-sep">·</span>
            Letzter Sync {payload ? formatRelative(payload.snapshot.meta.lastSync) : "—"}
          </span>
        }
        title="Lagebild"
        description="Ursachen zuerst. Was ist wirklich ausgefallen, was ist nur ein Symptom – und was tun wir jetzt?"
        actions={
          <>
            <Button variant="ghost" icon={RadioTower} onClick={() => navigate("/causality?signal=1")}>
              Signal melden
            </Button>
            <Button variant="primary" icon={RefreshCw} loading={syncing} onClick={() => void sync()}>
              Synchronisieren
            </Button>
          </>
        }
      />

      <div className="kpi-grid">
        <KpiCard
          label="Aktive Alarme"
          value={formatNumber(alertViews.length)}
          icon={Siren}
          tone="danger"
          trend={trend}
          footer={`${priorityCounts.P1} kritisch · ${priorityCounts.P2} hoch`}
          onClick={() => navigate("/alerts")}
        />
        <KpiCard
          label="Erkannte Ursachen"
          value={formatNumber(incidents.length)}
          icon={Waypoints}
          tone="violet"
          footer={`${causality.stats.affectedDevices} Geräte · ${causality.stats.affectedLocations} Standorte betroffen`}
          onClick={() => navigate("/causality")}
        />
        <KpiCard
          label="Als Symptom erklärt"
          value={formatNumber(suppressedCount)}
          icon={GitBranch}
          tone="accent"
          footer={`${formatPercent(suppressedPercent)} aller Alarme · ${Object.keys(causality.stats.byRule).length} Regeln aktiv`}
          progress={{ value: suppressedPercent * 100, tone: "accent" }}
          onClick={() => navigate("/alerts?suppressed=1")}
        />
        <KpiCard
          label="Offene Aufgaben"
          value={formatNumber(openTasks.length)}
          icon={ClipboardCheck}
          tone={overdueTasks.length > 0 ? "warning" : "success"}
          footer={
            overdueTasks.length > 0
              ? `${overdueTasks.length} überfällig · ${tasks.filter((task) => task.status === "done").length} erledigt`
              : `${tasks.filter((task) => task.status === "done").length} erledigt · keine Überfälligkeit`
          }
          onClick={() => navigate("/tasks")}
        />
      </div>

      {suppressedCount > 0 ? (
        <div className="insight-banner">
          <span className="insight-banner__icon">
            <GitBranch size={20} aria-hidden />
          </span>
          <div className="insight-banner__text">
            <strong>
              {suppressedCount} Alarme werden durch {incidents.length} Ursachen erklärt.
            </strong>
            <span>
              Ohne Kausalität würdest du {alertViews.length} Einzelalarme sehen. Signal zeigt dir zuerst die{" "}
              {incidents.length} echten Vorfälle.
            </span>
          </div>
          <div className="insight-banner__actions">
            <Button size="sm" variant="ghost" onClick={() => navigate("/alerts?suppressed=1")}>
              Symptome anzeigen
            </Button>
            <Button size="sm" variant="soft" icon={ArrowUpRight} onClick={() => navigate("/causality")}>
              Warum?
            </Button>
          </div>
        </div>
      ) : null}

      <div className="dashboard-grid">
        <Panel className="dashboard-grid__attention">
          <PanelHeader
            title="Braucht Aufmerksamkeit"
            subtitle="Priorisiert nach Schwere, Alter und Kausalität"
            icon={ShieldAlert}
            action={
              <Link className="text-link" to="/alerts">
                Alle Alarme <ArrowUpRight size={14} />
              </Link>
            }
          />
          {attention.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Keine offenen Alarme"
              description="Alle aktiven Alarme sind durch Ursachen erklärt oder bereits bestätigt."
            />
          ) : (
            <div className="alert-list">
              {attention.map((view) => (
                <AlertRow
                  key={view.alert.uid}
                  view={view}
                  compact
                  onOpen={() => navigate(`/alerts?alert=${encodeURIComponent(view.alert.uid)}`)}
                  onAck={() => void ackAlert(view.alert.uid, !view.alert.acknowledged)}
                  onTask={() => void bulkCreateTasks({ alertIds: [view.alert.uid] })}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel className="dashboard-grid__incidents">
          <PanelHeader
            title="Aktive Ursachen"
            subtitle="Root Causes mit Impact und Konfidenz"
            icon={Waypoints}
            action={
              <Link className="text-link" to="/causality">
                Zentrum <ArrowUpRight size={14} />
              </Link>
            }
          />
          <div className="incident-list">
            {topIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                compact
                onOpen={() => navigate(`/causality?incident=${encodeURIComponent(incident.id)}`)}
                onCreateTask={createIncidentTask}
              />
            ))}
          </div>
        </Panel>

        <Panel className="dashboard-grid__health">
          <PanelHeader
            title="Standort-Health"
            subtitle={`${onlineDevices} von ${totalDevices} Geräten online`}
            icon={MapPin}
            action={<Badge tone={healthPercent > 0.9 ? "success" : healthPercent > 0.75 ? "warning" : "danger"}>{formatPercent(healthPercent)}</Badge>}
          />
          <div className="location-list">
            {locationRows.map((row) => {
              const online = row.total - row.offline;
              const ratio = row.total > 0 ? online / row.total : 1;
              return (
                <button
                  type="button"
                  key={row.id}
                  className="location-row"
                  onClick={() => navigate(`/devices?location=${row.id}`)}
                >
                  <div className="location-row__top">
                    <div>
                      <strong>{row.name}</strong>
                      <span>{row.organization}</span>
                    </div>
                    <div className="location-row__numbers">
                      {row.offline > 0 ? <Badge tone="danger">{row.offline} offline</Badge> : <Badge tone="success">online</Badge>}
                      {row.p1 > 0 ? <Badge tone="warning">{row.p1} P1</Badge> : null}
                    </div>
                  </div>
                  <Progress value={ratio * 100} tone={ratio > 0.9 ? "success" : ratio > 0.6 ? "warning" : "danger"} />
                  <div className="location-row__meta">
                    <span>
                      {online}/{row.total} Geräte
                    </span>
                    <span>{row.alerts} Alarme</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="dashboard-grid__volume">
          <PanelHeader
            title="Alarmvolumen"
            subtitle="Aktive Alarme nach Kategorie"
            icon={Activity}
            action={<MiniBars data={trend} tone="violet" />}
          />
          {categoryRows.length > 0 ? (
            <BarList items={categoryRows} />
          ) : (
            <EmptyState compact icon={CheckCircle2} title="Keine Alarme" description="Aktuell ist nichts offen." />
          )}
        </Panel>

        <Panel className="dashboard-grid__activity">
          <PanelHeader
            title="Aktivität"
            subtitle="Letzte NinjaOne-Ereignisse"
            icon={Activity}
            action={<Badge tone="neutral">Live-Feed</Badge>}
          />
          <div className="activity-list">
            {(payload?.snapshot.activities ?? []).slice(0, 6).map((activity) => {
              const device = deviceMap.get(activity.deviceId);
              return (
                <button
                  type="button"
                  className="activity-row"
                  key={activity.id}
                  onClick={() => activity.seriesUid && navigate(`/alerts?alert=${encodeURIComponent(activity.seriesUid)}`)}
                >
                  <span className={cn("activity-row__dot", `activity-row__dot--${activity.severity.toLowerCase()}`)} />
                  <span className="activity-row__text">
                    <strong>{activity.message}</strong>
                    <small>
                      {device?.displayName ?? `Gerät ${activity.deviceId}`} · {activity.sourceName}
                    </small>
                  </span>
                  <span className="activity-row__time">{formatRelative(activity.activityTime)}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="dashboard-footnote">
        <TriangleAlert size={15} aria-hidden />
        <span>
          Demo-Daten bilden einen WAN-Ausfall, einen Switch-Ausfall, einen Host-Ausfall und zwei Agent-Ausfälle ab. Die
          Kausalität ist heuristisch – jede Unterdrückung ist im Kausalitätszentrum erklärbar.
        </span>
      </div>
    </div>
  );
}
