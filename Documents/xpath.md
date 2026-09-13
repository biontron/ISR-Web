# XPath in ISR-Web

Relatives XPath 1.0 gegen eine XML-Darstellung. Kontextknoten ist immer `<element>` (`elementToFilterXml`). Zusätzlich zu XPath 1.0 wertet die UI `match()`, `matches()` und `fn:matches()` als reguläre Ausdrücke aus.

XPath-Indizes sind 1-basiert (`docks[1]/dockparts[2]/…`). MST-/JSON-Pfade im Schema-Editor sind 0-basiert (`docks[0].dockparts[1].…`).

## XML-Form

```xml
<element>
  <id>…</id>
  <class>Asset|Group|Connection</class>
  <definition>
    <storeType/>
    <baseType/>
    <type/>
    <subType/>
    <name/>
    <label/>
    <description/>
    <tags><tag>…</tag></tags>
  </definition>
  <ownerIdRef/>  <!-- bzw. parentIdRef bei Group -->
  <docks>…</docks>       <!-- nur wenn der Ausdruck docks enthält -->
  <settings>…</settings> <!-- nur wenn der Ausdruck settings enthält -->
  <links>…</links>       <!-- Connections, nur wenn der Ausdruck links enthält -->
</element>
```

Beispiele:

- `equals(definition/baseType,"COMPONENT")`
- `definition/type='DEVICE'`
- `definition/tags/tag='Client'`
- `starts-with(definition/name,'is-')`
- `match(definition/name,'^is-')`
- `matches(docks[1]/dockparts[2]/settings/address/ip, '192\\.168\\.40\\..*')`
- `class='Connection'`

## Suche

Suchfeld in der Menüzeile (rechts, vor dem Benutzer).

- Reiner Text: Freitext über `id`, `definition` (Name, Label, Beschreibung, Typ, Subtyp, Tags) und Connection-Label/Link-Titel. Kein XML.
- XPath-Syntax (`/`, `[`, `=`, `match(`, `starts-with(` …): gleiche Engine wie die Filter. Ungültiger XPath fällt auf Freitext zurück.
- Scope: sichtbarer View-Baum (static + `filterRules`) und Connections, deren Endpunkte in dieser Menge liegen.
- Treffer: Markierung im Tree plus Treffer-Dialog (Enter/Suche). Aus dem Dialog als `validationRules` speicherbar.

## Filterung (`filterRules`)

An View und Group. Ordnet **nur unzugeordnete** Elemente (ohne `parentIdRef`/`ownerIdRef`) dynamisch als Baumkinder zu. Mehrere Regeln gelten als **ODER**. Parent-Refs werden nicht geändert.

REST: `ViewItem.filterRules` / `GroupItem.filterRules`.

## Validierung (`validationRules`)

Nur an der View. Objekt `{ xpath, description, polarity }` mit `polarity`: `positive` | `negative`.

- Positiv: Treffer = erwartetes Muster (grüner Signalbalken).
- Negativ: Treffer = Anomalie (roter Signalbalken).
- Geändert/neu/ungültig bleibt unabhängig (oberer/linker Balken). Alle drei können gleichzeitig gelten.

Markierung: Tree (senkrechte Balken am Eintragsende), Graph (quer oben rechts, plus Kantenfarbe bei Connections), Schema-Editor-Felder über getroffene Pfade.

REST: optionales `ViewItem.validationRules`. Fehlendes Feld lädt als leere Liste.

## Schema-Editor

`titleTemplate` an Schema-Gruppen/Feldern interpoliert `{pfad}` und `#{pfad}` — JSON-Pfad (`settings.ip`, `$.id`) und XPath (`settings/ip`, `./ip`) relativ zum aktuellen Dockpart oder Gruppeneintrag (`titleTemplate.ts`).

Validierungs-XPath, der `docks`/`settings`/`definition` trifft, markiert die entsprechenden Felder zusätzlich zur Schema-Validierung (Pflichtfeld/Regex).

## Templates (IaC)

In `<texttemplate>` stehen Platzhalter als XPath in eckigen Klammern, ausgewertet gegen die Template-`xmldata`:

```text
Dear Mr. [//name], salary: [//salary/@amount] EUR.
```

Siehe `iacTemplateXml.ts`.
