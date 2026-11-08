import {
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Monitor,
  Moon,
  Palette,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_PRIORITY_RULES,
  DEFAULT_SEVERITY_MATRIX,
  PRIORITY_LABEL,
  SEVERITY_LABEL,
} from "../../shared/constants";
import type { Priority, Severity, ThemeMode } from "../../shared/types";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { cn } from "../lib/cn";
import { formatRelative } from "../lib/format";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ui/Overlay";
import { Badge, Button, Panel, PanelHeader, Progress, Toggle } from "../components/ui/Primitives";

const THEMES: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Moon }> = [
  { value: "dark", label: "Dark", description: "Hoher Kontrast für Bereitschaft und Nachtschichten.", icon: Moon },
  { value: "light", label: "Light", description: "Helle Oberfläche für Tageslicht und Präsentationen.", icon: Sun },
  { value: "system", label: "System", description: "Folgt automatisch der Betriebssystem-Präferenz.", icon: Monitor },
];

export function Settings() {
  const {
    payload,
    settings,
    priorityRules,
    updateSettings,
    savePriorityRules,
    refresh,
    sync,
    syncing,
    resetDemo,
  } = useApp();
  const { push } = useToast();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [testing, setTesting] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/health");
      const data = (await response.json()) as { ok?: boolean; credentials?: boolean; host?: string | null; mode?: string };
      push(
        data.ok
          ? `API erreichbar · ${data.mode} · Credentials ${data.credentials ? "vorhanden" : "fehlen"}${data.host ? ` · ${data.host}` : ""}`
          : "API nicht erreichbar",
        data.ok ? "success" : "error",
      );
    } catch {
      push("Health-Check fehlgeschlagen", "error");
    } finally {
      setTesting(false);
    }
  };

  const changeMode = async (mode: "demo" | "live") => {
    setLiveLoading(true);
    await updateSettings({ mode });
    await refresh();
    setLiveLoading(false);
    push(mode === "live" ? "Live-Modus aktiviert" : "Demo-Modus aktiviert", "success");
  };

  const updateRule = (id: string, patch: { enabled?: boolean; priority?: Priority }) => {
    void savePriorityRules(priorityRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const resetPriorityDefaults = () => {
    void savePriorityRules(DEFAULT_PRIORITY_RULES);
    void updateSettings({ severityMatrix: DEFAULT_SEVERITY_MATRIX, suppressionThreshold: 0.7 });
    push("Prioritätsregeln zurückgesetzt", "success");
  };

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow={
          <span className="eyebrow-status">
            <Settings2 size={13} aria-hidden />
            v0.1.0 · {payload?.snapshot.meta.mode === "live" ? "Live" : "Demo"} · Letzter Sync{" "}
            {payload ? formatRelative(payload.snapshot.meta.lastSync) : "—"}
          </span>
        }
        title="Einstellungen"
        description="Darstellung, Datenquelle, Prioritätslogik und Datenverwaltung. Änderungen werden sofort gespeichert."
        actions={
          <Button variant="primary" icon={RefreshCw} loading={syncing} onClick={() => void sync()}>
            Synchronisieren
          </Button>
        }
      />

      <div className="settings-grid">
        <Panel>
          <PanelHeader title="Darstellung" subtitle="Theme und Informationsdichte" icon={Palette} />
          <div className="theme-options">
            {THEMES.map((theme) => {
              const Icon = theme.icon;
              return (
                <button
                  type="button"
                  key={theme.value}
                  className={cn("theme-card", `theme-card--${theme.value}`, settings.theme === theme.value && "is-active")}
                  onClick={() => void updateSettings({ theme: theme.value })}
                >
                  <div className="theme-card__preview">
                    <span className="theme-card__preview-sidebar" />
                    <span className="theme-card__preview-content">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <div className="theme-card__label">
                    <Icon size={14} aria-hidden />
                    <strong>{theme.label}</strong>
                    {settings.theme === theme.value ? <CheckCircle2 size={14} className="theme-card__check" /> : null}
                  </div>
                  <p>{theme.description}</p>
                </button>
              );
            })}
          </div>
          <div className="settings-block">
            <Toggle
              checked={settings.compactTables}
              onChange={(next) => void updateSettings({ compactTables: next })}
              label="Kompakte Tabellen"
              description="Reduziert Zeilenhöhe und Innenabstand in Tabellen."
            />
            <Toggle
              checked={settings.autoTaskSuggestions}
              onChange={(next) => void updateSettings({ autoTaskSuggestions: next })}
              label="Aufgaben-Empfehlungen"
              description="Empfohlene Aufgaben aus Incidents anzeigen."
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Datenquelle"
            subtitle="NinjaOne Public API 2.0"
            icon={Database}
            action={
              <Badge tone={payload?.snapshot.meta.stale ? "warning" : "success"} dot>
                {payload?.snapshot.meta.stale ? "stale" : "verbunden"}
              </Badge>
            }
          />
          <div className="settings-block">
            <div className="mode-selector">
              <button
                type="button"
                className={cn("mode-option", settings.mode === "demo" && "is-active")}
                onClick={() => void changeMode("demo")}
                disabled={liveLoading}
              >
                <span className="mode-option__icon">
                  <Database size={17} />
                </span>
                <div>
                  <strong>Demo-Modus</strong>
                  <span>Realistischer Tenant, vollständig offline</span>
                </div>
                {settings.mode === "demo" ? <CheckCircle2 size={16} className="mode-option__check" /> : null}
              </button>
              <button
                type="button"
                className={cn("mode-option", settings.mode === "live" && "is-active")}
                onClick={() => void changeMode("live")}
                disabled={liveLoading}
              >
                <span className="mode-option__icon">
                  <PlugZap size={17} />
                </span>
                <div>
                  <strong>Live-Modus</strong>
                  <span>Eigener NinjaOne-Tenant via OAuth 2.0</span>
                </div>
                {settings.mode === "live" ? <CheckCircle2 size={16} className="mode-option__check" /> : null}
              </button>
            </div>

            <div className="connection-card">
              <div className="connection-card__row">
                <span>Tenant</span>
                <strong>{payload?.snapshot.meta.tenant ?? "demo.ninjarmm.local"}</strong>
              </div>
              <div className="connection-card__row">
                <span>Quelle</span>
                <strong>{payload?.snapshot.meta.sourceLabel ?? "—"}</strong>
              </div>
              <div className="connection-card__row">
                <span>Letzter Sync</span>
                <strong>{payload ? formatRelative(payload.snapshot.meta.lastSync) : "—"}</strong>
              </div>
              <div className="connection-card__row">
                <span>Alarme / Geräte</span>
                <strong>
                  {payload?.snapshot.meta.counts.alerts ?? 0} / {payload?.snapshot.meta.counts.devices ?? 0}
                </strong>
              </div>
              <div className="connection-card__actions">
                <Button size="sm" variant="secondary" icon={PlugZap} loading={testing} onClick={() => void testConnection()}>
                  Verbindung testen
                </Button>
                <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => void sync()}>
                  Jetzt syncen
                </Button>
              </div>
            </div>

            <label className="field">
              <span>Sync-Intervall (Sekunden, 0 = manuell)</span>
              <input
                type="number"
                min={0}
                max={3600}
                value={settings.refreshSeconds}
                onChange={(event) => void updateSettings({ refreshSeconds: Number(event.target.value) })}
              />
            </label>

            <div className="info-box">
              <ShieldAlert size={16} aria-hidden />
              <div>
                <strong>Credentials bleiben serverseitig</strong>
                <p>
                  Client-ID und Secret werden ausschließlich über <code>.env</code> gelesen
                  (<code>NINJA_CLIENT_ID</code>, <code>NINJA_CLIENT_SECRET</code>, <code>NINJA_BASE_URL</code>). Sie
                  gelangen nie in den Browser. Ohne Credentials fällt Signal auf den letzten Snapshot oder Demo-Daten
                  zurück.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="settings-priority">
          <PanelHeader
            title="Prioritätslogik"
            subtitle="Severity-Matrix und überlagernde Regeln"
            icon={SlidersHorizontal}
            action={
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetPriorityDefaults}>
                Defaults
              </Button>
            }
          />
          <div className="settings-block">
            <h3 className="settings-subtitle">Severity → Basispriorität</h3>
            <div className="matrix-grid">
              {(Object.keys(SEVERITY_LABEL) as Severity[]).map((severity) => (
                <div className="matrix-row" key={severity}>
                  <span>{SEVERITY_LABEL[severity]}</span>
                  <div className="matrix-options">
                    {(["P1", "P2", "P3", "P4"] as Priority[]).map((priority) => (
                      <button
                        type="button"
                        key={priority}
                        className={cn("matrix-option", settings.severityMatrix[severity] === priority && "is-active", `matrix-option--${priority.toLowerCase()}`)}
                        onClick={() => void updateSettings({ severityMatrix: { ...settings.severityMatrix, [severity]: priority } })}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h3 className="settings-subtitle">Überlagernde Regeln</h3>
            <div className="settings-rule-list">
              {priorityRules.map((rule) => (
                <div className={cn("settings-rule", !rule.enabled && "is-disabled")} key={rule.id}>
                  <div className="settings-rule__main">
                    <strong>{rule.name}</strong>
                    <span>{rule.reason}</span>
                  </div>
                  <select
                    value={rule.priority}
                    onChange={(event) => updateRule(rule.id, { priority: event.target.value as Priority })}
                    aria-label={`Priorität für ${rule.name}`}
                    disabled={!rule.enabled}
                  >
                    {(["P1", "P2", "P3", "P4"] as Priority[]).map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_LABEL[priority]}
                      </option>
                    ))}
                  </select>
                  <Toggle checked={rule.enabled} onChange={(next) => updateRule(rule.id, { enabled: next })} label={rule.name} />
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Kausalität" subtitle="Unterdrückungsschwelle und Regeln" icon={ShieldAlert} />
          <div className="settings-block">
            <div className="threshold-card">
              <div>
                <span>Unterdrückungsschwelle</span>
                <strong>{Math.round(settings.suppressionThreshold * 100)} %</strong>
              </div>
              <Progress value={settings.suppressionThreshold * 100} tone="violet" />
              <input
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={settings.suppressionThreshold}
                onChange={(event) => void updateSettings({ suppressionThreshold: Number(event.target.value) })}
                aria-label="Unterdrückungsschwelle"
              />
              <small>Regeln unterhalb dieser Konfidenz unterdrücken Alarme nicht.</small>
            </div>
            <Toggle
              checked={settings.showSuppressed}
              onChange={(next) => void updateSettings({ showSuppressed: next })}
              label="Symptome standardmäßig anzeigen"
              description="Gilt für den Alarm-Workspace und das Dashboard."
            />
            <Button variant="secondary" icon={ExternalLink} onClick={() => navigate("/causality?tab=rules")}>
              Kausalitätsregeln bearbeiten
            </Button>
            <div className="info-box">
              <ShieldAlert size={16} aria-hidden />
              <div>
                <strong>Guardrails</strong>
                <p>
                  Sicherheitsalarme werden nie unterdrückt. Root Causes bleiben immer sichtbar. Jede Unterdrückung ist
                  im Kausalitätszentrum mit Regel, Konfidenz und Evidenz erklärt.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Daten & Export" subtitle="Lokaler Arbeitsstand" icon={Download} />
          <div className="settings-block">
            <div className="data-stats">
              <div>
                <span>Aufgaben</span>
                <strong>{payload?.tasks.length ?? 0}</strong>
              </div>
              <div>
                <span>Signale</span>
                <strong>{payload?.signals.length ?? 0}</strong>
              </div>
              <div>
                <span>Prioritätsregeln</span>
                <strong>{priorityRules.length}</strong>
              </div>
              <div>
                <span>Kausalitätsregeln</span>
                <strong>{payload?.causalityRules.length ?? 0}</strong>
              </div>
            </div>
            <div className="settings-actions">
              <a className="btn btn--secondary btn--md" href="/api/export" download>
                <Download size={15} /> JSON exportieren
              </a>
              <Button variant="ghost" icon={RefreshCw} onClick={() => void refresh()}>
                Neu laden
              </Button>
            </div>
            <div className="danger-zone">
              <div>
                <strong>Demo-Daten zurücksetzen</strong>
                <span>Löscht Aufgaben, Signale und Alert-Overrides und stellt den Demo-Tenant wieder her.</span>
              </div>
              <Button variant="danger" icon={Trash2} onClick={() => setConfirmReset(true)}>
                Zurücksetzen
              </Button>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Dokumentation" subtitle="Research, Architektur und Grenzen" icon={ExternalLink} />
          <div className="settings-block docs-list">
            <a href="https://app.ninjarmm.com/apidocs/" target="_blank" rel="noreferrer">
              <span>NinjaOne Public API 2.0</span>
              <ExternalLink size={13} />
            </a>
            <a href="https://www.ninjaone.com/docs/policies-and-conditions/conditions/policy-condition-types-explained/" target="_blank" rel="noreferrer">
              <span>Condition-Typen (offiziell)</span>
              <ExternalLink size={13} />
            </a>
            <div className="docs-local">
              <span>docs/API_RESEARCH.md</span>
              <span>docs/CAUSALITY_ENGINE.md</span>
              <span>docs/TECHNOLOGY.md</span>
              <span>docs/ROADMAP.md</span>
            </div>
            <div className="info-box">
              <Database size={16} aria-hidden />
              <div>
                <strong>Bekannte API-Grenzen</strong>
                <p>
                  Condition-Rohkonfigurationen und Switch-Port-Topologie sind nicht Teil der Public API. Signal
                  kennzeichnet abgeleitete Daten und nutzt externe Signale für NinjaOne-Blindspots.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void resetDemo()}
        title="Demo-Daten zurücksetzen?"
        description="Aufgaben, Signale und Alert-Overrides werden gelöscht. Der Demo-Tenant wird neu aufgebaut."
        confirmLabel="Zurücksetzen"
      />
    </div>
  );
}
