# SchachTrainer

Schach-Web-App für iPhone und iPad, die nach der Installation **komplett offline** läuft.

- **2 Spieler lokal**: Weiterreichen (Brett dreht sich) oder Tischmodus (Gerät liegt zwischen den Spielern), optionale Schachuhr mit Zeitzuschlag, Remis/Aufgabe, Zugrücknahme, Partien nachspielen und als PGN teilen
- **Schachrätsel**: 3 × 3.000 Aufgaben aus der Lichess-Datenbank (leicht/mittel/schwer), Hinweis, Lösung, Fortschritt
- **Eigene Rätsel**: Stellung aufbauen, Lösung vorspielen, als Code mit Freunden teilen
- **Gegen Computer**: Stockfish 19 (WebAssembly) mit 8 Stufen, auch ab einer selbst nachgebauten Stellung
- **Joker**: bis zu 3 Mal pro Spieler und Partie den besten Zug von Stockfish anzeigen (2 Spieler + Computer)
- **Online mit Freunden**: Live (optional mit Uhr) oder Fernschach, Einladung per Code – Einrichtung siehe [docs/ONLINE-EINRICHTUNG.md](docs/ONLINE-EINRICHTUNG.md)

Das fachliche und technische Konzept steht in [KONZEPT.md](KONZEPT.md).

## Auf dem iPhone installieren

1. Die veröffentlichte Adresse (siehe unten) in **Safari** öffnen.
2. **Teilen** (□↑) → **Zum Home-Bildschirm**.
3. Die App einmal vom Home-Bildschirm starten, solange Internet da ist. Danach funktioniert alles offline.

## Veröffentlichen (GitHub Pages)

1. Im Repository unter *Settings → Pages* bei *Source* **GitHub Actions** wählen.
2. Auf `main` pushen (oder den Workflow *Deploy auf GitHub Pages* manuell starten).
3. Die App ist dann unter `https://<benutzer>.github.io/SchachTrainer/` erreichbar.

## Entwicklung

```bash
npm install        # kopiert auch die Stockfish-Engine nach public/engine
npm run dev        # Entwicklungsserver
npm test           # Unit-Tests
npm run build      # Produktions-Build nach dist/
```

Online-Modus lokal ohne Supabase testen (nachgebauter Server, jeder Browser-Tab ist ein Spieler):

```bash
VITE_ONLINE_MOCK=1 npm run dev
```

Mit echtem Server: `.env.local` mit `VITE_SUPABASE_URL=…` und `VITE_SUPABASE_ANON_KEY=…` anlegen.

Die Rätseldateien in `public/puzzles/` werden mit `scripts/build_puzzles.py` aus der
[Lichess-Rätseldatenbank](https://database.lichess.org/#puzzles) (CC0) erzeugt.

## Lizenzen

Stockfish und chessground stehen unter GPLv3, die Figuren (cburnett) unter CC BY-SA 3.0, die Rätsel unter CC0.
