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

Gemeinsame Engine: `elementToFilterXml` + `elementMatchesXPath` (`elementXPathFilter.ts`). Dieselbe Auswertung gilt für globale Suche, Zuordnungs-Filter, Automapping, View-Validierung und Schema-Editor-Feldmarken. Connection-Endpunktwahl nutzt sie noch nicht. `titleTemplate` und IaC-Templates haben eigene XPath-Kontexte (siehe unten).

## Suche

Suchfeld in der Menüzeile (rechts, vor dem Benutzer).

- Reiner Text: Freitext über `id`, `definition` (Name, Label, Beschreibung, Typ, Subtyp, Tags) und Connection-Label/Link-Titel. Kein XML.
- XPath-Syntax (`/`, `[`, `=`, `match(`, `starts-with(` …): gleiche Engine wie die Filter. Ungültiger XPath fällt auf Freitext zurück.
- Scope: sichtbarer View-Baum (statische Kinder plus `elementIdRefs`) und Connections, deren Endpunkte in dieser Menge liegen.
- Treffer: Markierung im Tree plus Treffer-Dialog (Enter/Suche). Aus dem Dialog als `validationRules` speicherbar.

## Filterung (`filterRules`)

An View und Group. Regeln filtern Kandidaten in der Zuordnungs-UI und beim Automapping. Sie hängen **keine** Baumkinder dynamisch an — Treffer werden erst per Zuordnung oder Automapping-Knopf in `elementIdRefs` übernommen. Mehrere aktive Regeln gelten als **ODER**. Parent-Refs bleiben unverändert.

REST `FilterRuleType` (JSON-Reihenfolge): `environments`, `xpath`, `description`, `activated`. Neu angelegte Regeln sind `activated: true`. Fehlt `activated` im REST-Körper, bleibt es `false` (kein stilles Auffüllen).

In der Zuordnungs-UI werten die Suchkriterien die rechte Kandidatenliste erst nach **Filterregeln anwenden** aus — nicht live bei jeder Eingabe. **Filterregeln aufheben** zeigt wieder die ungefilterte Kandidatenliste. Übernehmen in `elementIdRefs` geschieht über `<` / `<<`, nicht über den Filter-Button.

REST: `ViewItem.filterRules` / `GroupItem.filterRules`.

## Zuordnung (`elementIdRefs`)

REST/XSD `ElementIdRefType`: `environmentId`, `id`, `baseType`, `type`, `subType`, `name`, `label`. Die Typ-/Namensfelder sind ein Snapshot der Zielddefinition — Icon (`getIconByDefinition`) und Hover-Menü (Selection-Dialog, Tree) brauchen sie, ohne das Asset nachladen zu müssen. `environmentRef` gibt es nicht; nicht umbiegen.

## Validierung (`validationRules`)

Nur an der View. Objekt `{ xpath, description, type }` mit `type`: `positive` | `negative`. Toolbar-Buttons sind standardmäßig aus.

- Positiv: Treffer = erwartetes Muster (grüner Signalbalken).
- Negativ: Treffer = Anomalie (roter Signalbalken).
- Geändert/neu/ungültig bleibt unabhängig (oberer/linker Balken). Alle drei können gleichzeitig gelten.

Markierung: Tree (senkrechte Balken am Eintragsende), Graph (quer oben rechts, plus Kantenfarbe bei Connections), Schema-Editor-Felder über getroffene Pfade.

REST: optionales `ViewItem.validationRules`. Fehlendes Feld lädt als leere Liste.

## Schema-Editor

`titleTemplate` an Schema-Gruppen/Feldern interpoliert `{pfad}` und `#{pfad}` — JSON-Pfad (`settings.ip`, `$.id`) und XPath (`settings/ip`, `./ip`) relativ zum aktuellen Dockpart oder Gruppeneintrag (`titleTemplate.ts`). Das ist ein anderer Kontext als die Element-Suche.

Validierungs-XPath, der `docks`/`settings`/`definition` trifft, markiert die entsprechenden Felder zusätzlich zur Schema-Validierung (Pflichtfeld/Regex) — über dieselbe Element-Engine.

## Templates (IaC)

In `<texttemplate>` stehen Platzhalter als XPath in eckigen Klammern, ausgewertet gegen die Template-`xmldata` (nicht gegen `elementToFilterXml`):

```text
Dear Mr. [//name], salary: [//salary/@amount] EUR.
```

Siehe `iacTemplateXml.ts`.
