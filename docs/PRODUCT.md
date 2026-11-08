# Produktkonzept — Signal

## 1. Vision

**Signal ist das Lagebild über NinjaOne, nicht ein weiteres Alarm-Postfach.**

NinjaOne liefert eine sehr gute Rohdatenbasis: Geräte, Conditions, Alarme, Aktivitäten, Standorte und Policies. In der operativen Praxis entsteht daraus jedoch Rauschen. Ein ausgefallener Switch erzeugt Dutzende „Gerät offline“-Alarme. Ein Agent, der nicht mehr berichten kann, erzeugt keine Disk-Alarme mehr – er verschwindet still. Ein WAN-Ausfall ist für das cloudbasierte Monitoring teilweise unsichtbar. Techniker verbringen Zeit mit dem Sortieren von Symptomen statt mit der Ursache.

Signal beantwortet drei Fragen in dieser Reihenfolge:

1. **Was ist die Ursache?** (Kausalität, Root Causes, externe Signale)
2. **Was ist wirklich wichtig?** (Priorität, SLA, Kundenkontext)
3. **Was tun wir jetzt?** (Aufgaben, Empfehlungen, Nachverfolgung)

## 2. Zielgruppen

| Persona | Kontext | Bedürfnis |
| --- | --- | --- |
| **MSP-Dispatcher** | 5–50 Kunden, hoher Alarmfluss | Schnell triagieren, Aufgaben verteilen, Kunden nicht mit Folgealarmen belasten |
| **Senior Technician / Incident Lead** | Parallele Störungen, Standorte, Netzwerk | Ursache statt Symptom sehen, Beweise und Konfidenz nachvollziehen |
| **IT-Leiter / Service Manager** | SLA, Auslastung, Reporting | Belastbare Priorisierung, offene Aufgaben, Ursachenverteilung |
| **Netzwerk-/Field-Techniker** | Switches, WAN, Standorte | Klare Handlungsanweisung: Welchen Switch prüfen? Welche Leitung? |

## 3. Jobs to be Done

- „Zeig mir alle Conditions, die für diesen Server, diesen Standort oder diesen Kunden gelten – gruppiert und filterbar.“
- „Zeig mir die ausgelösten Conditions so, dass ich in 30 Sekunden weiß, was P1 ist.“
- „Erkenne, dass 18 Alarme nur Folgen eines Switch- oder WAN-Ausfalls sind, und blende sie als Symptome aus.“
- „Erfasse einen ISP-Ausfall manuell, den NinjaOne nicht sehen kann, und unterdrücke die davon abhängigen Alarme.“
- „Mach aus diesen drei Alarmen eine Aufgabe mit Kontext, Priorität und Fälligkeit.“
- „Ich will das alles auf dem Handy im Bereitschaftsdienst bedienen können.“

## 4. Produktprinzipien

1. **Ursache vor Symptom.** Die UI priorisiert Root Causes und erklärt jede Unterdrückung.
2. **Nichts verstecken.** Suppression ist immer sichtbar, umkehrbar und begründet („Warum ist das ausgeblendet?“).
3. **Datenherkunft kennzeichnen.** Live, Demo, abgeleitet, lokal gepflegt, stale – nie vermischen.
4. **Filter überall.** Jede Liste hat Suche, Filter, Sortierung, Gruppierung und gespeicherte Ansichten.
5. **Ruhige Dichte.** Viele Informationen, aber klare Hierarchie, großzügiger Weißraum und konsistente Interaktion.
6. **Mobile ist kein Nachgedanke.** Bereitschaft funktioniert auf 390 px Breite.
7. **Sicherheit by default.** Secrets nur serverseitig, keine Tokens im Browser, keine destruktiven Aktionen ohne Bestätigung.

## 5. Funktionsumfang (Anforderungen a–i)

### a) Conditions anzeigen und mehrstufig gruppieren

- Katalog aller bekannten Conditions mit Kategorie, Schweregrad, Priorität, Schwelle, Dauer, Policy, Geltungsbereich, Vererbung, Status und Trigger-Historie.
- **Hierarchische Ansicht:** Organisation → Standort → Geräteklasse (Server, Endpoint, Netzwerk, Virtualisierung) → Kategorie → Condition.
- Alternative Gruppierung: Policy, Schweregrad, Kategorie, Status.
- Suche, Filter (Org, Standort, Klasse, Kategorie, Severity, aktiv/ausgelöst, Policy), Sortierung und gespeicherte Ansichten.
- **Ehrliche Kennzeichnung:** Die NinjaOne Public API liefert die Condition-Rohkonfiguration nicht. Signal baut den Katalog aus Aktivitäten (`sourceConfigUid`, `sourceName`) und einem lokal pflegbaren Katalog. Die UI zeigt die Herkunft.

### b) Kausalität / Smart Suppression

- Regeln für Agent-offline, Parent-/Host-offline, Switch-/Netzwerkpfad, WAN-Ausfall, Wartung, Flapping und externe Signale.
- Jede Unterdrückung hat Root Cause, Regel, Konfidenz, Evidenz und Empfehlung.
- Standardmäßig werden Symptome ausgeblendet, aber mit Banner und Umschalter sichtbar gemacht.
- Root Causes werden **nie** unterdrückt.
- Kausalitätszentrum mit Incidents, Impact, Graph, Suppression-Explorer und Regelkonfiguration.

### c) Aufgaben aus Alarmen

- Einzel- oder Bulk-Erstellung aus Alarmen und Incidents.
- Aufgaben mit Priorität, Status, Assignee, Fälligkeit, Tags, Checkliste, verknüpften Alarmen/Geräten.
- Board- und Listenansicht, Drag & Drop, Überfälligkeit, Filter/Suche/Sortierung.
- Automatische Empfehlungen (z. B. „Switch prüfen“, „ISP kontaktieren“), aber keine ungefragte Ausführung.

### d) Filter, Sortierung, Suche überall

- Jede Entität: Volltextsuche, Facettenfilter, Sortierung, Gruppierung, Pagination/„Mehr laden“, gespeicherte Ansichten, leere Zustände mit Reset.
- Globale Command Palette (⌘K / Strg+K) über Alarme, Conditions, Geräte und Aufgaben.

### e) Responsive & UX

- Desktop: Sidebar + dichte Tabellen. Tablet: reduzierte Spalten. Mobile: Karten, Bottom-Navigation, Slide-over-Details.
- Skeletons, Toasts, optimistische Updates, Tastaturfokus, Reduced Motion.
- Konsistente Design-Tokens, Dark/Light, System-Präferenz.

### f) Dark/Light Theme

- Vollständige Token-Sets für beide Themes, persistiert, System-Default, Umschalter in Topbar und Einstellungen.

### g) Git

- Jeder Liefer­schritt ist ein eigener Commit mit konventionellem Prefix. Changelog dokumentiert die Reihenfolge.

### h) Dokumentation

- Roadmap, Produkt, Technologie, API-Recherche, Kausalitätsmodell, UX, Changelog, README.

### i) Internet-/Switch-Ausfälle

- **Externe Signale**: ISP, Strom, Switch, Wartung, Sonstiges – mit Scope (Org/Standort/Gerät), Zeitfenster, Wirkung und Notiz.
- Engine unterscheidet:
  - **WAN-Ausfall:** internetabhängige Checks (HTTP, externe DNS, Cloud) unterdrücken; lokale Hardware-/Agent-Alarme bleiben gültig.
  - **Switch-Ausfall:** Geräte hinter dem Switch werden als Symptome gruppiert; der Switch ist Root Cause.
  - **NinjaOne nicht erreichbar:** App arbeitet mit letztem Snapshot weiter, kennzeichnet `stale` und erlaubt manuelle Signale.

## 6. Demo-Szenario

Der Demo-Modus erzählt eine zusammenhängende Geschichte:

- **Standort Bremen (Nordwind Logistics):** WAN-/ISP-Ausfall. Firewall und Access-Switch offline, 7 Geräte offline, HTTP-Checks rot. Signal gruppiert das als **einen** WAN-Incident und unterdrückt die Folgealarme.
- **ESX-02 (Klinik am Park):** Host offline, drei VMs offline. Der Host ist Root Cause; VM-Alarme sind Symptome.
- **SRV-FILE01 (Hamburg):** Agent offline, letzte Disk-Warnung ist veraltet. Signal markiert die Disk-Warnung als nicht mehr belastbar und erzeugt eine Prüfaufgabe.
- **SW-CORE-01 (Hamburg):** einzelner Uplink-Port down, aber Switch online – kein Standortausfall, sondern gezielte Port-Prüfung.
- **Einzelne echte Alarme:** SMART-Fehler, Spooler-Dienst, AV-Bedrohung, Backup-Fehler, Patch-Risiko.

## 7. Erfolgskriterien

| Metrik | Ziel |
| --- | --- |
| Time-to-triage (P1 sichtbar) | < 10 s nach App-Start |
| Anteil als Symptom erkannter Alarme in Demo | ≥ 45 % |
| Fehlklassifikation Root Cause → Symptom | 0 in Tests |
| Bedienbarkeit aller Kernflows auf 390 px | 100 % |
| Lighthouse Accessibility | ≥ 95 (angestrebt) |
| Testabdeckung Kernlogik | Prioritäts- und Kausalitätsregeln vollständig |

## 8. Nicht-Ziele (bewusst)

- Kein Ersatz für NinjaOne, kein Patch-/Backup-Management.
- Keine stillen Auto-Remediations ohne Freigabe.
- Keine Nutzung inoffizieller/undokumentierter Endpunkte.
- Keine mehrstufige Benutzerverwaltung im MVP (Single-Tenant-Betrieb, Auth folgt).
- Keine erfundene Live-Condition-Konfiguration, wenn die API sie nicht liefert.
