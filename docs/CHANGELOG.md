# Changelog

Alle Liefer­schritte werden als eigener Git-Commit festgehalten.

## 0.1.0 — MVP

### Research & Dokumentation
- Offizielle NinjaOne-Public-API-2.0-Recherche inkl. Auth, Endpunkten, Schemas und Grenzen (`docs/API_RESEARCH.md`)
- OpenAPI-Auszug der relevanten Endpunkte (`docs/reference/`)
- Produkt-, Roadmap-, Technologie-, Kausalitäts- und UX-Dokumentation

### Backend
- Bun-Server mit same-origin JSON-API und React-Auslieferung
- NinjaOne-Client: OAuth2 Client Credentials, Token-Cache, Retry/Backoff, Timeout, Pagination
- Normalisierung von Alerts, Devices, Policies, Organisationen, Standorten, Health und Aktivitäten
- SQLite-Persistenz für Aufgaben, externe Signale, Einstellungen, Prioritätsregeln, Alert-Status und Snapshot-Cache
- Demo-Datenlayer mit realistischem MSP-Szenario (WAN-Ausfall, Switch, ESXi-Host, Agent offline)
- Fallback auf letzten Snapshot mit `stale`-Kennzeichnung

### Frontend
- Responsive App-Shell mit Sidebar, Topbar, Bottom-Navigation
- Dashboard mit KPIs, Root Causes, Standort-Health, Volumen und Aktivität
- Conditions-Explorer mit hierarchischer Gruppierung und vollständigen Filtern
- Alarm-Workspace mit Priorisierung, Suppression-Banner, Bulk-Aktionen und Detail-Drawer
- Kausalitätszentrum mit Incidents, Graph, Suppression-Explorer und externen Signalen
- Aufgaben-Board und -Liste inkl. CRUD und Verknüpfung
- Geräte-Inventar inkl. Parent-Kette
- Einstellungen für Theme, Datenquelle, Priorität und Kausalität
- Command Palette, Toasts, gespeicherte Ansichten, Dark/Light Theme
- Vollständige Suche/Filter/Sortierung auf allen Listen

### Qualität
- Unit-Tests für Prioritäts- und Kausalitätsengine
- TypeScript strict, `bun run check`
- Dokumentierte Grenzen der Public API und bewusste Fallbacks
