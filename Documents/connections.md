# Connections

Vier Arten. REST-Körper unverändert lesen und schreiben — keine stillen Korrekturen.

Alle sichtbaren Kästen sind **Components** (`Asset`). Rollen unterscheiden sich nur fachlich.

Docklayer = Dockpart.

## Rollen der Component

**Device** ist eine Sonderform der Component: die Basis, der Grundstock — ein Gerät mit seinem Netzwerk-Stack. Optisch der heutige Kasten.

Darin liegen **funktionale Einheiten**, ebenfalls Components, als Kästen übereinander im Device.

Beispiel Device **Server 4711**:

- Component **SIP-Telefonie**: Dockparts SIP, SIPS, HTML-Oberfläche
- Component **Webserver**: Dockparts SSH, HTTP, HTTPS

Ablage der Funktionsblöcke: `ownerIdRef` auf das Device (oder die Ebene darunter).

**Context** (fachlich oft „Gruppe“/Zone) ist **ebenso eine Component**, keine View-Group. Sie trägt Dockparts für VLANs oder Netze (ein Context kann mehrere VLANs haben).

Erkennung:

| Rolle | REST / MST |
| --- | --- |
| Device | `definition.type` = `DEVICE` |
| Funktions-Component | `Asset`, `ownerIdRef` zeigt auf ein Device oder eine innere Component |
| Context | `Asset` mit Dockparts VLAN/IP (Typ z. B. CONTEXT, NETWORK, VLAN, GROUP) — nicht DEVICE, nicht Funktionsblock im Device |

View-Groups (`class: Group`) bleiben Ordner im Baum; sie sind nicht der Context.

## Arten

### a) Link

Direktverbindung zwischen Docks funktionaler Components (im Device).

- `kind`: `link`
- `fromDockRef` / `toDockRef`: Dock-ID
- `linkparts`: Schichtpaarung
- `fromDockpartRef` / `toDockpartRef`: Dockpart-ID

Ältere Werte `dockId#dockpartId` in `fromDockRef` werden gelesen, aber nicht umgeschrieben. Neu angelegte Links speichern nur die Dock-ID.

### b) Context

Component (Device oder Funktionsblock) zeigt per `valueRef` auf einen **Context-Component**-Wert.

- `kind`: `context`
- Connection: Component ↔ Context-Component
- `valueRef`: `contextId#valueId` (`valueId` = Dockpart-ID am Context)
- Keine Kopie von VLAN-/Netzwerten in `settings`
- Mehrere VLANs am selben Context; Dockparts dürfen auf verschiedene Werte zeigen
- Fehlt die Ref oder der Wert: sichtbarer Fehler

Drag-and-Drop auf eine Context-Component setzt `valueRef` und die Context-Connection. Das Device wird **nicht** in den Context gestapelt (`ownerIdRef` bleibt). Bei mehreren passenden Werten muss der Nutzer wählen.

### c) Bridge

Zwei Connection-Objekte, je Environment. `kind: bridge`. Peer-Felder. Jede Seite darf allein stehen.

### d) Logical

Ohne Docks. Device, Funktions-Component, Context-Component und View-Group als Endpunkte.

## Farben (Graph-Kreise außen)

| Schicht | Farbe |
| --- | --- |
| VLAN | `#dc2626` |
| IP | `#7c3aed` |
| sonst | `#64748b` |

Kreise sitzen am jeweiligen Kasten (Device: Netzwerk-Stack, Funktionsblock: SIP/HTTP/…, Context: VLAN/Netz). `valueRef` wird gegen die Context-Component aufgelöst, nicht gegen View-Groups.

## REST Connection

- `kind`: `link` \| `context` \| `bridge` \| `logical`
- Bridge: `bridgeId`, `peerEnvironmentRef`, `peerConnectionRef`

## REST Dockpart

- `valueRef`: `contextId#valueId` oder leer
