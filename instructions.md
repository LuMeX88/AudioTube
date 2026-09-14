# Lastenheft: YouTube-Audio-Player für Home Assistant

## 1. Projektbezeichnung

**Arbeitstitel:** Tube Audio Player für Home Assistant

## 2. Ausgangslage

Im Haushalt sind vernetzte Lautsprecher vorhanden, insbesondere Sonos-Lautsprecher. Gewünscht ist eine innerhalb von Home Assistant nutzbare Anwendung, die ein ähnliches Bedienerlebnis wie SonosTube bietet, jedoch ausschliesslich für **Audio-Wiedergabe**.

Nutzer sollen öffentliche Inhalte auf YouTube über eine Suchfunktion finden, einzelne Titel oder ganze YouTube-Playlists auswählen, eigene Wiedergabelisten verwalten und die Audiospur auf ausgewählten Lautsprechern wiedergeben können.

Die Anwendung soll ohne YouTube Premium, ohne Google-Cloud-API-Key und ohne separate Video-Wiedergabe auskommen. Ein Video darf weder auf einem Mobilgerät noch auf einem Fernseher, Chromecast oder einer anderen Anzeige gestartet werden. Es wird ausschliesslich Audio auf den ausgewählten Lautsprechern wiedergegeben.

## 3. Projektziel

Entwicklung einer in Home Assistant integrierten Anwendung mit einer intuitiven Benutzeroberfläche für die Suche, Auswahl, Organisation und Wiedergabe von YouTube-Audioinhalten auf verbundenen Lautsprechern.

Die Anwendung soll insbesondere:

- öffentliche YouTube-Inhalte suchen können,
- Treffer mit aussagekräftigen Metadaten anzeigen,
- einzelne Inhalte und YouTube-Playlists als Audio abspielen,
- eine eigene Wiedergabewarteschlange bereitstellen,
- eigene Favoriten und Wiedergabelisten verwalten,
- Sonos-Lautsprecher und Sonos-Gruppen als Wiedergabeziel steuern,
- sich wie ein natürlicher Bestandteil eines Home-Assistant-Dashboards bedienen lassen.

## 4. Projektumfang

### 4.1 Im Umfang enthalten

- Bedienoberfläche innerhalb von Home Assistant
- Suche nach öffentlichen YouTube-Inhalten
- Suche und Wiedergabe öffentlicher YouTube-Playlists
- Audio-only-Wiedergabe
- Ansteuerung verbundener Lautsprecher, mindestens Sonos
- Auswahl eines einzelnen Raums oder einer Lautsprechergruppe
- Verwaltung einer Wiedergabewarteschlange
- Verwaltung eigener Favoriten und Wiedergabelisten
- Grundlegende Wiedergabesteuerung
- Speicherung von Nutzerinhalten und Einstellungen innerhalb der Home-Assistant-Umgebung
- Fehleranzeige bei nicht verfügbaren, gesperrten oder nicht abspielbaren Inhalten

### 4.2 Nicht im Umfang enthalten

Folgende Funktionen sind ausdrücklich **nicht** Teil der ersten Projektversion:

- Wiedergabe oder Anzeige von Videos
- Video-Casting auf TV, Chromecast, Tablet oder Smartphone
- Download, Archivierung oder dauerhafte Speicherung von YouTube-Audio- oder Videodateien
- YouTube Premium, YouTube Music Premium oder andere kostenpflichtige Abonnements
- Google-Cloud-Projekt, YouTube Data API-Key oder OAuth-Login
- Anmeldung an einem persönlichen Google- oder YouTube-Konto
- Zugriff auf private YouTube-Playlists, Likes, Verlauf oder persönliche Empfehlungen eines Google-Kontos
- Erstellen, Bearbeiten oder Löschen von YouTube-Playlists auf YouTube selbst
- Kommerzielle Veröffentlichung oder Vertrieb als öffentliches Produkt

## 5. Zielgruppen und Nutzungsszenarien

### 5.1 Primäre Nutzergruppe

Privatanwender eines Home-Assistant-Systems mit Sonos-Lautsprechern oder vergleichbaren in Home Assistant eingebundenen Audioausgabegeräten.

### 5.2 Zentrale Nutzungsszenarien

1. **Titel suchen und direkt abspielen**  
   Der Nutzer gibt beispielsweise Künstler und Songtitel ein, wählt einen Suchtreffer und startet die Audio-Wiedergabe in einem Sonos-Raum.

2. **YouTube-Playlist abspielen**  
   Der Nutzer sucht nach einer öffentlichen Playlist oder fügt eine YouTube-Playlist-URL ein. Die Playlist wird als Audio auf dem ausgewählten Lautsprecher abgespielt.

3. **Warteschlange zusammenstellen**  
   Der Nutzer sucht mehrere Titel und fügt sie der Warteschlange hinzu. Die Titel werden in der festgelegten Reihenfolge wiedergegeben.

4. **Eigene Playlist nutzen**  
   Der Nutzer speichert einzelne Titel in einer selbst angelegten Playlist und spielt diese später auf einem beliebigen Lautsprecher ab.

5. **Multiroom-Wiedergabe**  
   Der Nutzer wählt eine bestehende Sonos-Gruppe oder gruppiert kompatible Räume und startet die Audio-Wiedergabe auf allen Lautsprechern dieser Gruppe.

6. **Wiedergabe vom Wandtablet steuern**  
   Der Nutzer bedient die Anwendung in einem Home-Assistant-Dashboard auf einem Tablet, ohne eine zusätzliche Smartphone-App nutzen zu müssen.

## 6. Fachliche Anforderungen

### 6.1 Suche

| ID | Anforderung | Priorität |
|---|---|---|
| F-01 | Die Anwendung muss eine Freitextsuche nach öffentlichen YouTube-Inhalten anbieten. | Muss |
| F-02 | Die Suche muss mindestens nach Titeln, Künstlern, Kanälen und Playlist-Namen möglich sein. | Muss |
| F-03 | Suchtreffer müssen mindestens Titel, Kanal bzw. Interpret, Vorschaubild und Dauer anzeigen, soweit verfügbar. | Muss |
| F-04 | Der Nutzer muss zwischen Titel- und Playlist-Ergebnissen unterscheiden können. | Muss |
| F-05 | Der Nutzer soll Suchergebnisse nach Relevanz und nach Inhaltstyp filtern können. | Soll |
| F-06 | Der Nutzer soll eine YouTube-URL eingeben können, um einen einzelnen Inhalt oder eine öffentliche Playlist zu öffnen. | Soll |

### 6.2 Audio-Wiedergabe

| ID | Anforderung | Priorität |
|---|---|---|
| F-10 | Die Anwendung darf ausschliesslich Audio wiedergeben. Eine Video-Wiedergabe darf nicht gestartet oder angezeigt werden. | Muss |
| F-11 | Der Nutzer muss einen einzelnen Titel direkt abspielen können. | Muss |
| F-12 | Der Nutzer muss eine öffentliche YouTube-Playlist als Audio abspielen können. | Muss |
| F-13 | Der Nutzer muss vor Start der Wiedergabe ein Zielgerät auswählen können. | Muss |
| F-14 | Mindestens Sonos-Lautsprecher müssen als Wiedergabeziele unterstützt werden. | Muss |
| F-15 | Die Anwendung muss bestehende Sonos-Gruppen berücksichtigen und die Wiedergabe auf einer Gruppe ermöglichen. | Muss |
| F-16 | Der Nutzer muss Wiedergabe pausieren, fortsetzen und stoppen können. | Muss |
| F-17 | Der Nutzer muss zum nächsten und vorherigen Eintrag der Warteschlange wechseln können. | Muss |
| F-18 | Der Nutzer muss die Lautstärke des aktiven Wiedergabeziels steuern können. | Muss |
| F-19 | Die Anwendung soll Shuffle und Wiederholung für die Warteschlange anbieten. | Soll |
| F-20 | Die Anwendung soll einen Sleep-Timer anbieten. | Soll |

### 6.3 Wiedergabewarteschlange

| ID | Anforderung | Priorität |
|---|---|---|
| F-30 | Die Anwendung muss eine sichtbare Wiedergabewarteschlange bereitstellen. | Muss |
| F-31 | Der Nutzer muss Inhalte zur Warteschlange hinzufügen können. | Muss |
| F-32 | Der Nutzer muss einen Inhalt sofort abspielen können, wobei die bestehende Warteschlange klar definiert behandelt wird. | Muss |
| F-33 | Der Nutzer muss einen Inhalt als nächsten Titel einreihen können. | Muss |
| F-34 | Der Nutzer muss Einträge aus der Warteschlange entfernen können. | Muss |
| F-35 | Der Nutzer muss die Reihenfolge der Warteschlange ändern können. | Soll |
| F-36 | Die Anwendung soll nach einem Neustart den Zustand der Warteschlange wiederherstellen können, soweit dies technisch möglich ist. | Soll |

### 6.4 Favoriten und eigene Wiedergabelisten

| ID | Anforderung | Priorität |
|---|---|---|
| F-40 | Der Nutzer muss einzelne Inhalte als Favorit speichern und entfernen können. | Muss |
| F-41 | Der Nutzer muss eigene Wiedergabelisten anlegen, umbenennen und löschen können. | Muss |
| F-42 | Der Nutzer muss Inhalte eigenen Wiedergabelisten hinzufügen und daraus entfernen können. | Muss |
| F-43 | Der Nutzer muss eine eigene Wiedergabeliste direkt abspielen oder zur Warteschlange hinzufügen können. | Muss |
| F-44 | Eigene Wiedergabelisten und Favoriten müssen lokal in der Home-Assistant-Umgebung gespeichert werden. | Muss |
| F-45 | Die Anwendung soll zuletzt gesuchte und zuletzt abgespielte Inhalte anzeigen können. | Soll |
| F-46 | Der Nutzer soll eine öffentliche YouTube-Playlist als gespeicherte Verknüpfung ablegen können. | Soll |

### 6.5 Bedienoberfläche

| ID | Anforderung | Priorität |
|---|---|---|
| F-50 | Die Oberfläche muss in Home Assistant nutzbar sein und sich in ein Dashboard integrieren lassen. | Muss |
| F-51 | Die Oberfläche muss für Desktop, Tablet und Smartphone responsive sein. | Muss |
| F-52 | Der aktuell wiedergegebene Titel muss mit Titel, Cover, Wiedergabestatus und Zielraum sichtbar sein. | Muss |
| F-53 | Die wichtigsten Aktionen müssen mit wenigen Interaktionen erreichbar sein: Suche, Ziel wählen, Abspielen, Zur Queue hinzufügen und Pause. | Muss |
| F-54 | Die Oberfläche soll sowohl Hell- als auch Dunkelmodus von Home Assistant unterstützen. | Soll |
| F-55 | Die Oberfläche soll eine deutschsprachige Bedienung bieten. | Soll |

## 7. Nichtfunktionale Anforderungen

### 7.1 Abhängigkeiten und Zugangsdaten

| ID | Anforderung | Priorität |
|---|---|---|
| NF-01 | Für die Nutzung der Kernfunktionen darf kein Google-Cloud-API-Key erforderlich sein. | Muss |
| NF-02 | Für die Nutzung der Kernfunktionen darf kein Google- oder YouTube-Login erforderlich sein. | Muss |
| NF-03 | Für die Nutzung der Kernfunktionen darf kein YouTube-Premium- oder YouTube-Music-Premium-Abonnement erforderlich sein. | Muss |
| NF-04 | Die Anwendung darf keine Google-Zugangsdaten abfragen, speichern oder übertragen. | Muss |
| NF-05 | Die Anwendung darf keine dauerhaften Downloads von YouTube-Audio oder Video anlegen. | Muss |

### 7.2 Kompatibilität

| ID | Anforderung | Priorität |
|---|---|---|
| NF-10 | Die Lösung muss mit einer aktuellen, unterstützten Home-Assistant-Installation kompatibel sein. | Muss |
| NF-11 | Die Lösung muss mindestens mit der offiziellen Sonos-Integration von Home Assistant zusammenspielen können. | Muss |
| NF-12 | Die Lösung soll so gestaltet sein, dass zusätzliche kompatible Home-Assistant-Media-Player später ergänzt werden können. | Soll |
| NF-13 | Die Lösung soll auf Home Assistant OS sowie auf üblichen Container-Installationen von Home Assistant betreibbar sein. | Soll |

### 7.3 Bedienbarkeit und Qualität

| ID | Anforderung | Priorität |
|---|---|---|
| NF-20 | Eine typische Suche soll innerhalb weniger Sekunden sichtbare Ergebnisse liefern, vorbehaltlich der Verfügbarkeit externer Quellen. | Soll |
| NF-21 | Ein gewählter Titel soll nach erfolgreicher Auflösung ohne weitere Nutzereingaben starten. | Muss |
| NF-22 | Fehlermeldungen müssen verständlich formuliert sein und eine konkrete Handlungsempfehlung enthalten. | Muss |
| NF-23 | Die Anwendung muss bei nicht abspielbaren Inhalten stabil bleiben und die Warteschlange nicht unkontrolliert verlieren. | Muss |
| NF-24 | Die Bedienung muss mit Touch-Geräten gut nutzbar sein. | Muss |
| NF-25 | Bedienelemente müssen per Tastatur erreichbar sein und sichtbare Fokuszustände bieten. | Soll |

### 7.4 Datenschutz und Sicherheit

| ID | Anforderung | Priorität |
|---|---|---|
| NF-30 | Personenbezogene Daten sollen nur verarbeitet werden, wenn sie für die Funktion zwingend notwendig sind. | Muss |
| NF-31 | Suchanfragen und Wiedergabedaten dürfen nicht ohne Notwendigkeit an zusätzliche Drittanbieter übertragen werden. | Muss |
| NF-32 | Lokal gespeicherte Favoriten, Playlists und Einstellungen dürfen nur innerhalb der Home-Assistant-Instanz zugänglich sein. | Muss |
| NF-33 | Die Anwendung muss klar dokumentieren, welche externen Dienste oder Bibliotheken für Suche und Wiedergabe eingesetzt werden. | Muss |

### 7.5 Wartbarkeit

| ID | Anforderung | Priorität |
|---|---|---|
| NF-40 | Der Quellcode muss nachvollziehbar strukturiert und dokumentiert sein. | Muss |
| NF-41 | Konfiguration, Fehlerprotokollierung und Diagnose müssen für technisch versierte Home-Assistant-Nutzer zugänglich sein. | Muss |
| NF-42 | Externe Abhängigkeiten müssen versionsseitig nachvollziehbar und aktualisierbar sein. | Muss |
| NF-43 | Es müssen Hinweise zur Aktualisierung enthalten sein, falls Änderungen an externen Quellen die Suche oder Wiedergabe beeinträchtigen. | Muss |

## 8. Akzeptanzkriterien

Das Projekt gilt als abgenommen, wenn mindestens die folgenden Szenarien erfolgreich demonstriert werden:

1. **Anonyme Suche**  
   Ein Nutzer kann ohne Eingabe eines API-Keys und ohne Google-Login nach einem öffentlichen Musiktitel suchen.

2. **Audio-only-Wiedergabe**  
   Ein ausgewählter Treffer wird hörbar auf einem Sonos-Lautsprecher wiedergegeben. Es wird dabei auf keinem Gerät ein Video geöffnet oder abgespielt.

3. **Raumauswahl**  
   Der Nutzer kann mindestens zwei verfügbare Sonos-Räume sehen, einen Raum auswählen und den Titel dort starten.

4. **Gruppenwiedergabe**  
   Ein Titel kann auf einer bestehenden Sonos-Gruppe wiedergegeben werden.

5. **Playlist-Wiedergabe**  
   Eine öffentliche YouTube-Playlist kann geladen und als Audio wiedergegeben werden.

6. **Queue-Verwaltung**  
   Der Nutzer kann mindestens drei Titel zur Warteschlange hinzufügen, die Reihenfolge nachvollziehen, einen Titel entfernen und den nächsten Titel starten.

7. **Lokale Playlist**  
   Der Nutzer kann eine eigene Playlist erstellen, mindestens zwei Suchtreffer hinzufügen, die Playlist speichern und später erneut abspielen.

8. **Fehlerbehandlung**  
   Bei einem nicht verfügbaren oder nicht abspielbaren Inhalt erhält der Nutzer eine verständliche Meldung. Die Anwendung bleibt bedienbar und fährt mit dem nächsten möglichen Queue-Eintrag fort oder wartet auf eine Nutzerentscheidung.

9. **Responsive Nutzung**  
   Die wesentlichen Funktionen sind auf Desktop und Tablet ohne Funktionsverlust bedienbar.

## 9. Rahmenbedingungen und Annahmen

- Die Lösung ist für die private Nutzung innerhalb eines bestehenden Home-Assistant-Setups vorgesehen.
- Mindestens ein Sonos-Lautsprecher ist über Home Assistant erreichbar.
- Home Assistant hat Zugriff auf das lokale Netzwerk der Lautsprecher.
- Die Verfügbarkeit einzelner YouTube-Inhalte kann von Region, Rechteinhaber, Altersbeschränkungen, Livestatus oder Änderungen bei YouTube abhängen.
- Die Verwendung inoffizieller Wege zum Abruf öffentlicher YouTube-Inhalte kann durch Änderungen von YouTube beeinträchtigt werden und ist vor Umsetzung rechtlich sowie hinsichtlich der YouTube-Nutzungsbedingungen zu prüfen.
- Der Entwickler entscheidet eigenständig über geeignete technische Komponenten, Datenhaltung, Integrationsform, Abhängigkeitsmanagement und Architektur. Diese sind nicht Gegenstand dieses Lastenhefts.

## 10. Liefergegenstände

Der Entwickler liefert mindestens:

1. Eine funktionsfähige, installierbare Lösung für Home Assistant.
2. Eine Benutzeroberfläche, die in einem Home-Assistant-Dashboard eingesetzt werden kann.
3. Eine Installations- und Konfigurationsanleitung in deutscher oder englischer Sprache.
4. Eine Anleitung für die Nutzung der Kernfunktionen.
5. Eine Dokumentation aller externen Abhängigkeiten und erforderlichen Berechtigungen.
6. Hinweise zu bekannten Einschränkungen und zur Fehlerbehebung.
7. Eine kurze technische Dokumentation für Wartung und Updates.
8. Den vollständigen Quellcode inklusive Konfigurationsdateien und Lizenzinformationen der verwendeten Komponenten.

## 11. Offene Entscheidungen für den Entwickler

Die folgenden Punkte sollen im Umsetzungskonzept durch den Entwickler entschieden und begründet werden:

- Wahl der Integrationsform innerhalb von Home Assistant
- Wahl der Benutzeroberflächentechnologie
- Umsetzung der anonymen Suche ohne Google-Cloud-API-Key
- Behandlung öffentlicher YouTube-Playlist-URLs
- Behandlung der Audio-Wiedergabe für Sonos und weitere Zielgeräte
- Verwaltung, Persistenz und Wiederherstellung der Warteschlange
- Datenmodell für Favoriten, eigene Playlists, Verlauf und Einstellungen
- Umgang mit regional gesperrten, altersbeschränkten oder nicht verfügbaren Inhalten
- Fehlerstrategie bei Unterbrechung der Wiedergabe oder Änderung externer Schnittstellen
- Tests, Logging, Update-Strategie und Sicherung lokaler Nutzerdaten

## 12. Priorisierung für ein MVP

Für eine erste nutzbare Version sind mindestens umzusetzen:

- F-01 bis F-04: anonyme Suche und Anzeige von Ergebnissen
- F-10 bis F-18: reine Audio-Wiedergabe und Sonos-Steuerung
- F-30 bis F-34: grundlegende Warteschlange
- F-40 bis F-44: Favoriten und eigene lokale Playlists
- F-50 bis F-53: nutzbare Home-Assistant-Oberfläche
- NF-01 bis NF-05: kein API-Key, kein Login, kein Premium und keine Downloads
- NF-10 bis NF-12: Home-Assistant- und Sonos-Kompatibilität
- NF-22 bis NF-24: Fehlerbehandlung und Touch-Bedienung

Alle als **Soll** markierten Anforderungen können in einer späteren Ausbaustufe umgesetzt werden.
