# SchachTrainer – Konzept

Stand: 06.11.2026 · Status: abgestimmt, Version 0.1 umgesetzt (M1–M4)

---

## 1. Ziel

Eine Schach-App für iPhone und iPad, die **vollständig offline** funktioniert und drei Dinge kann:

| Priorität | Modus | Beschreibung |
|---|---|---|
| **Muss** | 2 Spieler lokal | Zwei Personen spielen an einem Gerät gegeneinander („Pass & Play“) |
| **Muss** | Schachrätsel | Taktikaufgaben lösen, nach Schwierigkeit und Thema |
| Kann | Einzelspieler | Gegen eine Engine mit einstellbarer Stärke |
| Später | 2 Spieler online | Gegen eine andere Person über das Internet |

---

## 2. Fachliches Konzept

### 2.1 Grundlagen (gilt für alle Modi)

- Vollständige Schachregeln: Rochade, en passant, Bauernumwandlung (Auswahl der Figur), Schach/Matt/Patt.
- Remis-Erkennung: Patt, dreifache Stellungswiederholung, 50-Züge-Regel, ungenügendes Material.
- Bedienung: Figur antippen → mögliche Zielfelder werden markiert → Zielfeld antippen. Zusätzlich Ziehen per Drag & Drop.
- Anzeige: letzter Zug hervorgehoben, König im Schach rot markiert, geschlagene Figuren, Zugliste in Notation (z. B. `Sf3`, `exd5`).
- Einstellungen: Brett-/Figurendesign, Ton an/aus, Vibration, Koordinaten anzeigen, Sprache (zunächst Deutsch).

### 2.2 Modus „2 Spieler lokal“

- **Neue Partie**: Spielernamen (optional), Bedenkzeit wählen (ohne Uhr, 5 min, 10 min, 15+10 …).
- **Brettdrehung**: wahlweise
  - *automatisch drehen* nach jedem Zug (Handy wird weitergereicht) oder
  - *Tischmodus*: Brett bleibt fest, Figuren des Gegners stehen „auf dem Kopf“ (Handy liegt zwischen den Spielern).
- **Schachuhr** (optional) mit Inkrement; Zeitüberschreitung beendet die Partie.
- **Aktionen**: Zug zurücknehmen (nur wenn beide zustimmen / einstellbar), Remis anbieten, Aufgeben.
- **Partie-Ende**: Ergebnisanzeige mit Grund (Matt, Aufgabe, Zeit, Remis-Art).
- **Speichern**: Laufende Partie wird automatisch gespeichert (App schließen ≠ Partie verloren). Abgeschlossene Partien landen in einer **Partiehistorie**, nachspielbar Zug für Zug. Export als PGN (Teilen-Menü).

### 2.3 Modus „Schachrätsel“

- **Rätsel-Quelle**: Lichess-Rätseldatenbank (frei, Lizenz CC0). Mitgeliefert werden 3 × 3.000 beliebte, gut bewertete Aufgaben → offline verfügbar.
- **3 Schwierigkeitsgrade**: Leicht (Wertung 400–1200), Mittel (1200–1800), Schwer (1800–2700).
- **Ablauf**: Stellung wird gezeigt, der Gegner macht den ersten (auslösenden) Zug animiert, dann ist der Spieler dran. Richtiger Zug → Gegner antwortet automatisch, bis die Lösung komplett ist. Falscher Zug → Rückmeldung, erneut versuchen. Bei Mattaufgaben zählt jeder Mattzug als richtig.
- **Hilfen**: Hinweis (Figur markieren, die ziehen muss), Lösung vorspielen. Keine weiteren Erklärungen.
- **Fortschritt**: je Stufe gelöste Rätsel und Erfolgsquote beim ersten Versuch, Serie richtiger Lösungen. Neue Rätsel werden bevorzugt, danach falsch gelöste wiederholt.
- **Eigene Rätsel**:
  1. Stellung aufbauen (Figuren-Palette, Grundstellung/leeres Brett, FEN einfügen, Seite am Zug)
  2. Lösung vorspielen (eigene Züge + Antworten des Gegners)
  3. Name und Schwierigkeit vergeben und speichern
  - Teilen mit Freunden als Text-Code (`SCHACH:…`) über das iOS-Teilen-Menü, Import per „Code einfügen“.

### 2.4 Modus „Einzelspieler“ (Kann)

- Gegner ist die freie Engine **Stockfish** (läuft lokal im Gerät, kein Internet nötig).
- Spielstärke in ca. 8 Stufen (Anfänger bis stark), Farbe wählbar.
- Optional: Hinweis-/Analysefunktion („bester Zug“), Partie nachträglich analysieren.
- Umgesetzt mit Stockfish 19 „lite single“ (≈ 1,8 MB), 8 Stufen.

### 2.5 Modus „2 Spieler online“ (Zukunft)

- **Nur gegen Freunde**: Partie erstellen → Einladungslink/Code an Freund schicken → Freund tritt bei. Kein Matchmaking mit Fremden.
- Echtzeit-Zugübertragung, Schachuhr serverseitig geprüft, Wiederverbinden nach Verbindungsabbruch.
- Benachrichtigung „Du bist am Zug“ (Push).
- Optional: Fernschach-Modus (Tage pro Zug) – deutlich einfacher als Echtzeit und passt gut zum Handy.
- Ohne Benutzerkonto: Spieler werden über ein zufälliges Geräte-Token und einen frei wählbaren Namen identifiziert.

### 2.6 Bildschirme (Übersicht)

```
Start
├── Neue Partie (2 Spieler lokal) ── Einstellungen ── Brett
├── Gegen Computer ─────────────── Stufe/Farbe ── Brett
├── Rätsel ── Leicht | Mittel | Schwer | Eigene (+ Editor) ── Rätselbrett
├── Partiehistorie ── Partie nachspielen
├── Statistik
└── Einstellungen
```

---

## 3. Technisches Konzept

### 3.1 Plattform-Entscheidung

| Option | Vorteile | Nachteile |
|---|---|---|
| **A) Progressive Web App (PWA)** – *Empfehlung* | Kein Mac, kein Apple-Entwicklerkonto (99 €/Jahr), keine App-Store-Prüfung. Über Safari „Zum Home-Bildschirm“ installierbar, startet im Vollbild, läuft offline. Funktioniert zusätzlich auf Android/PC. Sehr schnelle Iteration. Push-Benachrichtigungen auf iOS seit 16.4 möglich. | Etwas weniger „nativ“ (Haptik eingeschränkt), nicht im App Store auffindbar. |
| B) Native iOS-App (Swift/SwiftUI) | Beste Integration, App Store, Game Center (wäre später ideal für Online-Modus). | Benötigt Mac + Xcode; ohne bezahltes Konto muss die App alle 7 Tage neu signiert werden. Nur iPhone. |
| C) Hybrid (PWA-Code + Capacitor) | Start als PWA, später derselbe Code als echte App im App Store. | Für App Store dennoch Mac + Konto nötig. |

**Empfehlung:** Start mit **A (PWA)**, Architektur so, dass später **C** ohne Neuschreiben möglich ist.

### 3.2 Technologie-Stack

| Bereich | Technologie | Begründung |
|---|---|---|
| Sprache | TypeScript | Typsicherheit, gute Wartbarkeit |
| UI-Framework | React + Vite | Verbreitet, schnell, gute PWA-Unterstützung |
| Schachregeln | `chess.js` | Bewährte Bibliothek: Zuggenerierung, Matt/Remis, FEN/PGN |
| Schachbrett | `chessground` (Brett von Lichess) | Touch-optimiert, Animationen, Drag & Drop, Pfeile |
| Engine | Stockfish als WebAssembly (Single-Thread-Variante) | Läuft offline im Web Worker; Single-Thread nötig, da einfache Hoster keine Spezial-Header erlauben |
| Offline | Service Worker via `vite-plugin-pwa` (Workbox) | Alle Dateien inkl. Rätsel und Engine werden beim ersten Aufruf gecacht |
| Speicher | `localStorage` (+ Export/Import als Datei) | Datenmenge ist klein (Partien, Fortschritt, eigene Rätsel); bleibt in installierten Home-Bildschirm-Apps erhalten |
| Tests | Vitest (Logik), Playwright (UI, iPhone-Emulation) | |
| Hosting | GitHub Pages oder Cloudflare Pages | Kostenlos, HTTPS (Pflicht für Service Worker) |

### 3.3 Architektur

```
┌──────────────────────────── PWA (läuft im Safari / Home-Bildschirm) ────────────────────────────┐
│  UI-Schicht (React-Komponenten)                                                                  │
│    Startseite · Brett · Uhr · Zugliste · Rätselansicht · Statistik · Einstellungen               │
│                                   │                                                              │
│  Spiel-Logik (reines TypeScript, ohne UI)                                                        │
│    GameController ── chess.js        PuzzleController        Clock                               │
│         │                                                                                        │
│    Gegner-Schnittstelle  «Opponent»                                                              │
│      ├── LocalHumanOpponent   (2 Spieler lokal)                                                  │
│      ├── EngineOpponent       (Stockfish im Web Worker)                                          │
│      └── RemoteOpponent       (später: Online, über Netzwerk)                                    │
│                                   │                                                              │
│  Persistenz (localStorage)        Assets (Service-Worker-Cache)                                     │
│    games · puzzleProgress ·     App-Code · Figurengrafiken · puzzles.json · stockfish.wasm       │
│    stats · settings                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Kernidee: **Die Spiellogik kennt nur eine abstrakte „Gegner“-Schnittstelle.** Ob der Zug von einer Person am selben Gerät, von Stockfish oder später vom Server kommt, ist austauschbar. Dadurch ist der Online-Modus später eine Erweiterung, kein Umbau.

### 3.4 Datenmodell (vereinfacht)

```ts
Game {
  id, createdAt, mode: 'local' | 'engine' | 'online',
  white: { name }, black: { name },
  timeControl: { initialSec, incrementSec } | null,
  pgn, fen, result: '1-0' | '0-1' | '1/2-1/2' | '*', endReason
}

Puzzle {           // aus Lichess-Datenbank, mitgeliefert
  id, fen, moves: string[],   // UCI, erster Zug = Gegnerzug
  rating, themes: string[]
}

CustomPuzzle {     // eigenes Rätsel
  id, name, fen, moves: string[], level: 'leicht' | 'mittel' | 'schwer'
}

PuzzleProgress { [stufe]: { solved: string[], failed: string[] } }
```

### 3.5 Rätsel-Daten

- Lichess-Datenbank (CSV, ~ 250 MB) wird **einmalig per Skript** im Repo gefiltert:
  nur Aufgaben mit hoher Popularität und vielen Spielen, gleichmäßig über Wertungen 600–2600 und Themen verteilt.
- Ergebnis: komprimierte JSON-Datei (≈ 0,5–1 MB für 10 000 Rätsel), wird mit der App ausgeliefert.
- Später erweiterbar: zusätzliche Rätselpakete nachladen, wenn online.

### 3.6 Offline-Fähigkeit auf dem iPhone

- Beim ersten Öffnen (mit Internet) lädt der Service Worker alles in den Cache (≈ 3–10 MB inkl. Engine).
- Danach startet die App vom Home-Bildschirm ohne jede Verbindung.
- Wichtig: Als Home-Bildschirm-App installiert, löscht iOS die gespeicherten Daten nicht automatisch (bei reiner Nutzung im Safari-Tab kann das nach längerer Nichtnutzung passieren). → App zeigt einen Hinweis „Zum Home-Bildschirm hinzufügen“.
- Zusätzlich: Export/Import der eigenen Daten (Backup-Datei) als Absicherung.
- Updates: Neue Version wird im Hintergrund geladen, Hinweis „Update verfügbar – neu starten“.

### 3.7 Online-Modus (Ausblick)

| Option | Beschreibung | Einschätzung |
|---|---|---|
| **Supabase** (Postgres + Realtime + Auth) | Partie = Datenbankzeile, Züge werden per Realtime an den Gegner übertragen | *Empfehlung*: kostenloser Einstieg, wenig eigener Servercode |
| Firebase (Firestore) | Ähnlich, Google-Dienst | Gut, aber Datenstandort/Abhängigkeit beachten |
| Eigener Server (Node.js + WebSockets, z. B. Cloudflare Durable Objects) | Volle Kontrolle, Uhr serverseitig exakt | Mehr Aufwand, erst bei Bedarf |

Ablauf: Spieler A erstellt Partie → bekommt Link/Code → Spieler B öffnet Link → beide verbinden sich mit dem Partie-Kanal → jeder Zug wird **serverseitig mit chess.js validiert** (Schutz vor Manipulation) → an den Gegner gesendet. Anmeldung anfangs anonym oder per Magic-Link (E-Mail), kein Passwort.

### 3.8 Qualitätssicherung

- Unit-Tests für Regeln/Remis-Erkennung, Uhr, Rätsel-Ablauf und Wertungsberechnung (Perft-Tests für Zuggenerierung).
- UI-Tests mit Playwright im iPhone-Profil (Safari/WebKit).
- Manueller Test auf echtem iPhone: Installation, Flugmodus-Test, Hoch-/Querformat, Dark Mode.

---

## 4. Umsetzungsplan (Meilensteine)

| # | Meilenstein | Inhalt | Ergebnis |
|---|---|---|---|
| M1 | Grundgerüst | Projekt-Setup, PWA, Hosting, Brett mit legalen Zügen | Auf iPhone installierbar, Figuren ziehbar |
| M2 | 2 Spieler lokal | Partieablauf, Umwandlung, Ende-Erkennung, Uhr, Brettdrehung, Autosave, Historie, PGN-Export | **Erster nutzbarer Stand** |
| M3 | Rätsel | Datenaufbereitung, Rätselansicht, 3 Schwierigkeitsgrade, eigene Rätsel + Editor, Fortschritt | **Alle Muss-Funktionen fertig** |
| M4 | Einzelspieler | Stockfish im Worker, Stärkestufen, Hinweisfunktion | Gegen Computer spielbar |
| M5 | Feinschliff | Designs, Sounds, Haptik, Backup, Barrierefreiheit | Version 1.0 |
| M6 | Online | Backend, Einladungslinks, Echtzeitzüge, Push | Online-Partien mit Freunden |

---

## 5. Entscheidungen (abgestimmt am 06.11.2026)

| Thema | Entscheidung |
|---|---|
| Plattform | Web-App (PWA), installiert über Safari „Zum Home-Bildschirm“ |
| Zielgruppe | Nur für mich und Freunde, kein App Store |
| Erklärungen | Nicht nötig |
| Rätsel | 3 wählbare Schwierigkeitsgrade + eigene Rätsel |
| Lokaler Modus | Schachuhr optional; Tischmodus oder Weiterreichen wählbar |
| Design | Klassisch (Holzoptik, braunes Brett); iPhone **und** iPad (Hoch- und Querformat) |
| Online (später) | Nur gegen Freunde |
| Konto | Vorerst keine Anmeldung |

### Umsetzungsstand

- [x] M1 Grundgerüst (PWA, Offline-Cache, Hosting-Workflow für GitHub Pages)
- [x] M2 2 Spieler lokal
- [x] M3 Rätsel (3 Stufen, eigene Rätsel)
- [x] M4 Einzelspieler gegen Stockfish
- [ ] M5 Feinschliff (weitere Brett-/Figurendesigns, Puzzle-Rush, Themenauswahl)
- [ ] M6 Online gegen Freunde
