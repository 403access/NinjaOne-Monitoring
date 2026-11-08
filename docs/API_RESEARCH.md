# NinjaOne API Research

**Stand:** 2026-11-08  
**Ziel:** Belastbare, ausschließlich auf der offiziellen NinjaOne-Public-API-2.0 basierende Datenbasis für Signal.

## 1. Quellen

| Quelle | Verwendung |
| --- | --- |
| [NinjaOne Public API (US)](https://app.ninjarmm.com/apidocs/) | Autoritative Referenz, „Try it out“, Schemas |
| [NinjaOne Public API – Core Resources (Beta)](https://app.ninjarmm.com/apidocs-beta/core-resources) | Neue, strukturierte Referenz |
| [Public API Operations](https://www.ninjaone.com/docs/application-programming-interface-api/public-api-operations/) | Einstieg, Auth, Schema-Hinweise |
| [Public API 2.0 Authorization](https://www.ninjaone.com/docs/application-programming-interface-api/public-api-2-0-authorization/) | OAuth-Flows, Token/SessionKey |
| [Webhooks Overview](https://app.ninjarmm.com/apidocs-beta/core-resources/articles/webhooks/overview) | Activity-Webhook, Konfiguration |
| [Policy Condition Types](https://www.ninjaone.com/docs/policies-and-conditions/conditions/policy-condition-types-explained/) | Fachliche Bedeutung aller Condition-Typen |
| [NMS Policy Management](https://www.ninjaone.com/docs/network-management-system/policy-management/) | NMS-Online/Offline-Logik, Switch-/Netzwerk-Conditions |
| [API License Agreement](https://www.ninjaone.com/api-license-agreement/) | Nutzungs- und Limitierungsrahmen |

Zusätzlich wurde die öffentlich gespiegelte OpenAPI-2.0-Spezifikation (`2.0.9-draft`, Titel „Ninja RMM Public API 2.0“) ausgewertet. Ein Auszug der für Signal relevanten Endpunkte und Schemas liegt unter [`reference/ninjaone-public-api-key-endpoints.json`](reference/ninjaone-public-api-key-endpoints.json). Maßgeblich bleibt immer die live veröffentlichte Dokumentation des eigenen Tenants.

## 2. Hosts, Versionierung und Authentifizierung

- **API-Basis:** `https://{region}.ninjarmm.com/api/v2`
- **Regionen:** `app` (US), `eu` (EU), `oc` (Ozeanien). Immer den Hostnamen des eigenen Tenants verwenden.
- **Auth:** OAuth 2.0. Unterstützt werden Authorization Code und Client Credentials; zusätzlich existiert ein `sessionKey`-Cookie für interaktive Nutzung.
- **Token-Endpunkt:** `POST /ws/oauth/token` (relativ zum Regionshost), `grant_type=client_credentials`.
- **Scopes:** `monitoring` und `Management`. Signal benötigt lesend `monitoring`; `Management` nur für Aktionen wie Alert-Reset.
- **Transport:** `Authorization: Bearer <access_token>`. Tokens werden serverseitig gecacht und erst kurz vor Ablauf erneuert.
- **Geheimnisse:** Client Secret bleibt ausschließlich im Bun-Server (`.env`). Das Frontend sieht nur normalisierte Daten.

```http
POST /ws/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=...
&client_secret=...
&scope=monitoring management
```

## 3. Relevante Endpunkte

| Endpoint | Methode | Nutzen in Signal | Wichtige Parameter / Hinweise |
| --- | --- | --- | --- |
| `/v2/alerts` | GET | Aktive, ausgelöste Bedingungen | `sourceType`, `df` (Device Filter), `lang`, `tz` |
| `/v2/device/{id}/alerts` | GET | Alarme eines Geräts | `lang`, `tz` |
| `/v2/alert/{uid}` | DELETE | Alert/Condition zurücksetzen | `uid` = Alert-/Series-UID |
| `/v2/alert/{uid}/reset` | POST | Reset mit Aktivitätsdaten | Body frei, z. B. Kommentar |
| `/v2/activities` | GET | Historie, Severity/Priority, Condition-Katalog | `class`, `before`, `after`, `olderThan`, `newerThan`, `type`, `status`, `seriesUid`, `df`, `pageSize` (10–1000) |
| `/v2/devices` | GET | Gerätebasis, Pagination | `df`, `pageSize`, `after` (letzte Node-ID) |
| `/v2/devices-detailed` | GET | Erweiterte Geräte inkl. IP/MAC/Organization/Location | `df`, `pageSize`, `after` |
| `/v2/devices/search` | GET | Schnellsuche | `q`, `limit` |
| `/v2/policies` | GET | Policy-Metadaten und Vererbung | **Keine Conditions im Response** |
| `/v2/organizations` / `/v2/organizations-detailed` | GET | Mandanten-/Organisationshierarchie | – |
| `/v2/locations` | GET | Standorte | `organizationId` im Datensatz |
| `/v2/organization/{id}/locations` | GET | Standorte einer Organisation | – |
| `/v2/queries/device-health` | GET | Health-Aggregate pro Gerät | `df`, `health`, `cursor`, `pageSize` |
| `/v2/tasks` | GET | **Scheduled Tasks** (nicht Tickets!) | Nur lesend; nicht mit Signal-Aufgaben verwechseln |
| `/v2/webhook` | PUT/DELETE | Activity-Webhook konfigurieren/entfernen | Eine Konfiguration pro Tenant/App |

## 4. Datenmodelle (normalisiert)

### Alert (aus `/v2/alerts`)

```json
{
  "uid": "uuid",
  "deviceId": 42,
  "message": "Disk C: free space is below 5%",
  "createTime": 1762500000.0,
  "updateTime": 1762500600.0,
  "sourceType": "CONDITION_AGENT_DISK_FREE_SPACE",
  "sourceConfigUid": "uuid",
  "sourceName": "Disk Free Space",
  "subject": "Disk Free Space",
  "data": {},
  "device": {
    "id": 42,
    "parentDeviceId": 7,
    "organizationId": 3,
    "locationId": 11,
    "nodeClass": "WINDOWS_SERVER",
    "offline": false,
    "displayName": "SRV-FILE01",
    "maintenance": null,
    "tags": ["prod"],
    "references": {
      "organization": { "id": 3, "name": "..." },
      "location": { "id": 11, "name": "..." },
      "policy": { "id": 9, "name": "..." }
    }
  }
}
```

**Wichtig:** Der aktive Alert-Response enthält **keine** expliziten Felder `severity` oder `priority`. Diese sind in NinjaOne Teil der Condition-Konfiguration und werden über die Aktivitätshistorie sichtbar. Signal:

1. liest, falls vorhanden, `data.severity` / `data.priority` defensiv aus,
2. reichert Alerts über `/v2/activities` an (Match über `seriesUid`/`sourceConfigUid`),
3. berechnet daraus und aus eigenen, editierbaren Regeln die operative Priorität (P1–P4).

### Activity (aus `/v2/activities`)

Enthält u. a. `severity` (`NONE`, `MINOR`, `MODERATE`, `MAJOR`, `CRITICAL`), `priority` (`NONE`, `LOW`, `MEDIUM`, `HIGH`), `status`, `sourceName`, `sourceConfigUid`, `seriesUid`, `activityType` (`CONDITION`, `CONDITION_ACTION`, …), `message`, `data`, `deviceId`, `activityTime`.

Damit lassen sich:

- Severity/Priority historischer Trigger ableiten,
- ein **Condition-Katalog** aus distinkten `sourceConfigUid` + `sourceName` aufbauen,
- Flapping und Wiederholungen erkennen.

### Device (aus `/v2/devices-detailed`)

Relevante Felder: `id`, `parentDeviceId`, `organizationId`, `locationId`, `nodeClass`, `displayName`, `systemName`, `dnsName`, `netbiosName`, `offline`, `lastContact`, `lastUpdate`, `maintenance`, `tags`, `ipAddresses`, `macAddresses`, `publicIP`, `policy`, `organization`, `location`, `references`.

`parentDeviceId` ist die zentrale Kante für Kausalität (VM → Host, ggf. Gerät → übergeordnetes Gerät). Netzwerk-Topologie jenseits davon (Switch → Endgeräte) liefert die Public API nicht explizit; Signal modelliert sie über Standort, Tags und optional manuelle Zuordnung.

### Policy (aus `/v2/policies`)

`id`, `parentPolicyId`, `name`, `description`, `nodeClass`, `updated`, `nodeClassDefault`, `tags`, `fields`. **Conditions, Schwellwerte und Zeitfenster sind nicht enthalten.** Das ist die größte funktionale Lücke der Public API für Anforderung (a).

### Device Health (aus `/v2/queries/device-health`)

`deviceId`, `parentDeviceId`, `offline`, `parentOffline`, `healthStatus` (`UNKNOWN`, `HEALTHY`, `NEEDS_ATTENTION`, `UNHEALTHY`), `alertCount`, `activeJobCount`, Patch-/AV-Zähler. Ideal für Dashboard-Kacheln und „Parent offline“-Erkennung.

## 5. Fachliche Erkenntnisse zu Conditions

Die offizielle Condition-Übersicht nennt u. a.:

- **Agent:** Antivirus Health, Backup, Battery, CPU, Memory, Device Down, Disk Active Time, Disk Free Space, Disk Usage, Network Utilization, Process, Reboot Pending, Windows Service, Process Resource, System Uptime, Windows Event, Critical Events, SMART, Software, RAID, Patch CVSS, Script Result, BitLocker, Custom Fields, Patch Last Installed, Daemon, FileVault.
- **VM-Host:** Aggregate CPU, Memory, Disk Usage, Datastore Free Space, Host Uptime, Bad Sensor Count, Sensor Health.
- **VM-Gast:** CPU, Memory, Guest Operation Mode, Snapshot Size/Lifespan, Guest Tools.
- **NMS:** Configuration File, Custom SNMP, HTTP, Memory, Network Adapter Traffic/Percent/Status/Status Change, Ping Latency/Packet Loss/Response, Ports, Processor, SNMP Trap, Syslog.

NinjaOne unterscheidet einfache und **kombinierte Conditions** (AND/OR), Dämpfungszeiten, Reset-Intervalle, Vererbung über Parent Policies und automatische Remediation. Signal bildet diese Semantik im Condition-Modell ab (Kategorie, Schweregrad, Priorität, Schwellwert, Dauer, Vererbung, Trigger-Historie), auch wenn die Public API die Rohkonfiguration nicht liefert.

### NMS-Online/Offline-Logik (wichtig für Kausalität)

NinjaOne bestimmt den NMS-Status über das kürzeste aktive Monitorintervall × 2. Kommt innerhalb dieses Fensters kein Monitor-Datenpunkt, gilt das Gerät als offline. Bei reinen Ping-Monitoren wird erst der zweite verpasste Intervall als offline gewertet. Daraus folgt für Signal:

- Ein Switch-Ausfall ist ein **eigenständiger Root Cause**, nicht nur ein weiterer Alarm.
- Geräte „hinter“ einem ausgefallenen Switch erzeugen oft Folge-Alarme (Ping, HTTP, Port, Agent offline). Diese dürfen die Root Cause nicht überdecken.
- Ein WAN-/Internet-Ausfall kann NinjaOne selbst treffen („geht nicht über Ninja“). Signal braucht deshalb **externe Signale** (ISP, Strom, Switch-Wartung), die Suppression und Tasks steuern.

## 6. Pagination, Limits, Fehler

- **Devices:** Cursor-Pagination über `after` = letzte Node-ID, `pageSize` begrenzt.
- **Activities:** `pageSize` 10–1000 (Default 200); Zeitfilter über `before`/`after` bzw. Activity-IDs.
- **Alerts:** kein dokumentierter Cursor; Response ist die vollständige Liste der aktiven Alerts. Bei großen Tenants serverseitig cachen und filtern.
- **429:** nicht in der öffentlichen Spezifikation quantifiziert. Signal implementiert defensiv `Retry-After`-Respekt, exponentielles Backoff und max. 3 Wiederholungen.
- **Token-Ablauf:** `expires_in` aus der Token-Antwort; Cache mit 60 s Sicherheitsmarge.
- **Timeouts:** 15 s pro Request, konfigurierbar; bei Fehler wird der letzte Snapshot als „stale“ ausgeliefert.

## 7. Bewusste Designentscheidungen aufgrund der API

| Problem | Entscheidung |
| --- | --- |
| Conditions nicht über Public API lesbar | **Condition-Katalog** aus Aktivitäten + lokalem, editierbarem Katalog. UI kennzeichnet `Quelle: NinjaOne-Aktivität` vs. `lokal gepflegt`. Keine erfundenen Live-Konfigurationen. |
| Severity/Priority fehlen am aktiven Alert | Anreicherung über Aktivitäten + eigene Prioritätsregeln; Rohwerte bleiben sichtbar. |
| Keine Switch-Topologie | Kausalität über `parentDeviceId`, Standort, Tags und externe Signale; Topologie ist erweiterbar. |
| WAN-Ausfall für NinjaOne unsichtbar | Feature **Externe Signale** (ISP/Power/Switch) mit Scope und Wirkung auf Suppression/Tasks. |
| `/v2/tasks` sind Scheduled Tasks | Signal-Aufgaben werden lokal in SQLite geführt; optionale spätere PSA-/Ticketing-Integration über `/v2/ticketing/*`. |
| Webhook nur eine Konfiguration pro Tenant | Webhook-Empfänger ist vorbereitet, aber nicht Voraussetzung; Polling bleibt Fallback. |

## 8. Quellenangaben im Code

- `src/server/ninja/client.ts` – Auth, Retry, Pagination, Endpunkte.
- `src/server/ninja/normalize.ts` – Mapping der offiziellen Felder auf das Signal-Domänenmodell.
- `src/shared/types.ts` – dokumentierte Domänentypen.
- `docs/CAUSALITY_ENGINE.md` – fachliche Ableitung der Suppression-Regeln.
