import { PageHeader } from "../components/PageHeader";
import { EmptyState, Panel } from "../components/ui/Primitives";

export function Conditions() {
  return (
    <div className="page">
      <PageHeader title="Bedingungen" description="Condition-Katalog und Hierarchie." />
      <Panel>
        <EmptyState title="Bedingungen werden geladen" description="Der Explorer wird als Nächstes gebaut." />
      </Panel>
    </div>
  );
}

export function Alerts() {
  return (
    <div className="page">
      <PageHeader title="Alarme" description="Priorisierte Alarme." />
      <Panel>
        <EmptyState title="Alarme werden geladen" description="Der Alarm-Workspace wird als Nächstes gebaut." />
      </Panel>
    </div>
  );
}

export function Causality() {
  return (
    <div className="page">
      <PageHeader title="Kausalität" description="Incidents und Suppression." />
      <Panel>
        <EmptyState title="Kausalität wird geladen" description="Das Kausalitätszentrum wird als Nächstes gebaut." />
      </Panel>
    </div>
  );
}

export function Tasks() {
  return (
    <div className="page">
      <PageHeader title="Aufgaben" description="Board und Liste." />
      <Panel>
        <EmptyState title="Aufgaben werden geladen" description="Das Aufgaben-Board wird als Nächstes gebaut." />
      </Panel>
    </div>
  );
}

export function Devices() {
  return (
    <div className="page">
      <PageHeader title="Geräte" description="Inventar und Topologie." />
      <Panel>
        <EmptyState title="Geräte werden geladen" description="Das Inventar wird als Nächstes gebaut." />
      </Panel>
    </div>
  );
}

export function Settings() {
  return (
    <div className="page">
      <PageHeader title="Einstellungen" description="Datenquelle, Theme und Regeln." />
      <Panel>
        <EmptyState title="Einstellungen werden geladen" description="Die Einstellungen werden als Nächstes gebaut." />
      </Panel>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page">
      <PageHeader title="Seite nicht gefunden" description="Diese Ansicht existiert nicht." />
      <Panel>
        <EmptyState title="404" description="Zurück zum Lagebild." />
      </Panel>
    </div>
  );
}
