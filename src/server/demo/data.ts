import {
  categoryForSourceType,
  nodeGroupForNodeClass,
} from "../../shared/constants";
import type {
  Activity,
  Alert,
  Condition,
  Device,
  DeviceHealth,
  ExternalSignal,
  Location,
  Organization,
  Policy,
  Snapshot,
  Task,
} from "../../shared/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const organizations: Organization[] = [
  { id: 101, name: "Nordwind Logistics", description: "Logistik und Lagerlogistik, 3 Standorte", tags: ["managed", "logistics"] },
  { id: 102, name: "Klinik am Park", description: "Klinikverbund Berlin/Potsdam", tags: ["managed", "healthcare", "critical"] },
  { id: 103, name: "Stadtwerke Rhein", description: "Versorgungsbetrieb, OT-Netz", tags: ["managed", "utilities", "ot"] },
];

const locations: Location[] = [
  { id: 1001, organizationId: 101, name: "Hamburg · Zentrale", address: "Hafenstraße 12, Hamburg", tags: ["hq", "wan"] },
  { id: 1002, organizationId: 101, name: "Bremen · Depot", address: "Güterstraße 4, Bremen", tags: ["depot", "wan"] },
  { id: 1003, organizationId: 101, name: "Kiel · Lager", address: "Kaistraße 9, Kiel", tags: ["warehouse"] },
  { id: 1011, organizationId: 102, name: "Berlin · Campus", address: "Parkallee 20, Berlin", tags: ["campus", "clinical"] },
  { id: 1012, organizationId: 102, name: "Potsdam · Klinik", address: "Lindenstraße 3, Potsdam", tags: ["clinical"] },
  { id: 1021, organizationId: 103, name: "Duisburg · Netz", address: "Werkstraße 88, Duisburg", tags: ["ot", "grid"] },
  { id: 1022, organizationId: 103, name: "Bonn · Pumpwerk", address: "Rheinufer 7, Bonn", tags: ["ot", "pump"] },
];

const policies: Policy[] = [
  { id: 900, name: "Baseline · Windows Server", description: "Standard-Monitoring für Windows-Server", nodeClass: "WINDOWS_SERVER", nodeClassDefault: true, tags: ["baseline"] },
  { id: 901, name: "Baseline · Windows Workstation", description: "Standard-Monitoring für Arbeitsplätze", nodeClass: "WINDOWS_WORKSTATION", nodeClassDefault: true, tags: ["baseline"] },
  { id: 902, name: "NMS · Network Core", description: "Switches, Router, Firewalls", nodeClass: "NMS_SWITCH", nodeClassDefault: true, tags: ["network"] },
  { id: 903, name: "VMware · Host", description: "ESXi-Hosts", nodeClass: "VMWARE_VM_HOST", nodeClassDefault: true, tags: ["virtualization"] },
  { id: 904, name: "VMware · Guest", description: "Virtuelle Maschinen", nodeClass: "VMWARE_VM_GUEST", nodeClassDefault: true, tags: ["virtualization"] },
  { id: 905, name: "Nordwind · Bremen Standort", description: "Standort-Overrides Bremen", nodeClass: "WINDOWS_SERVER", nodeClassDefault: false, tags: ["override"] },
  { id: 906, name: "Klinik · PACS", description: "PACS-Server mit erhöhten Schwellwerten", nodeClass: "WINDOWS_SERVER", nodeClassDefault: false, tags: ["clinical"] },
  { id: 907, name: "Stadtwerke · OT-Netz", description: "OT-Switches und SNMP", nodeClass: "NMS_SWITCH", nodeClassDefault: false, tags: ["ot"] },
  { id: 908, name: "Nordwind · Kiel Backup", description: "Backup-Fenster Kiel", nodeClass: "WINDOWS_SERVER", nodeClassDefault: false, tags: ["backup"] },
];

const orgMap = new Map(organizations.map((entry) => [entry.id, entry]));
const locationMap = new Map(locations.map((entry) => [entry.id, entry]));
const policyMap = new Map(policies.map((entry) => [entry.id, entry]));

function isNetworkInfrastructure(nodeClass: string): boolean {
  return /NMS_(SWITCH|ROUTER|FIREWALL|PRIVATE_NETWORK_GATEWAY|APPLIANCE)/.test(nodeClass);
}

function makeDevice(input: Omit<Device, "organizationName" | "locationName" | "nodeGroup" | "isNetworkDevice" | "isVirtualHost" | "isVirtualGuest">): Device {
  const organization = orgMap.get(input.organizationId);
  const location = locationMap.get(input.locationId);
  const nodeClass = input.nodeClass.toUpperCase();
  return {
    ...input,
    organizationName: organization?.name ?? "Unbekannt",
    locationName: location?.name ?? "Unbekannt",
    nodeGroup: nodeGroupForNodeClass(input.nodeClass),
    isNetworkDevice: isNetworkInfrastructure(nodeClass),
    isVirtualHost: nodeClass.includes("VM_HOST") || nodeClass.includes("HYPERV_VMM_HOST"),
    isVirtualGuest: nodeClass.includes("VM_GUEST") || nodeClass.includes("HYPERV_VMM_GUEST"),
  };
}

function buildDevices(now: number): Device[] {
  const online = (offset: number) => now - offset * MINUTE;
  return [
    // Nordwind Hamburg
    makeDevice({ id: 101, organizationId: 101, locationId: 1001, displayName: "SRV-DC01", systemName: "SRV-DC01", nodeClass: "WINDOWS_SERVER", os: "Windows Server 2022", role: "Domain Controller", offline: false, lastContact: online(2), lastUpdate: online(2), maintenance: false, tags: ["prod", "hamburg", "domain"], ip: "10.10.1.10", policyId: 900, policyName: "Baseline · Windows Server" }),
    makeDevice({ id: 102, organizationId: 101, locationId: 1001, displayName: "SRV-FILE01", systemName: "SRV-FILE01", nodeClass: "WINDOWS_SERVER", os: "Windows Server 2019", role: "File Server", offline: true, lastContact: online(42), lastUpdate: online(43), maintenance: false, tags: ["prod", "hamburg", "file"], ip: "10.10.1.11", policyId: 900, policyName: "Baseline · Windows Server" }),
    makeDevice({ id: 103, organizationId: 101, locationId: 1001, displayName: "SRV-SQL01", systemName: "SRV-SQL01", nodeClass: "WINDOWS_SERVER", os: "Windows Server 2022", role: "SQL Server", offline: false, lastContact: online(1), lastUpdate: online(1), maintenance: false, tags: ["prod", "hamburg", "sql"], ip: "10.10.1.12", policyId: 900, policyName: "Baseline · Windows Server" }),
    makeDevice({ id: 104, organizationId: 101, locationId: 1001, displayName: "SRV-ERP01", systemName: "srv-erp01", nodeClass: "LINUX_SERVER", os: "Ubuntu 24.04 LTS", role: "ERP Application", offline: false, lastContact: online(3), lastUpdate: online(3), maintenance: false, tags: ["prod", "hamburg", "erp"], ip: "10.10.1.20", policyId: 900, policyName: "Baseline · Windows Server" }),
    makeDevice({ id: 105, organizationId: 101, locationId: 1001, displayName: "SW-CORE-HH-01", systemName: "SW-CORE-HH-01", nodeClass: "NMS_SWITCH", os: "Cisco IOS-XE 17.9", role: "Core Switch", offline: false, lastContact: online(1), lastUpdate: online(1), maintenance: false, tags: ["prod", "hamburg", "network", "core"], ip: "10.10.1.2", policyId: 902, policyName: "NMS · Network Core" }),
    makeDevice({ id: 106, organizationId: 101, locationId: 1001, displayName: "FW-HH-01", systemName: "FW-HH-01", nodeClass: "NMS_FIREWALL", os: "FortiOS 7.4", role: "Firewall", offline: false, lastContact: online(1), lastUpdate: online(1), maintenance: false, tags: ["prod", "hamburg", "network", "wan"], ip: "10.10.1.1", publicIp: "203.0.113.10", policyId: 902, policyName: "NMS · Network Core" }),
    makeDevice({ id: 107, organizationId: 101, locationId: 1001, displayName: "WKS-ACC-01", systemName: "WKS-ACC-01", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: false, lastContact: online(4), lastUpdate: online(4), maintenance: false, tags: ["hamburg", "office"], ip: "10.10.1.101", policyId: 901, policyName: "Baseline · Windows Workstation" }),
    makeDevice({ id: 108, organizationId: 101, locationId: 1001, displayName: "WKS-ACC-02", systemName: "WKS-ACC-02", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: false, lastContact: online(5), lastUpdate: online(5), maintenance: false, tags: ["hamburg", "office"], ip: "10.10.1.102", policyId: 901, policyName: "Baseline · Windows Workstation" }),
    makeDevice({ id: 109, organizationId: 101, locationId: 1001, displayName: "ESX-HH-01", systemName: "esx-hh-01", nodeClass: "VMWARE_VM_HOST", os: "VMware ESXi 8.0", role: "VM Host", offline: false, lastContact: online(2), lastUpdate: online(2), maintenance: false, tags: ["prod", "hamburg", "vm"], ip: "10.10.2.10", policyId: 903, policyName: "VMware · Host" }),
    makeDevice({ id: 110, organizationId: 101, locationId: 1001, parentDeviceId: 109, displayName: "VM-APP-01", systemName: "vm-app-01", nodeClass: "VMWARE_VM_GUEST", os: "Windows Server 2022", role: "Application VM", offline: false, lastContact: online(3), lastUpdate: online(3), maintenance: false, tags: ["prod", "hamburg", "vm"], ip: "10.10.2.21", policyId: 904, policyName: "VMware · Guest" }),
    makeDevice({ id: 111, organizationId: 101, locationId: 1001, parentDeviceId: 109, displayName: "VM-APP-02", systemName: "vm-app-02", nodeClass: "VMWARE_VM_GUEST", os: "Windows Server 2022", role: "Application VM", offline: false, lastContact: online(4), lastUpdate: online(4), maintenance: false, tags: ["prod", "hamburg", "vm"], ip: "10.10.2.22", policyId: 904, policyName: "VMware · Guest" }),
    makeDevice({ id: 112, organizationId: 101, locationId: 1001, displayName: "PRN-HH-01", systemName: "PRN-HH-01", nodeClass: "NMS_PRINTER", os: "JetDirect", role: "Printer", offline: false, lastContact: online(6), lastUpdate: online(6), maintenance: false, tags: ["hamburg", "printer"], ip: "10.10.1.50", policyId: 902, policyName: "NMS · Network Core" }),

    // Nordwind Bremen (WAN incident)
    makeDevice({ id: 120, organizationId: 101, locationId: 1002, displayName: "FW-BRE-01", systemName: "FW-BRE-01", nodeClass: "NMS_FIREWALL", os: "FortiOS 7.4", role: "Firewall", offline: true, lastContact: online(18), lastUpdate: online(18), maintenance: false, tags: ["prod", "bremen", "network", "wan"], ip: "10.20.1.1", publicIp: "198.51.100.20", policyId: 902, policyName: "NMS · Network Core" }),
    makeDevice({ id: 121, organizationId: 101, locationId: 1002, displayName: "SW-BRE-01", systemName: "SW-BRE-01", nodeClass: "NMS_SWITCH", os: "Cisco IOS-XE 17.9", role: "Access Switch", offline: true, lastContact: online(18), lastUpdate: online(18), maintenance: false, tags: ["prod", "bremen", "network"], ip: "10.20.1.2", policyId: 902, policyName: "NMS · Network Core" }),
    makeDevice({ id: 122, organizationId: 101, locationId: 1002, displayName: "SRV-BRE-FILE", systemName: "SRV-BRE-FILE", nodeClass: "WINDOWS_SERVER", os: "Windows Server 2019", role: "File Server", offline: true, lastContact: online(17), lastUpdate: online(18), maintenance: false, tags: ["prod", "bremen", "file"], ip: "10.20.1.10", policyId: 905, policyName: "Nordwind · Bremen Standort" }),
    makeDevice({ id: 123, organizationId: 101, locationId: 1002, displayName: "SRV-BRE-ERP", systemName: "srv-bre-erp", nodeClass: "LINUX_SERVER", os: "Ubuntu 24.04 LTS", role: "ERP Application", offline: true, lastContact: online(17), lastUpdate: online(17), maintenance: false, tags: ["prod", "bremen", "erp"], ip: "10.20.1.11", policyId: 905, policyName: "Nordwind · Bremen Standort" }),
    makeDevice({ id: 124, organizationId: 101, locationId: 1002, displayName: "WKS-BRE-01", systemName: "WKS-BRE-01", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: true, lastContact: online(16), lastUpdate: online(16), maintenance: false, tags: ["bremen", "office"], ip: "10.20.1.101", policyId: 901, policyName: "Baseline · Windows Workstation" }),
    makeDevice({ id: 125, organizationId: 101, locationId: 1002, displayName: "WKS-BRE-02", systemName: "WKS-BRE-02", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: true, lastContact: online(16), lastUpdate: online(16), maintenance: false, tags: ["bremen", "office"], ip: "10.20.1.102", policyId: 901, policyName: "Baseline · Windows Workstation" }),
    makeDevice({ id: 126, organizationId: 101, locationId: 1002, displayName: "WKS-BRE-03", systemName: "WKS-BRE-03", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: true, lastContact: online(15), lastUpdate: online(15), maintenance: false, tags: ["bremen", "office"], ip: "10.20.1.103", policyId: 901, policyName: "Baseline · Windows Workstation" }),
    makeDevice({ id: 127, organizationId: 101, locationId: 1002, displayName: "PRN-BRE-01", systemName: "PRN-BRE-01", nodeClass: "NMS_PRINTER", os: "JetDirect", role: "Printer", offline: true, lastContact: online(15), lastUpdate: online(15), maintenance: false, tags: ["bremen", "printer"], ip: "10.20.1.50", policyId: 902, policyName: "NMS · Network Core" }),

    // Nordwind Kiel
    makeDevice({ id: 130, organizationId: 101, locationId: 1003, displayName: "SW-KIEL-01", systemName: "SW-KIEL-01", nodeClass: "NMS_SWITCH", os: "Cisco IOS-XE 17.9", role: "Access Switch", offline: false, lastContact: online(2), lastUpdate: online(2), maintenance: false, tags: ["kiel", "network"], ip: "10.30.1.2", policyId: 902, policyName: "NMS · Network Core" }),
    makeDevice({ id: 131, organizationId: 101, locationId: 1003, displayName: "SRV-KIEL-BACKUP", systemName: "SRV-KIEL-BACKUP", nodeClass: "WINDOWS_SERVER", os: "Windows Server 2022", role: "Backup Server", offline: false, lastContact: online(3), lastUpdate: online(3), maintenance: false, tags: ["kiel", "backup"], ip: "10.30.1.10", policyId: 908, policyName: "Nordwind · Kiel Backup" }),
    makeDevice({ id: 132, organizationId: 101, locationId: 1003, displayName: "WKS-KIEL-01", systemName: "WKS-KIEL-01", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: true, lastContact: online(25), lastUpdate: online(25), maintenance: false, tags: ["kiel", "office"], ip: "10.30.1.101", policyId: 901, policyName: "Baseline · Windows Workstation" }),
    makeDevice({ id: 133, organizationId: 101, locationId: 1003, displayName: "NAS-KIEL-01", systemName: "nas-kiel-01", nodeClass: "LINUX_SERVER", os: "TrueNAS 13", role: "NAS", offline: false, lastContact: online(4), lastUpdate: online(4), maintenance: false, tags: ["kiel", "storage"], ip: "10.30.1.20", policyId: 900, policyName: "Baseline · Windows Server" }),

    // Klinik Berlin
    makeDevice({ id: 140, organizationId: 102, locationId: 1011, displayName: "ESX-BER-01", systemName: "esx-ber-01", nodeClass: "VMWARE_VM_HOST", os: "VMware ESXi 8.0", role: "VM Host", offline: false, lastContact: online(2), lastUpdate: online(2), maintenance: false, tags: ["prod", "berlin", "vm", "clinical"], ip: "10.40.2.10", policyId: 903, policyName: "VMware · Host" }),
    makeDevice({ id: 141, organizationId: 102, locationId: 1011, displayName: "ESX-BER-02", systemName: "esx-ber-02", nodeClass: "VMWARE_VM_HOST", os: "VMware ESXi 8.0", role: "VM Host", offline: true, lastContact: online(12), lastUpdate: online(12), maintenance: false, tags: ["prod", "berlin", "vm", "clinical"], ip: "10.40.2.11", policyId: 903, policyName: "VMware · Host" }),
    makeDevice({ id: 142, organizationId: 102, locationId: 1011, parentDeviceId: 141, displayName: "VM-CLIN-01", systemName: "vm-clin-01", nodeClass: "VMWARE_VM_GUEST", os: "Windows Server 2022", role: "Clinical App", offline: true, lastContact: online(11), lastUpdate: online(11), maintenance: false, tags: ["prod", "berlin", "vm", "clinical"], ip: "10.40.2.21", policyId: 904, policyName: "VMware · Guest" }),
    makeDevice({ id: 143, organizationId: 102, locationId: 1011, parentDeviceId: 141, displayName: "VM-CLIN-02", systemName: "vm-clin-02", nodeClass: "VMWARE_VM_GUEST", os: "Windows Server 2022", role: "Clinical App", offline: true, lastContact: online(11), lastUpdate: online(11), maintenance: false, tags: ["prod", "berlin", "vm", "clinical"], ip: "10.40.2.22", policyId: 904, policyName: "VMware · Guest" }),
    makeDevice({ id: 144, organizationId: 102, locationId: 1011, parentDeviceId: 141, displayName: "VM-CLIN-03", systemName: "vm-clin-03", nodeClass: "VMWARE_VM_GUEST", os: "Windows Server 2022", role: "Test VM", offline: true, lastContact: online(10), lastUpdate: online(10), maintenance: false, tags: ["test", "berlin", "vm"], ip: "10.40.2.23", policyId: 904, policyName: "VMware · Guest" }),
    makeDevice({ id: 145, organizationId: 102, locationId: 1011, displayName: "SRV-PACS-01", systemName: "SRV-PACS-01", nodeClass: "WINDOWS_SERVER", os: "Windows Server 2022", role: "PACS Server", offline: false, lastContact: online(1), lastUpdate: online(1), maintenance: false, tags: ["prod", "berlin", "pacs", "clinical"], ip: "10.40.1.10", policyId: 906, policyName: "Klinik · PACS" }),
    makeDevice({ id: 146, organizationId: 102, locationId: 1011, displayName: "SW-BER-01", systemName: "SW-BER-01", nodeClass: "NMS_SWITCH", os: "Cisco IOS-XE 17.9", role: "Core Switch", offline: false, lastContact: online(1), lastUpdate: online(1), maintenance: false, tags: ["berlin", "network", "core"], ip: "10.40.1.2", policyId: 902, policyName: "NMS · Network Core" }),
    makeDevice({ id: 147, organizationId: 102, locationId: 1011, displayName: "WKS-BER-01", systemName: "WKS-BER-01", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: false, lastContact: online(4), lastUpdate: online(4), maintenance: false, tags: ["berlin", "office"], ip: "10.40.1.101", policyId: 901, policyName: "Baseline · Windows Workstation" }),
    makeDevice({ id: 148, organizationId: 102, locationId: 1011, displayName: "WKS-BER-02", systemName: "WKS-BER-02", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: false, lastContact: online(6), lastUpdate: online(6), maintenance: false, tags: ["berlin", "office"], ip: "10.40.1.102", policyId: 901, policyName: "Baseline · Windows Workstation" }),

    // Klinik Potsdam
    makeDevice({ id: 150, organizationId: 102, locationId: 1012, displayName: "SRV-POT-01", systemName: "SRV-POT-01", nodeClass: "WINDOWS_SERVER", os: "Windows Server 2022", role: "File Server", offline: false, lastContact: online(2), lastUpdate: online(2), maintenance: false, tags: ["potsdam", "file"], ip: "10.41.1.10", policyId: 900, policyName: "Baseline · Windows Server" }),
    makeDevice({ id: 151, organizationId: 102, locationId: 1012, displayName: "WKS-POT-01", systemName: "WKS-POT-01", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: false, lastContact: online(5), lastUpdate: online(5), maintenance: false, tags: ["potsdam", "office"], ip: "10.41.1.101", policyId: 901, policyName: "Baseline · Windows Workstation" }),
    makeDevice({ id: 152, organizationId: 102, locationId: 1012, displayName: "PRN-POT-01", systemName: "PRN-POT-01", nodeClass: "NMS_PRINTER", os: "JetDirect", role: "Printer", offline: false, lastContact: online(8), lastUpdate: online(8), maintenance: false, tags: ["potsdam", "printer"], ip: "10.41.1.50", policyId: 902, policyName: "NMS · Network Core" }),

    // Stadtwerke Duisburg
    makeDevice({ id: 160, organizationId: 103, locationId: 1021, displayName: "SW-DUI-01", systemName: "SW-DUI-01", nodeClass: "NMS_SWITCH", os: "Hirschmann HiOS", role: "OT Switch", offline: false, lastContact: online(1), lastUpdate: online(1), maintenance: false, tags: ["duisburg", "network", "ot"], ip: "10.50.1.2", policyId: 907, policyName: "Stadtwerke · OT-Netz" }),
    makeDevice({ id: 161, organizationId: 103, locationId: 1021, displayName: "SRV-GRID-01", systemName: "SRV-GRID-01", nodeClass: "WINDOWS_SERVER", os: "Windows Server 2019", role: "Grid Control", offline: false, lastContact: online(3), lastUpdate: online(3), maintenance: false, tags: ["duisburg", "ot", "grid"], ip: "10.50.1.10", policyId: 900, policyName: "Baseline · Windows Server" }),
    makeDevice({ id: 162, organizationId: 103, locationId: 1021, displayName: "SRV-GRID-02", systemName: "srv-grid-02", nodeClass: "LINUX_SERVER", os: "Debian 12", role: "Telemetry", offline: false, lastContact: online(4), lastUpdate: online(4), maintenance: false, tags: ["duisburg", "ot", "telemetry"], ip: "10.50.1.11", policyId: 900, policyName: "Baseline · Windows Server" }),
    makeDevice({ id: 163, organizationId: 103, locationId: 1021, displayName: "WKS-DUI-01", systemName: "WKS-DUI-01", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: false, lastContact: online(7), lastUpdate: online(7), maintenance: false, tags: ["duisburg", "office"], ip: "10.50.1.101", policyId: 901, policyName: "Baseline · Windows Workstation" }),

    // Stadtwerke Bonn
    makeDevice({ id: 170, organizationId: 103, locationId: 1022, displayName: "SW-BON-01", systemName: "SW-BON-01", nodeClass: "NMS_SWITCH", os: "Hirschmann HiOS", role: "OT Switch", offline: false, lastContact: online(1), lastUpdate: online(1), maintenance: false, tags: ["bonn", "network", "ot"], ip: "10.51.1.2", policyId: 907, policyName: "Stadtwerke · OT-Netz" }),
    makeDevice({ id: 171, organizationId: 103, locationId: 1022, displayName: "SRV-PUMP-01", systemName: "srv-pump-01", nodeClass: "LINUX_SERVER", os: "Debian 12", role: "Pump Control", offline: false, lastContact: online(2), lastUpdate: online(2), maintenance: false, tags: ["bonn", "ot", "pump"], ip: "10.51.1.10", policyId: 900, policyName: "Baseline · Windows Server" }),
    makeDevice({ id: 172, organizationId: 103, locationId: 1022, displayName: "WKS-BON-01", systemName: "WKS-BON-01", nodeClass: "WINDOWS_WORKSTATION", os: "Windows 11 Pro", role: "Workstation", offline: false, lastContact: online(9), lastUpdate: online(9), maintenance: false, tags: ["bonn", "office"], ip: "10.51.1.101", policyId: 901, policyName: "Baseline · Windows Workstation" }),
  ];
}

function makeAlert(input: Omit<Alert, "category"> & { category?: Alert["category"] }): Alert {
  return {
    ...input,
    category: input.category ?? categoryForSourceType(input.sourceType),
  };
}

function buildAlerts(now: number): Alert[] {
  const ago = (minutes: number) => now - minutes * MINUTE;
  return [
    // Bremen WAN incident
    makeAlert({ uid: "a-bremen-fw", deviceId: 120, message: "FW-BRE-01 antwortet nicht auf Ping (5/5 verloren).", subject: "Device Down", sourceType: "CONDITION_PING_RESPONSE", sourceName: "Device Down", sourceConfigUid: "cfg-nms-device-down", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(18), updatedAt: ago(18), acknowledged: false, data: { packetLoss: 100, attempts: 5 }, tags: ["bremen", "wan"] }),
    makeAlert({ uid: "a-bremen-sw", deviceId: 121, message: "SW-BRE-01: SNMP nicht erreichbar, Gerät gilt als offline.", subject: "Device Down", sourceType: "CONDITION_NMS_NETWORK_STATUS", sourceName: "Device Down", sourceConfigUid: "cfg-nms-device-down", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(18), updatedAt: ago(18), acknowledged: false, data: { status: "down" }, tags: ["bremen", "network"] }),
    makeAlert({ uid: "a-bremen-srv-file", deviceId: 122, message: "Agent hat seit 17 Minuten keinen Kontakt.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(17), updatedAt: ago(17), acknowledged: false, data: {}, tags: ["bremen"] }),
    makeAlert({ uid: "a-bremen-srv-erp", deviceId: 123, message: "Agent hat seit 17 Minuten keinen Kontakt.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(17), updatedAt: ago(17), acknowledged: false, data: {}, tags: ["bremen"] }),
    makeAlert({ uid: "a-bremen-wks1", deviceId: 124, message: "Agent hat seit 16 Minuten keinen Kontakt.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(16), updatedAt: ago(16), acknowledged: false, data: {}, tags: ["bremen"] }),
    makeAlert({ uid: "a-bremen-wks2", deviceId: 125, message: "Agent hat seit 16 Minuten keinen Kontakt.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(16), updatedAt: ago(16), acknowledged: false, data: {}, tags: ["bremen"] }),
    makeAlert({ uid: "a-bremen-wks3", deviceId: 126, message: "Agent hat seit 15 Minuten keinen Kontakt.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(15), updatedAt: ago(15), acknowledged: false, data: {}, tags: ["bremen"] }),
    makeAlert({ uid: "a-bremen-prn", deviceId: 127, message: "PRN-BRE-01 antwortet nicht auf Ping.", subject: "Ping Response", sourceType: "CONDITION_PING_RESPONSE", sourceName: "Ping Response", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(15), updatedAt: ago(15), acknowledged: false, data: {}, tags: ["bremen"] }),
    makeAlert({ uid: "a-bremen-http", deviceId: 123, message: "Intranet-Portal nicht erreichbar (HTTP 000).", subject: "HTTP Check", sourceType: "CONDITION_HTTP", sourceName: "Bremen Intranet", sourceConfigUid: "cfg-bre-http", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(14), updatedAt: ago(14), acknowledged: false, data: { statusCode: 0, url: "https://intranet.nordwind.local" }, tags: ["bremen", "http"] }),
    makeAlert({ uid: "a-bremen-pingloss", deviceId: 121, message: "SW-BRE-01: 100 % Paketverlust über 5 Minuten.", subject: "Ping Packet Loss", sourceType: "CONDITION_PING_PACKET_LOSS", sourceName: "Ping Packet Loss", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(13), updatedAt: ago(13), acknowledged: false, data: { packetLossPercent: 100 }, tags: ["bremen", "network"] }),
    makeAlert({ uid: "a-bremen-port", deviceId: 120, message: "Port 443 auf FW-BRE-01 nicht erreichbar.", subject: "Port Check", sourceType: "CONDITION_PORT", sourceName: "WAN Port 443", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(12), updatedAt: ago(12), acknowledged: false, data: { port: 443 }, tags: ["bremen", "wan"] }),
    makeAlert({ uid: "a-bremen-file-disk", deviceId: 122, message: "D: nur noch 8 % frei (letzter Stand vor dem Ausfall).", subject: "Disk Free Space", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", sourceName: "Disk Free Space", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(30), updatedAt: ago(30), acknowledged: false, data: { freePercent: 8, volume: "D:" }, tags: ["bremen", "storage"] }),
    makeAlert({ uid: "a-bremen-erp-cpu", deviceId: 123, message: "CPU 96 % über 15 Minuten (letzter Stand).", subject: "CPU", sourceType: "CONDITION_AGENT_CPU", sourceName: "CPU", severity: "MODERATE", ninjaPriority: "MEDIUM", createdAt: ago(20), updatedAt: ago(20), acknowledged: false, data: { cpuPercent: 96 }, tags: ["bremen", "erp"] }),
    makeAlert({ uid: "a-bremen-wks1-disk", deviceId: 124, message: "C: 9 % frei (letzter Stand).", subject: "Disk Free Space", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", sourceName: "Disk Free Space", severity: "MODERATE", ninjaPriority: "LOW", createdAt: ago(25), updatedAt: ago(25), acknowledged: false, data: { freePercent: 9, volume: "C:" }, tags: ["bremen"] }),
    makeAlert({ uid: "a-bremen-erp-service", deviceId: 123, message: "Dienst „erp-worker“ ist gestoppt.", subject: "Windows Service", sourceType: "CONDITION_WINDOWS_SERVICE_STATE_CHANGED", sourceName: "ERP Worker", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(16), updatedAt: ago(16), acknowledged: false, data: { service: "erp-worker", state: "stopped" }, tags: ["bremen", "erp"] }),
    makeAlert({ uid: "a-bremen-wks2-cpu", deviceId: 125, message: "CPU 97 % über 20 Minuten (letzter Stand).", subject: "CPU", sourceType: "CONDITION_AGENT_CPU", sourceName: "CPU", severity: "MODERATE", ninjaPriority: "LOW", createdAt: ago(15), updatedAt: ago(15), acknowledged: false, data: { cpuPercent: 97 }, tags: ["bremen"] }),

    // Hamburg / Kiel
    makeAlert({ uid: "a-hh-file-offline", deviceId: 102, message: "Agent hat seit 42 Minuten keinen Kontakt.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(42), updatedAt: ago(42), acknowledged: false, data: {}, tags: ["hamburg", "file"] }),
    makeAlert({ uid: "a-hh-file-disk", deviceId: 102, message: "C: nur noch 4 % frei (18,2 GB von 480 GB).", subject: "Disk Free Space", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", sourceName: "Disk Free Space", sourceConfigUid: "cfg-disk-critical", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(40), updatedAt: ago(40), acknowledged: false, data: { freePercent: 4, freeGb: 18.2, volume: "C:" }, tags: ["hamburg", "file"] }),
    makeAlert({ uid: "a-hh-dc-smart", deviceId: 101, message: "SMART-Status von Disk 0 ist degraded (Predictive Failure).", subject: "SMART Status", sourceType: "CONDITION_SMART_STATUS_DEGRADED", sourceName: "SMART Status", sourceConfigUid: "cfg-smart", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(25), updatedAt: ago(25), acknowledged: false, data: { disk: "Disk 0", status: "degraded" }, tags: ["hamburg", "hardware"] }),
    makeAlert({ uid: "a-hh-sql-spooler", deviceId: 103, message: "Dienst „Spooler“ ist gestoppt.", subject: "Windows Service", sourceType: "CONDITION_WINDOWS_SERVICE_STATE_CHANGED", sourceName: "Spooler", sourceConfigUid: "cfg-spooler", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(12), updatedAt: ago(12), acknowledged: false, data: { service: "Spooler", state: "stopped" }, tags: ["hamburg", "services"] }),
    makeAlert({ uid: "a-hh-erp-disk", deviceId: 104, message: "/var: 9 % frei (7,1 GB von 80 GB).", subject: "Disk Free Space", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", sourceName: "Disk Free Space", sourceConfigUid: "cfg-disk-warning", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(35), updatedAt: ago(35), acknowledged: false, data: { freePercent: 9, freeGb: 7.1, volume: "/var" }, tags: ["hamburg", "erp"] }),
    makeAlert({ uid: "a-hh-sql-cpu", deviceId: 103, message: "CPU-Auslastung 94 % über 15 Minuten.", subject: "CPU", sourceType: "CONDITION_AGENT_CPU", sourceName: "CPU", sourceConfigUid: "cfg-cpu", severity: "MODERATE", ninjaPriority: "MEDIUM", createdAt: ago(8), updatedAt: ago(8), acknowledged: false, data: { cpuPercent: 94 }, tags: ["hamburg", "sql"] }),
    makeAlert({ uid: "a-hh-wks-event", deviceId: 107, message: "Windows Event 4625: 14 fehlgeschlagene Anmeldungen in 10 Minuten.", subject: "Windows Event", sourceType: "CONDITION_WINDOWS_EVENT_LOG_TRIGGERED", sourceName: "Failed Logon", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(20), updatedAt: ago(20), acknowledged: false, data: { eventId: 4625, count: 14 }, tags: ["hamburg", "security"] }),
    makeAlert({ uid: "a-hh-wks-av", deviceId: 108, message: "Bedrohung in Quarantäne: Trojan.Win32.Agent.", subject: "AV Quarantine", sourceType: "AV_QUARANTINE_THREAT", sourceName: "Antivirus", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(6), updatedAt: ago(6), acknowledged: false, data: { threat: "Trojan.Win32.Agent", action: "quarantined" }, tags: ["hamburg", "security"] }),
    makeAlert({ uid: "a-hh-core-port", deviceId: 105, message: "Port Gi1/0/24 hat Status DOWN erreicht.", subject: "Network Adapter Status", sourceType: "CONDITION_NMS_NETWORK_STATUS_CHANGE", sourceName: "Port Gi1/0/24", sourceConfigUid: "cfg-port24", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(22), updatedAt: ago(22), acknowledged: false, data: { port: "Gi1/0/24", state: "down" }, tags: ["hamburg", "network"] }),
    makeAlert({ uid: "a-hh-vm-http", deviceId: 110, message: "Antwortzeit des App-Endpunkts 2,4 s (Schwelle 2,0 s).", subject: "HTTP Response", sourceType: "CONDITION_HTTP_RESPONSE", sourceName: "App Health", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(30), updatedAt: ago(30), acknowledged: false, data: { responseMs: 2400 }, tags: ["hamburg", "app"] }),
    makeAlert({ uid: "a-hh-dc-raid", deviceId: 101, message: "RAID-Controller 0 meldet Degraded.", subject: "RAID Health", sourceType: "CONDITION_RAID_HEALTH_STATUS", sourceName: "RAID Health", sourceConfigUid: "cfg-raid", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(50), updatedAt: ago(50), acknowledged: false, data: { controller: 0, state: "degraded" }, tags: ["hamburg", "hardware"] }),
    makeAlert({ uid: "a-kiel-backup", deviceId: 131, message: "Backup-Job „Kiel-Files“ ist fehlgeschlagen (Fehler 307).", subject: "Backup Job", sourceType: "SHADOWPROTECT_BACKUPJOB_UPDATE", sourceName: "Kiel-Files", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(180), updatedAt: ago(180), acknowledged: false, data: { job: "Kiel-Files", errorCode: 307 }, tags: ["kiel", "backup"] }),
    makeAlert({ uid: "a-kiel-wks-offline", deviceId: 132, message: "Agent hat seit 25 Minuten keinen Kontakt.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(25), updatedAt: ago(25), acknowledged: false, data: {}, tags: ["kiel"] }),
    makeAlert({ uid: "a-kiel-wks-disk", deviceId: 132, message: "C: nur noch 7 % frei.", subject: "Disk Free Space", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", sourceName: "Disk Free Space", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(23), updatedAt: ago(23), acknowledged: false, data: { freePercent: 7 }, tags: ["kiel"] }),
    makeAlert({ uid: "a-kiel-backup-duration", deviceId: 131, message: "Backup-Dauer 7 h 12 min (Schwelle 6 h).", subject: "Script Result", sourceType: "CONDITION_SCRIPT_RESULT", sourceName: "Backup Duration", severity: "MODERATE", ninjaPriority: "LOW", createdAt: ago(120), updatedAt: ago(120), acknowledged: false, data: { durationHours: 7.2 }, tags: ["kiel", "backup"] }),
    makeAlert({ uid: "a-hh-prn", deviceId: 112, message: "SNMP-Trap: Tonerstand kritisch.", subject: "SNMP Trap", sourceType: "CONDITION_SNMPTRAP", sourceName: "Printer Toner", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(60), updatedAt: ago(60), acknowledged: false, data: { oid: "1.3.6.1.2.1.43.11.1.1.9" }, tags: ["hamburg", "printer"] }),

    // Berlin / Potsdam
    makeAlert({ uid: "a-ber-esx", deviceId: 141, message: "ESX-BER-02 hat seit 12 Minuten keinen Kontakt.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(12), updatedAt: ago(12), acknowledged: false, data: {}, tags: ["berlin", "vm"] }),
    makeAlert({ uid: "a-ber-vm1", deviceId: 142, message: "VM-CLIN-01 ist offline.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(11), updatedAt: ago(11), acknowledged: false, data: {}, tags: ["berlin", "vm"] }),
    makeAlert({ uid: "a-ber-vm2", deviceId: 143, message: "VM-CLIN-02 ist offline.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(11), updatedAt: ago(11), acknowledged: false, data: {}, tags: ["berlin", "vm"] }),
    makeAlert({ uid: "a-ber-vm3", deviceId: 144, message: "VM-CLIN-03 ist offline.", subject: "Agent Offline", sourceType: "AGENT_OFFLINE", sourceName: "Device Down", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(10), updatedAt: ago(10), acknowledged: false, data: {}, tags: ["berlin", "vm"] }),
    makeAlert({ uid: "a-ber-vm-tools", deviceId: 142, message: "VMware Tools laufen auf VM-CLIN-01 nicht.", subject: "VM Tools", sourceType: "CONDITION_VM_GUEST_TOOLS_NOT_RUNNING", sourceName: "VMware Tools", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(9), updatedAt: ago(9), acknowledged: false, data: {}, tags: ["berlin", "vm"] }),
    makeAlert({ uid: "a-ber-vm2-snapshot", deviceId: 143, message: "Snapshot auf VM-CLIN-02 ist 9 Tage alt.", subject: "Snapshot Lifespan", sourceType: "CONDITION_VM_GUEST_SNAPSHOT_LIFESPAN", sourceName: "Snapshot Lifespan", severity: "MODERATE", ninjaPriority: "LOW", createdAt: ago(8), updatedAt: ago(8), acknowledged: false, data: { days: 9 }, tags: ["berlin", "vm"] }),
    makeAlert({ uid: "a-ber-vm3-snapshot", deviceId: 144, message: "Snapshot auf VM-CLIN-03 ist 120 GB groß.", subject: "Snapshot Size", sourceType: "CONDITION_VM_GUEST_SNAPSHOT_SIZE", sourceName: "Snapshot Size", severity: "MODERATE", ninjaPriority: "LOW", createdAt: ago(7), updatedAt: ago(7), acknowledged: false, data: { sizeGb: 120 }, tags: ["berlin", "vm"] }),
    makeAlert({ uid: "a-ber-pacs-disk", deviceId: 145, message: "PACS-Volume: 6 % frei (24 GB von 400 GB).", subject: "Disk Free Space", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", sourceName: "PACS Disk", sourceConfigUid: "cfg-pacs-disk", severity: "CRITICAL", ninjaPriority: "HIGH", createdAt: ago(30), updatedAt: ago(30), acknowledged: false, data: { freePercent: 6, freeGb: 24, volume: "PACS" }, tags: ["berlin", "pacs", "clinical"] }),
    makeAlert({ uid: "a-ber-pacs-mem", deviceId: 145, message: "Memory-Auslastung 91 % über 10 Minuten.", subject: "Memory", sourceType: "CONDITION_AGENT_MEMORY", sourceName: "Memory", severity: "MODERATE", ninjaPriority: "MEDIUM", createdAt: ago(20), updatedAt: ago(20), acknowledged: false, data: { memoryPercent: 91 }, tags: ["berlin", "pacs"] }),
    makeAlert({ uid: "a-ber-pacs-service", deviceId: 145, message: "Dienst „PACS-Archive“ ist gestoppt.", subject: "Windows Service", sourceType: "CONDITION_WINDOWS_SERVICE_STATE_CHANGED", sourceName: "PACS-Archive", severity: "MAJOR", ninjaPriority: "HIGH", createdAt: ago(15), updatedAt: ago(15), acknowledged: false, data: { service: "PACS-Archive", state: "stopped" }, tags: ["berlin", "pacs", "clinical"] }),
    makeAlert({ uid: "a-ber-sw-adapter", deviceId: 146, message: "Network Adapter Te1/0/1 Statuswechsel zu down.", subject: "Network Adapter Status", sourceType: "CONDITION_NMS_NETWORK_STATUS_CHANGE", sourceName: "Te1/0/1", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(40), updatedAt: ago(40), acknowledged: false, data: { port: "Te1/0/1", state: "down" }, tags: ["berlin", "network"] }),
    makeAlert({ uid: "a-ber-wks-battery", deviceId: 148, message: "Batteriegesundheit 54 % (Schwelle 60 %).", subject: "Battery Health", sourceType: "CONDITION_SCRIPT_RESULT", sourceName: "Battery Health", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(120), updatedAt: ago(120), acknowledged: false, data: { batteryHealthPercent: 54 }, tags: ["berlin", "endpoint"] }),
    makeAlert({ uid: "a-pot-backup", deviceId: 150, message: "Letzter erfolgreicher Backup-Lauf vor 52 Stunden.", subject: "Backup Last Success", sourceType: "SHADOWPROTECT_BACKUPJOB_UPDATE", sourceName: "Potsdam Backup", severity: "MODERATE", ninjaPriority: "LOW", createdAt: ago(360), updatedAt: ago(360), acknowledged: false, data: { hoursSinceSuccess: 52 }, tags: ["potsdam", "backup"] }),
    makeAlert({ uid: "a-pot-patch", deviceId: 151, message: "Sicherheitsupdate KB5040442 seit 4 Tagen ausstehend.", subject: "Software Missing", sourceType: "CONDITION_SOFTWARE", sourceName: "Patch Compliance", severity: "MAJOR", ninjaPriority: "MEDIUM", createdAt: ago(240), updatedAt: ago(240), acknowledged: false, data: { patch: "KB5040442", daysPending: 4 }, tags: ["potsdam", "patching"] }),

    // Stadtwerke
    makeAlert({ uid: "a-dui-syslog", deviceId: 160, message: "Syslog: Link flap auf Port 7 erkannt.", subject: "Syslog", sourceType: "CONDITION_SYSLOG", sourceName: "OT Switch Syslog", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(35), updatedAt: ago(35), acknowledged: false, data: { port: 7 }, tags: ["duisburg", "ot"] }),
    makeAlert({ uid: "a-dui-grid-ping", deviceId: 161, message: "Ping-Latenz 182 ms (Schwelle 150 ms).", subject: "Ping Latency", sourceType: "CONDITION_PING_LATENCY", sourceName: "Grid Latency", severity: "MODERATE", ninjaPriority: "LOW", createdAt: ago(18), updatedAt: ago(18), acknowledged: false, data: { latencyMs: 182 }, tags: ["duisburg", "grid"] }),
    makeAlert({ uid: "a-dui-grid-cpu", deviceId: 162, message: "CPU 88 % (kurzzeitig, flappt).", subject: "CPU", sourceType: "CONDITION_AGENT_CPU", sourceName: "CPU", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(10), updatedAt: ago(10), acknowledged: false, flapping: true, data: { cpuPercent: 88 }, tags: ["duisburg", "telemetry"] }),
    makeAlert({ uid: "a-bon-snmp", deviceId: 170, message: "SNMP-Trap: Pumpwerk-Druck außerhalb Toleranz.", subject: "SNMP Trap", sourceType: "CONDITION_SNMPTRAP", sourceName: "Pump Pressure", severity: "MINOR", ninjaPriority: "LOW", createdAt: ago(60), updatedAt: ago(60), acknowledged: false, data: { pressureBar: 4.1 }, tags: ["bonn", "pump"] }),
    makeAlert({ uid: "a-bon-pump-disk", deviceId: 171, message: "/data: 12 % frei.", subject: "Disk Free Space", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", sourceName: "Disk Free Space", severity: "MODERATE", ninjaPriority: "LOW", createdAt: ago(45), updatedAt: ago(45), acknowledged: false, data: { freePercent: 12 }, tags: ["bonn", "pump"] }),
  ];
}

function condition(input: Omit<Condition, "source"> & { source?: Condition["source"] }): Condition {
  return { ...input, source: input.source ?? "local-catalog" };
}

function buildConditions(now: number): Condition[] {
  const ago = (minutes: number) => now - minutes * MINUTE;
  const global = { scopeLevel: "global" as const };
  return [
    condition({ id: "c01", name: "CPU-Auslastung hoch", sourceType: "CONDITION_AGENT_CPU", category: "performance", description: "CPU über 90 % für 15 Minuten.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER", "LINUX_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "> 90 %", duration: "15 min", interval: "5 min", lastTriggeredAt: ago(8), triggerCount: 18, source: "ninjaone-activity", tags: ["baseline", "performance"] }),
    condition({ id: "c02", name: "Memory-Druck", sourceType: "CONDITION_AGENT_MEMORY", category: "performance", description: "Memory über 95 % für 10 Minuten.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER", "LINUX_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "> 95 %", duration: "10 min", interval: "5 min", lastTriggeredAt: ago(20), triggerCount: 11, tags: ["baseline"] }),
    condition({ id: "c03", name: "Freier Speicher Warnung", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", category: "storage", description: "Freier Speicher unter 10 %.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER", "LINUX_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "< 10 %", duration: "5 min", interval: "5 min", lastTriggeredAt: ago(35), triggerCount: 24, source: "ninjaone-activity", tags: ["baseline", "storage"] }),
    condition({ id: "c04", name: "Freier Speicher kritisch", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", category: "storage", description: "Freier Speicher unter 5 % – sofortige Aktion.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER", "LINUX_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "CRITICAL", priority: "P1", threshold: "< 5 %", duration: "1 min", interval: "1 min", lastTriggeredAt: ago(40), triggerCount: 12, source: "ninjaone-activity", tags: ["baseline", "storage", "critical"] }),
    condition({ id: "c05", name: "Windows-Dienst gestoppt", sourceType: "CONDITION_WINDOWS_SERVICE_STATE_CHANGED", category: "services", description: "Überwachte Dienste müssen laufen.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "Status = stopped", duration: "2 min", interval: "1 min", lastTriggeredAt: ago(12), triggerCount: 9, tags: ["baseline", "services"] }),
    condition({ id: "c06", name: "Kritische Events", sourceType: "CONDITION_CRITICAL_EVENT", category: "services", description: "Mehr als 5 kritische Events in 15 Minuten.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "> 5 Events", duration: "15 min", interval: "5 min", lastTriggeredAt: ago(300), triggerCount: 6, tags: ["baseline"] }),
    condition({ id: "c07", name: "SMART-Status degraded", sourceType: "CONDITION_SMART_STATUS_DEGRADED", category: "hardware", description: "Windows meldet einen SMART-Fehler.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "CRITICAL", priority: "P1", threshold: "Status != OK", duration: "sofort", interval: "15 min", lastTriggeredAt: ago(25), triggerCount: 3, source: "ninjaone-activity", tags: ["baseline", "hardware"] }),
    condition({ id: "c08", name: "RAID Health", sourceType: "CONDITION_RAID_HEALTH_STATUS", category: "hardware", description: "RAID-Controller nicht optimal.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "CRITICAL", priority: "P1", threshold: "State != optimal", duration: "sofort", interval: "15 min", lastTriggeredAt: ago(50), triggerCount: 4, tags: ["baseline", "hardware"] }),
    condition({ id: "c09", name: "Antivirus-Health", sourceType: "CONDITION_SCRIPT_RESULT", category: "security", description: "AV fehlt, inaktiv, veraltet oder doppelt installiert.", ...global, nodeGroup: "endpoint", nodeClasses: ["WINDOWS_WORKSTATION", "WINDOWS_SERVER"], policyId: 901, policyName: "Baseline · Windows Workstation", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "Health != OK", duration: "10 min", interval: "30 min", lastTriggeredAt: ago(1440), triggerCount: 5, tags: ["baseline", "security"] }),
    condition({ id: "c10", name: "Backup Last Success", sourceType: "SHADOWPROTECT_BACKUPJOB_UPDATE", category: "backup", description: "Letzter erfolgreicher Lauf älter als 24 Stunden.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "> 24 h", duration: "sofort", interval: "1 h", lastTriggeredAt: ago(360), triggerCount: 7, tags: ["baseline", "backup"] }),
    condition({ id: "c11", name: "Patch CVSS kritisch", sourceType: "CONDITION_SOFTWARE", category: "patching", description: "Offener Patch mit CVSS ≥ 9 für 3 Tage.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER", "LINUX_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "CVSS ≥ 9, 3 Tage", duration: "3 Tage", interval: "6 h", lastTriggeredAt: ago(240), triggerCount: 4, tags: ["baseline", "patching"] }),
    condition({ id: "c12", name: "Reboot ausstehend", sourceType: "CONDITION_SCRIPT_RESULT", category: "performance", description: "Reboot seit mehr als 7 Tagen ausstehend.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MINOR", priority: "P4", threshold: "> 7 Tage", duration: "1 Tag", interval: "1 h", triggerCount: 14, tags: ["baseline"] }),
    condition({ id: "c13", name: "Fehlgeschlagene Anmeldungen", sourceType: "CONDITION_WINDOWS_EVENT_LOG_TRIGGERED", category: "security", description: "Event 4625 häufiger als 10-mal in 10 Minuten.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "Event 4625 > 10", duration: "10 min", interval: "5 min", lastTriggeredAt: ago(20), triggerCount: 2, tags: ["baseline", "security"] }),
    condition({ id: "c14", name: "Custom Script Result", sourceType: "CONDITION_SCRIPT_RESULT", category: "custom", description: "Exit-Code oder Output eines Prüfskripts.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER", "LINUX_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "Exit ≠ 0", duration: "sofort", interval: "15 min", triggerCount: 3, tags: ["custom"] }),
    condition({ id: "c15", name: "System-Uptime", sourceType: "CONDITION_SYSTEM_UPTIME", category: "performance", description: "Uptime über 90 Tage.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER", "LINUX_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: true, severity: "MINOR", priority: "P4", threshold: "> 90 Tage", duration: "1 Tag", interval: "6 h", triggerCount: 8, tags: ["baseline"] }),
    condition({ id: "c16", name: "Workstation CPU", sourceType: "CONDITION_AGENT_CPU", category: "performance", description: "CPU über 95 % für 20 Minuten.", ...global, nodeGroup: "endpoint", nodeClasses: ["WINDOWS_WORKSTATION"], policyId: 901, policyName: "Baseline · Windows Workstation", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "> 95 %", duration: "20 min", interval: "5 min", triggerCount: 6, tags: ["baseline"] }),
    condition({ id: "c17", name: "Workstation Disk", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", category: "storage", description: "Freier Speicher unter 8 %.", ...global, nodeGroup: "endpoint", nodeClasses: ["WINDOWS_WORKSTATION"], policyId: 901, policyName: "Baseline · Windows Workstation", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "< 8 %", duration: "10 min", interval: "10 min", lastTriggeredAt: ago(23), triggerCount: 5, tags: ["baseline", "storage"] }),
    condition({ id: "c18", name: "AV-Bedrohung", sourceType: "AV_QUARANTINE_THREAT", category: "security", description: "Aktive oder quarantänisierte Bedrohung.", ...global, nodeGroup: "endpoint", nodeClasses: ["WINDOWS_WORKSTATION", "WINDOWS_SERVER"], policyId: 901, policyName: "Baseline · Windows Workstation", inherited: false, enabled: true, severity: "CRITICAL", priority: "P1", threshold: "Threat detected", duration: "sofort", interval: "sofort", lastTriggeredAt: ago(6), triggerCount: 2, source: "ninjaone-activity", tags: ["security", "critical"] }),
    condition({ id: "c19", name: "Batteriegesundheit", sourceType: "CONDITION_SCRIPT_RESULT", category: "hardware", description: "Batteriegesundheit unter 60 %.", ...global, nodeGroup: "endpoint", nodeClasses: ["WINDOWS_WORKSTATION", "MAC"], policyId: 901, policyName: "Baseline · Windows Workstation", inherited: false, enabled: true, severity: "MINOR", priority: "P4", threshold: "< 60 %", duration: "sofort", interval: "1 Tag", lastTriggeredAt: ago(120), triggerCount: 3, tags: ["hardware"] }),
    condition({ id: "c20", name: "Software fehlt", sourceType: "CONDITION_SOFTWARE", category: "patching", description: "Pflichtsoftware nicht installiert.", ...global, nodeGroup: "endpoint", nodeClasses: ["WINDOWS_WORKSTATION"], policyId: 901, policyName: "Baseline · Windows Workstation", inherited: false, enabled: true, severity: "MINOR", priority: "P4", threshold: "Software != vorhanden", duration: "1 Tag", interval: "1 Tag", triggerCount: 2, tags: ["compliance"] }),
    condition({ id: "c21", name: "NMS Device Down", sourceType: "CONDITION_PING_RESPONSE", category: "network", description: "Gerät antwortet nicht auf Ping (NMS).", ...global, nodeGroup: "network", nodeClasses: ["NMS_SWITCH", "NMS_ROUTER", "NMS_FIREWALL", "NMS_PRINTER", "NMS_WAP"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "CRITICAL", priority: "P1", threshold: "5/5 verloren", duration: "3 min", interval: "1 min", lastTriggeredAt: ago(18), triggerCount: 9, source: "ninjaone-activity", tags: ["network", "critical"] }),
    condition({ id: "c22", name: "Ping Packet Loss", sourceType: "CONDITION_PING_PACKET_LOSS", category: "network", description: "Paketverlust über 20 % für 5 Minuten.", ...global, nodeGroup: "network", nodeClasses: ["NMS_SWITCH", "NMS_ROUTER", "NMS_FIREWALL"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "> 20 %", duration: "5 min", interval: "1 min", lastTriggeredAt: ago(13), triggerCount: 7, tags: ["network"] }),
    condition({ id: "c23", name: "Ping Latenz", sourceType: "CONDITION_PING_LATENCY", category: "network", description: "Latenz über 150 ms für 5 Minuten.", ...global, nodeGroup: "network", nodeClasses: ["NMS_SWITCH", "NMS_ROUTER", "NMS_FIREWALL"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "> 150 ms", duration: "5 min", interval: "1 min", lastTriggeredAt: ago(18), triggerCount: 5, tags: ["network"] }),
    condition({ id: "c24", name: "Port 443", sourceType: "CONDITION_PORT", category: "network", description: "TCP 443 nicht erreichbar.", ...global, nodeGroup: "network", nodeClasses: ["NMS_FIREWALL", "NMS_SERVER"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "Port closed", duration: "3 min", interval: "1 min", lastTriggeredAt: ago(12), triggerCount: 4, tags: ["network"] }),
    condition({ id: "c25", name: "HTTP Status", sourceType: "CONDITION_HTTP", category: "network", description: "HTTP-Status außerhalb 200–399.", ...global, nodeGroup: "network", nodeClasses: ["NMS_SERVER", "CLOUD_MONITOR_TARGET"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "Status ≥ 400", duration: "3 min", interval: "1 min", lastTriggeredAt: ago(14), triggerCount: 3, tags: ["network", "http"] }),
    condition({ id: "c26", name: "Adapter-Statuswechsel", sourceType: "CONDITION_NMS_NETWORK_STATUS_CHANGE", category: "network", description: "Netzwerkadapter wechselt auf down.", ...global, nodeGroup: "network", nodeClasses: ["NMS_SWITCH"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MINOR", priority: "P4", threshold: "Status = down", duration: "sofort", interval: "1 min", lastTriggeredAt: ago(22), triggerCount: 12, tags: ["network"] }),
    condition({ id: "c27", name: "SNMP Trap", sourceType: "CONDITION_SNMPTRAP", category: "network", description: "Beliebiger Trap oder Trap mit OID.", ...global, nodeGroup: "network", nodeClasses: ["NMS_SWITCH", "NMS_PRINTER", "NMS_WAP"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "Trap empfangen", duration: "sofort", interval: "sofort", lastTriggeredAt: ago(60), triggerCount: 16, tags: ["network"] }),
    condition({ id: "c28", name: "Syslog Error", sourceType: "CONDITION_SYSLOG", category: "network", description: "Syslog mit Severity Error oder höher.", ...global, nodeGroup: "network", nodeClasses: ["NMS_SWITCH", "NMS_ROUTER"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MINOR", priority: "P4", threshold: "Severity ≥ Error", duration: "sofort", interval: "sofort", lastTriggeredAt: ago(35), triggerCount: 8, tags: ["network"] }),
    condition({ id: "c29", name: "Config-Datei geändert", sourceType: "CONDITION_CONFIGURATION_FILE", category: "network", description: "Running-Config wurde verändert.", ...global, nodeGroup: "network", nodeClasses: ["NMS_SWITCH", "NMS_ROUTER"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "Change detected", duration: "sofort", interval: "1 h", triggerCount: 2, tags: ["network", "compliance"] }),
    condition({ id: "c30", name: "VM Host Uptime", sourceType: "CONDITION_VM_HOST_UPTIME", category: "virtualization", description: "Host-Uptime über 180 Tage.", ...global, nodeGroup: "virtualization", nodeClasses: ["VMWARE_VM_HOST"], policyId: 903, policyName: "VMware · Host", inherited: false, enabled: true, severity: "MINOR", priority: "P4", threshold: "> 180 Tage", duration: "1 Tag", interval: "6 h", triggerCount: 2, tags: ["vm"] }),
    condition({ id: "c31", name: "Host CPU aggregate", sourceType: "CONDITION_VM_AGGREGATE_CPU_USAGE", category: "performance", description: "Aggregate CPU über 90 %.", ...global, nodeGroup: "virtualization", nodeClasses: ["VMWARE_VM_HOST"], policyId: 903, policyName: "VMware · Host", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "> 90 %", duration: "15 min", interval: "5 min", triggerCount: 5, tags: ["vm"] }),
    condition({ id: "c32", name: "Datastore Free Space", sourceType: "CONDITION_VM_HOST_DATASTORE", category: "storage", description: "Datastore unter 15 % frei.", ...global, nodeGroup: "virtualization", nodeClasses: ["VMWARE_VM_HOST"], policyId: 903, policyName: "VMware · Host", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "< 15 %", duration: "10 min", interval: "5 min", triggerCount: 3, tags: ["vm", "storage"] }),
    condition({ id: "c33", name: "VMware Tools", sourceType: "CONDITION_VM_GUEST_TOOLS_NOT_RUNNING", category: "virtualization", description: "Guest Tools laufen nicht.", ...global, nodeGroup: "virtualization", nodeClasses: ["VMWARE_VM_GUEST"], policyId: 904, policyName: "VMware · Guest", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "Tools not running", duration: "5 min", interval: "5 min", lastTriggeredAt: ago(9), triggerCount: 4, tags: ["vm"] }),
    condition({ id: "c34", name: "Snapshot-Lebensdauer", sourceType: "CONDITION_VM_GUEST_SNAPSHOT_LIFESPAN", category: "storage", description: "Snapshot älter als 7 Tage.", ...global, nodeGroup: "virtualization", nodeClasses: ["VMWARE_VM_GUEST"], policyId: 904, policyName: "VMware · Guest", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "> 7 Tage", duration: "1 Tag", interval: "6 h", triggerCount: 1, tags: ["vm", "storage"] }),
    condition({ id: "c35", name: "Snapshot-Größe", sourceType: "CONDITION_VM_GUEST_SNAPSHOT_SIZE", category: "storage", description: "Snapshot größer als 100 GB.", ...global, nodeGroup: "virtualization", nodeClasses: ["VMWARE_VM_GUEST"], policyId: 904, policyName: "VMware · Guest", inherited: false, enabled: true, severity: "MODERATE", priority: "P3", threshold: "> 100 GB", duration: "1 h", interval: "6 h", triggerCount: 1, tags: ["vm", "storage"] }),

    // Organization / location specific
    condition({ id: "c36", name: "Bremen Intranet HTTP", sourceType: "CONDITION_HTTP", category: "network", description: "Intranet-Portal am Depot Bremen.", scopeLevel: "location", organizationId: 101, organizationName: "Nordwind Logistics", locationId: 1002, locationName: "Bremen · Depot", nodeGroup: "server", nodeClasses: ["LINUX_SERVER"], policyId: 905, policyName: "Nordwind · Bremen Standort", inherited: true, enabled: true, severity: "MAJOR", priority: "P2", threshold: "HTTP ≥ 400", duration: "3 min", interval: "1 min", lastTriggeredAt: ago(14), triggerCount: 6, tags: ["bremen", "http"] }),
    condition({ id: "c37", name: "PACS-Speicher", sourceType: "CONDITION_AGENT_DISK_FREE_SPACE", category: "storage", description: "PACS-Volume unter 10 % frei.", scopeLevel: "organization", organizationId: 102, organizationName: "Klinik am Park", locationId: 1011, locationName: "Berlin · Campus", nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 906, policyName: "Klinik · PACS", inherited: true, enabled: true, severity: "CRITICAL", priority: "P1", threshold: "< 10 %", duration: "5 min", interval: "1 min", lastTriggeredAt: ago(30), triggerCount: 8, tags: ["clinical", "pacs", "storage"] }),
    condition({ id: "c38", name: "OT SNMP Custom", sourceType: "CONDITION_SNMPTRAP", category: "custom", description: "Hirschmann-spezifische OIDs und Trap-Filter.", scopeLevel: "organization", organizationId: 103, organizationName: "Stadtwerke Rhein", locationId: 1021, locationName: "Duisburg · Netz", nodeGroup: "network", nodeClasses: ["NMS_SWITCH"], policyId: 907, policyName: "Stadtwerke · OT-Netz", inherited: true, enabled: true, severity: "MAJOR", priority: "P2", threshold: "OID match", duration: "sofort", interval: "sofort", lastTriggeredAt: ago(60), triggerCount: 3, tags: ["ot", "snmp"] }),
    condition({ id: "c39", name: "Kiel Backup-Dauer", sourceType: "CONDITION_SCRIPT_RESULT", category: "backup", description: "Backup-Job länger als 6 Stunden.", scopeLevel: "location", organizationId: 101, organizationName: "Nordwind Logistics", locationId: 1003, locationName: "Kiel · Lager", nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 908, policyName: "Nordwind · Kiel Backup", inherited: true, enabled: true, severity: "MODERATE", priority: "P3", threshold: "> 6 h", duration: "sofort", interval: "1 h", lastTriggeredAt: ago(120), triggerCount: 4, tags: ["kiel", "backup"] }),
    condition({ id: "c40", name: "Hamburg Uplink Port 24", sourceType: "CONDITION_NMS_NETWORK_STATUS_CHANGE", category: "network", description: "Uplink-Port Gi1/0/24 am Core-Switch.", scopeLevel: "location", organizationId: 101, organizationName: "Nordwind Logistics", locationId: 1001, locationName: "Hamburg · Zentrale", nodeGroup: "network", nodeClasses: ["NMS_SWITCH"], policyId: 902, policyName: "NMS · Network Core", inherited: false, enabled: true, severity: "MAJOR", priority: "P2", threshold: "Port down", duration: "sofort", interval: "1 min", lastTriggeredAt: ago(22), triggerCount: 7, tags: ["hamburg", "network"] }),

    // Disabled examples
    condition({ id: "c41", name: "Legacy CPU-Regel", sourceType: "CONDITION_AGENT_CPU", category: "performance", description: "Alte Regel, deaktiviert nach Policy-Review.", ...global, nodeGroup: "server", nodeClasses: ["WINDOWS_SERVER"], policyId: 900, policyName: "Baseline · Windows Server", inherited: false, enabled: false, severity: "MINOR", priority: "P4", threshold: "> 99 %", duration: "60 min", interval: "15 min", triggerCount: 0, tags: ["legacy"] }),
    condition({ id: "c42", name: "Test-Software-Check", sourceType: "CONDITION_SOFTWARE", category: "custom", description: "Nur für Pilotgruppe, aktuell deaktiviert.", ...global, nodeGroup: "endpoint", nodeClasses: ["WINDOWS_WORKSTATION"], policyId: 901, policyName: "Baseline · Windows Workstation", inherited: false, enabled: false, severity: "MINOR", priority: "P4", threshold: "Software != vorhanden", duration: "1 Tag", interval: "1 Tag", triggerCount: 0, tags: ["pilot"] }),
  ];
}

function buildActivities(now: number, alerts: Alert[]): Activity[] {
  const selected = [
    "a-bremen-fw",
    "a-hh-dc-smart",
    "a-hh-wks-av",
    "a-hh-core-port",
    "a-ber-esx",
    "a-ber-pacs-disk",
    "a-hh-file-disk",
    "a-dui-grid-cpu",
    "a-kiel-backup",
    "a-pot-patch",
  ];
  const activities: Activity[] = [];
  selected.forEach((uid, index) => {
    const alert = alerts.find((entry) => entry.uid === uid);
    if (!alert) return;
    activities.push({
      id: 9000 + index,
      deviceId: alert.deviceId,
      activityTime: alert.updatedAt,
      type: alert.sourceName,
      activityType: "CONDITION",
      severity: alert.severity,
      priority: alert.ninjaPriority,
      status: alert.acknowledged ? "ACKNOWLEDGED" : "TRIGGERED",
      sourceName: alert.sourceName,
      sourceConfigUid: alert.sourceConfigUid,
      seriesUid: alert.uid,
      message: alert.message,
    });
  });
  return activities;
}

function buildHealth(devices: Device[], alerts: Alert[]): DeviceHealth[] {
  return devices.map((device) => {
    const deviceAlerts = alerts.filter((alert) => alert.deviceId === device.id);
    return {
      deviceId: device.id,
      healthStatus: device.offline ? "UNHEALTHY" : deviceAlerts.length > 0 ? "NEEDS_ATTENTION" : "HEALTHY",
      offline: device.offline,
      parentOffline: device.parentDeviceId ? Boolean(devices.find((entry) => entry.id === device.parentDeviceId)?.offline) : false,
      alertCount: deviceAlerts.length,
    };
  });
}

function buildSignals(now: number): ExternalSignal[] {
  return [
    {
      id: "sig-isp-bremen",
      type: "ISP",
      title: "ISP-Ausfall Bremen (Glasfaser L2)",
      scope: { level: "location", locationId: 1002, label: "Bremen · Depot" },
      startsAt: now - 19 * MINUTE,
      status: "active",
      notes: "Provider-Ticket ISP-88421. Glasfaserstörung im Quartier, ETA 14:30.",
      effects: { suppressInternetChecks: true, suppressNetworkChecks: true, suppressAgentAlerts: true },
      createdBy: "M. Yilmaz",
      createdAt: now - 17 * MINUTE,
    },
    {
      id: "sig-maint-kiel",
      type: "MAINTENANCE",
      title: "Wartung USV Kiel",
      scope: { level: "location", locationId: 1003, label: "Kiel · Lager" },
      startsAt: now - 2 * DAY,
      endsAt: now - 2 * DAY + 3 * HOUR,
      status: "resolved",
      notes: "USV-Austausch abgeschlossen.",
      effects: { suppressInternetChecks: false, suppressNetworkChecks: true, suppressAgentAlerts: true },
      createdBy: "N. Weber",
      createdAt: now - 2 * DAY,
    },
  ];
}

function buildTasks(now: number): Task[] {
  const ago = (minutes: number) => now - minutes * MINUTE;
  return [
    {
      id: "tsk_1001",
      title: "Switch SW-CORE-HH-01 · Port Gi1/0/24 prüfen",
      description: "Uplink-Port ist DOWN. SFP, Patchfeld und Gegenstelle prüfen. Danach Port-Status und betroffene VLANs verifizieren.",
      status: "in_progress",
      priority: "P2",
      assignee: "N. Weber",
      dueAt: now + 2 * HOUR,
      createdAt: ago(20),
      updatedAt: ago(4),
      alertIds: ["a-hh-core-port"],
      deviceIds: [105],
      tags: ["network", "hamburg"],
      checklist: [
        { id: "chk_1", text: "SFP-Modul und Patchkabel prüfen", done: true },
        { id: "chk_2", text: "Gegenstelle am Access-Switch prüfen", done: false },
        { id: "chk_3", text: "Port-Status dokumentieren", done: false },
      ],
      source: "alert",
    },
    {
      id: "tsk_1002",
      title: "SMART-Fehler SRV-DC01 bewerten",
      description: "Disk 0 meldet Predictive Failure. Ersatzlaufwerk bestellen und Austauschfenster planen.",
      status: "open",
      priority: "P1",
      assignee: "A. Schmidt",
      dueAt: now + 4 * HOUR,
      createdAt: ago(24),
      updatedAt: ago(24),
      alertIds: ["a-hh-dc-smart"],
      deviceIds: [101],
      tags: ["hardware", "hamburg", "critical"],
      checklist: [
        { id: "chk_4", text: "SMART-Daten sichern", done: false },
        { id: "chk_5", text: "Ersatzlaufwerk bestellen", done: false },
        { id: "chk_6", text: "Backup verifizieren", done: false },
      ],
      source: "alert",
    },
    {
      id: "tsk_1003",
      title: "WAN-Incident Bremen begleiten",
      description: "Externes ISP-Signal aktiv. Provider-Ticket ISP-88421 beobachten, Firewall und Switch nach Recovery prüfen.",
      status: "in_progress",
      priority: "P1",
      assignee: "M. Yilmaz",
      dueAt: now + 1 * HOUR,
      createdAt: ago(17),
      updatedAt: ago(2),
      alertIds: ["a-bremen-fw", "a-bremen-sw", "a-bremen-http"],
      deviceIds: [120, 121],
      tags: ["wan", "bremen", "incident"],
      checklist: [
        { id: "chk_7", text: "Provider-Ticket bestätigen", done: true },
        { id: "chk_8", text: "Firewall nach Recovery prüfen", done: false },
        { id: "chk_9", text: "Downstream-Geräte neu bewerten", done: false },
      ],
      source: "causality",
      incidentId: "signal:sig-isp-bremen",
    },
    {
      id: "tsk_1004",
      title: "PACS-Speicher erweitern",
      description: "PACS-Volume bei 6 % freiem Speicher. Archivierung prüfen und Volume erweitern.",
      status: "open",
      priority: "P2",
      assignee: "L. Fischer",
      dueAt: now + 1 * DAY,
      createdAt: ago(30),
      updatedAt: ago(30),
      alertIds: ["a-ber-pacs-disk"],
      deviceIds: [145],
      tags: ["clinical", "storage", "berlin"],
      checklist: [
        { id: "chk_10", text: "Archivierungsjob prüfen", done: false },
        { id: "chk_11", text: "Volume erweitern", done: false },
      ],
      source: "alert",
    },
    {
      id: "tsk_1005",
      title: "Kiel Backup-Job prüfen",
      description: "Backup-Fehler 307 und Laufzeit 7 h 12 min. Speicherplatz und VSS prüfen.",
      status: "blocked",
      priority: "P2",
      assignee: "N. Weber",
      dueAt: now - 3 * HOUR,
      createdAt: ago(180),
      updatedAt: ago(90),
      alertIds: ["a-kiel-backup", "a-kiel-backup-duration"],
      deviceIds: [131],
      tags: ["backup", "kiel"],
      checklist: [
        { id: "chk_12", text: "Fehlercode 307 analysieren", done: true },
        { id: "chk_13", text: "VSS-Speicher prüfen", done: false },
      ],
      source: "alert",
    },
    {
      id: "tsk_1006",
      title: "AV-Bedrohung WKS-ACC-02 isolieren",
      description: "Trojan.Win32.Agent in Quarantäne. Endpoint isolieren, Forensik einleiten, Nutzer informieren.",
      status: "open",
      priority: "P1",
      assignee: "A. Schmidt",
      dueAt: now + 30 * MINUTE,
      createdAt: ago(6),
      updatedAt: ago(6),
      alertIds: ["a-hh-wks-av"],
      deviceIds: [108],
      tags: ["security", "hamburg", "critical"],
      checklist: [
        { id: "chk_14", text: "Endpoint isolieren", done: false },
        { id: "chk_15", text: "Forensik einleiten", done: false },
        { id: "chk_16", text: "Nutzer informieren", done: false },
      ],
      source: "alert",
    },
    {
      id: "tsk_1007",
      title: "Wartungsfenster Potsdam dokumentieren",
      description: "Wartung abgeschlossen, Dokumentation im Kundenportal ergänzt.",
      status: "done",
      priority: "P4",
      assignee: "M. Yilmaz",
      dueAt: now - 1 * DAY,
      createdAt: ago(2880),
      updatedAt: ago(1440),
      alertIds: [],
      deviceIds: [150],
      tags: ["maintenance", "potsdam"],
      checklist: [],
      source: "manual",
    },
  ];
}

export function createDemoSnapshot(now = Date.now()): Snapshot {
  const devices = buildDevices(now);
  const alerts = buildAlerts(now);
  const conditions = buildConditions(now);
  const activities = buildActivities(now, alerts);
  const health = buildHealth(devices, alerts);
  return {
    meta: {
      mode: "demo",
      sourceLabel: "Demo-Tenant · Nordwind / Klinik / Stadtwerke",
      generatedAt: now,
      lastSync: now,
      stale: false,
      version: "0.1.0",
      tenant: "demo.ninjarmm.local",
      counts: {
        devices: devices.length,
        alerts: alerts.length,
        conditions: conditions.length,
        organizations: organizations.length,
        locations: locations.length,
      },
    },
    organizations,
    locations,
    policies,
    devices,
    alerts,
    conditions,
    activities,
    health,
  };
}

export function createDemoSignals(now = Date.now()): ExternalSignal[] {
  return buildSignals(now);
}

export function createDemoTasks(now = Date.now()): Task[] {
  return buildTasks(now);
}

export { organizations, locations, policies };
