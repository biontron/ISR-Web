# Es gibt zwei grundlegend verschiedene Arten von Entitäten in dem Infrastruktur Repository

a) Assets "Elements"- genauer gesagt Geräte "Devices" mit deren stackable Komponenten "Components" und systemischen Gruppen (VLAN-Segment, Netwerk-Area, Cluster)

- Geteilte / shared Ressource

b) organisatorische / hirarchiche / logische Gruppen, mit denen Nutzer(gruppen) spezifische  Sichten "Views" auf die unter a) genannten "Elements" in Form einer Baumansicht "Treeview" dargestellt werden können.

- Nutzer(gruppen) spezifische Ressource

Der Root des Treeview ist immer der aktuell ausgewählte Sicht "View".

Hierunter können logisch ordnende Ordner "Folder" eingehängt werden (@parentRef).

Innerhalb eins logischer Ordner kann weitere logische Ordner einhängen (@parentRef), oder Assets "Elements" einhängen: a) elementRef b) XPath Filter über alle physischen Gruppen oder Devices.

In einen physischen Ordner können nur weitere phyische Ordner mit deren 1:1 Verknüfung auf eine physische Gruppe, physisches Gerät "Device" oder seine stapelbaren Funktionsebenen "Components" eingehängt und referenziert werden. 

So dass in dem Baum sowohl logisch strukturelle Ordner (für oganisatorische Glei) als auch physische Elemente (für Managed Resource) verwendet gemeinsam / untereinander verwendet werden können.  
  


```
View: Network Operations
│
├── Production                    LogicalFolder
│   │
│   ├── Core Network              LogicalFolder
│   │   │
│   │   └── Cluster A             ResourceFolder
│   │       │
│   │       ├── Device 01         ResourceFolder
│   │       │   └── Routing       ResourceFolder
│   │       │
│   │       └── Device 02         ResourceFolder
│   │
│   └── Critical Systems          LogicalFolder
│       └── ...
│
└── Monitoring                    LogicalFolder
```







  
  
Docks und Dockparts  
Components haben Docks (mit Dockpart) und Connections haben Links (und Linkpart) die auf die Jeweiligen Docks (mit deren Dockparts) verweisen.  
Docks können auch auf resource Gruppen verweisen, die dann als Kontext dienen - z. B. um eine VLAN aus dem VLAN-Segment zu erben.  
  
Device

└── Component

    └── Dock

        └── DockPart  


Connections  
Daneben gibt es noch die Connections, die eine Verbindung zwischen zwei Geräten "Device" und/oder deren Funktionen "Components" herstellen.  
  
Connection

└── Link

    └── LinkPart  
  
  
  
Wording:  
  
**View** = nutzer-/gruppenspezifische Sicht   
REST: /views/{viewname}  
  
Treeview = Baumdarstellung aller Resourcen der View  
  
ViewFolder = die logische Gruppe innerhalb der view   
REST: /views/{viewID}/{folderId)  
Wir im TreeView entweder als  
a) "LogicalFolder" eine Art "logical Group" dargestellt  
LogicalReference (@parentRef)  
Kann zusätzlich enthalten:  
**ResourceReference** = direkte Referenz auf eine Resource (@elementRef)  
**ResourceQuery** = dynamische Auswahl von Resources  
  
b) "ResourceFolder" ein Folder vom type "Element Reference" dargestellt.  
**ResourceReference** = direkte Referenz auf eine Resource (@elementRef)  
  
  
Environment = eine Umgebung, in der Resourcen physisch anzutreffen sind  
REST: /environments/{environmentId}  
  
**Resource** = tatsächlich existierende Infrastrukturressource (Device, Componten, Kontext/Segmant) - sind aufeinander stapelbar / Stackable  
REST: /environments/{environmentId}/elements/{elementId)  
mit  
**Dock / DockPart** = Anschluss-/Portstruktur einer Component  
  
Eine Resouce kann von folgendem Typ sein:  
  
Device = ein physikalisches Gerät / eine logische Einheit  
Component = eine vom Geräte genutzte oder bereitgestellte funktionale Komponete (auf unterschiedlichen Layern)  
??? = ein logischer Kontext (VLAN Segment, Subnet, Cluster)  
Kontext = wenn eine Strukturgebende Gruppe als Kontext (VLAN ID 7 wird übernommen - im Sinne von geerbt - auf Dockpart)

  
**Connection** = Beziehung zwischen zwei Ressourcen-/Component-Endpunkten  
REST: /environments/{environmentId}/connections/{connectionId)  
mit  
Link / Linkpart = eine Verknüfung zwischen zwei Resourcen mit den entsprechenden (Dock / Dockpart)  
  
  
Infrastructure Repository

│

├── Resources

│   ├── Device

│   │   └── Component

│   │       └── Dock

│   │           └── DockPart

│   │

│   └── ResourceGroup 

│       └── Kontext (VLAN ID, Network Segement, Cluster ID)

│

├── Connections

│   └── Link (verweist auf einen Dock)

│       └── LinkPart (verweist auf einen Dockpart)

│

└── Views

    └── ViewNode

        ├── LogicalFolder

        │   └── ViewNode ...

        │

        └── ResourceFolder

            └── ResourceReference / ResourceQuery