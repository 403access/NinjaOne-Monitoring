# Changelog

Alle Liefer­schritte werden als eigener Git-Commit festgehalten.

## 0.1.0 — MVP (2026-11-09)

### Research & Dokumentation
- Offizielle NinjaOne-Public-API-2.0-Recherche inkl. Auth, Endpunkten, Schemas und Grenzen (`docs/API_RESEARCH.md`)
- OpenAPI-Auszug der relevanten Endpunkte (`docs/reference/`)
- Produkt-, Roadmap-, Technologie-, Kausalitäts-, UX-, QA- und API-Dokumentation
- Screenshots aller Kernseiten in `docs/screenshots/`

### Backend
- Bun-Server mit same-origin JSON-API und React-Auslieferung
- NinjaOne-Client: OAuth2 Client Credentials, Token-Cache, Retry/Backoff, Timeout, Pagination
- Normalisierung von Alerts, Devices, Policies, Organisationen, Standorten, Health und Aktivitäten
- Condition-Katalog aus Aktivitäten (`sourceConfigUid`/`sourceName`) für den Live-Modus
- SQLite-Persistenz für Aufgaben, externe Signale, Einstellungen, Prioritätsregeln, Kausalitätsregeln, Alert-Status und Snapshot-Cache
- Demo-Datenlayer mit realistischem MSP-Szenario: WAN-Ausfall Bremen, Switch-Ausfall Duisburg, ESXi-Host-Ausfall Berlin, Agent-Ausfälle Hamburg/Kiel, 55 Alarme, 42 Conditions
- Fallback auf letzten Snapshot mit `stale`-Kennzeichnung
- Export, Webhook-Empfänger, Audit-Log, Demo-Reset

### Frontend
- Responsive App-Shell mit Sidebar, Topbar, Bottom-Navigation, Mobile-Slide-over
- Dashboard mit KPIs, Root Causes, Standort-Health, Alarmvolumen, Aktivität und Suppression-Insight
- Conditions-Explorer mit 3-stufiger Hierarchie, 7 Gruppierungen, Tabellenansicht, 7 Facetten, Suche, Sortierung, Saved Views und Detail-Drawer
- Alarm-Workspace mit P1–P4, Prioritäts-Chips, Suppression-Banner, 8 Facetten, Suche, Sortierung, Gruppierung, Saved Views, Bulk-Auswahl, Bulk-Aufgaben, Bestätigen, Detail-Drawer, manuellem Override und NinjaOne-Reset
- Kausalitätszentrum mit Incidents, Causal Graph, Konfidenz/Evidenz, Empfehlungen, Suppression-Explorer, Regel-Editor, Threshold und Signal-Historie
- Externe Signale (ISP, Strom, Switch, Wartung, Sonstiges) inkl. Scope, Wirkung, Beenden und Löschen
- Aufgaben-Board mit Drag & Drop, Liste, CRUD, Checklisten, Fälligkeiten, Assignees, Tags, verknüpften Alarmen und Incident-Bezug
- Geräte-Inventar mit Status, Parent-Topologie, Alarmen, Aufgaben und anwendbaren Conditions
- Einstellungen für Theme (Dark/Light/System), kompakte Tabellen, Datenquelle, Sync, Prioritätsmatrix, Prioritätsregeln, Kausalitätsschwelle, Export und Demo-Reset
- Command Palette (⌘K), Tastatur-Navigation (`g`-Sequenzen), Toasts, Saved Views, Focus-Management, Reduced Motion

### Qualität
- 22 Unit-Tests für Prioritäts-, Kausalitäts- und Normalisierungslogik
- TypeScript strict, `bun run check`
- Playwright-Flows für Desktop, Mobile, Drawer, Modals und Live-Fallback
- Dokumentierte Grenzen der Public API und bewusste Fallbacks
- Produktions-Build und Server-Smoke verifiziert

### Commits
1. `chore: initialize Bun + TypeScript + React project scaffold`
2. `docs: add NinjaOne API research, product, roadmap, technology, causality and UX documentation`
3. `feat(core): add domain model, realistic demo tenant, priority engine and causal suppression engine`
4. `feat(server): add NinjaOne OAuth client, normalization, SQLite store and REST API`
5. `feat(ui): add responsive operations console with dashboard, conditions, alerts, causality, tasks, devices and settings`
6. `fix: prioritize high-impact incidents, clarify signal reduction and sync suppression preference`
7. `test: add live API normalization coverage`
8. `docs: add QA matrix, screenshots, final README and delivery changelog`
9. `docs: record final delivery commits in changelog`
