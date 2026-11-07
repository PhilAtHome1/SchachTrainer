# Online-Partien einrichten (Supabase)

Für Online-Partien mit Freunden braucht die App einen kleinen Server. Wir nutzen dafür
[Supabase](https://supabase.com) im kostenlosen Tarif. Die Einrichtung ist einmalig und dauert etwa 5 Minuten.
Niemand muss sich in der App registrieren: Jedes Gerät meldet sich automatisch anonym an.

## 1. Projekt anlegen

1. Auf <https://supabase.com> ein kostenloses Konto erstellen (z. B. mit dem GitHub-Konto).
2. **New project** wählen:
   - Name: `schachtrainer`
   - Datenbank-Passwort: irgendein sicheres Passwort (wird später nicht gebraucht)
   - Region: **Central EU (Frankfurt)**
3. Warten, bis das Projekt bereit ist (1–2 Minuten).

## 2. Datenbank einrichten

1. Links **SQL Editor** öffnen → **New query**.
2. Den kompletten Inhalt der Datei [`supabase/schema.sql`](../supabase/schema.sql) hineinkopieren.
3. **Run** drücken. Es sollte „Success“ erscheinen.

Das Skript kann später gefahrlos erneut ausgeführt werden (z. B. nach einem App-Update).

## 3. Anonyme Anmeldung erlauben

1. Links **Authentication** öffnen.
2. Unter **Sign In / Providers** (bzw. *Providers* oder *Settings*) die Option
   **Allow anonymous sign-ins** einschalten und speichern.

## 4. Zugangsdaten kopieren

Unter **Project Settings** → **API** (bzw. *Data API* / *API Keys*) zwei Werte notieren:

- **Project URL**, z. B. `https://abcdefgh.supabase.co`
- **Publishable key** (beginnt mit `sb_publishable_…`) oder – bei älteren Projekten – der **anon public** Key

Beide Werte sind *öffentlich* und dürfen in der App stehen. Geschützt werden die Daten durch die Regeln
in `schema.sql`: Jeder sieht nur die eigenen Partien, und Züge sind nur möglich, wenn man am Zug ist.
Den **secret / service_role** Key niemals verwenden oder weitergeben.

## 5. In GitHub eintragen

1. Im Repository **Settings → Secrets and variables → Actions** öffnen.
2. Reiter **Variables** → **New repository variable**, zweimal:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = Publishable/anon Key
3. Unter **Actions** den Workflow **Deploy auf GitHub Pages** öffnen → **Run workflow**.

Nach dem Durchlauf ist der Menüpunkt **Online mit Freunden** in der App aktiv.
Auf dem iPhone die App einmal schließen und neu öffnen; oben erscheint „Neue Version verfügbar“ → **Aktualisieren**.

## So spielt ihr

1. Beide tragen unter **Online mit Freunden** ihren Namen ein.
2. Einer tippt **Neue Partie**, wählt *Live* (optional mit Uhr) oder *Fernschach* und schickt den
   **6-stelligen Code** über **Einladen** (z. B. per WhatsApp).
3. Der andere tippt **Beitreten** und gibt den Code ein. Die Partie startet sofort.

Tipp: Den Code immer in der installierten App (Home-Bildschirm) eingeben. Safari und die installierte
App haben auf dem iPhone getrennte Speicher – wer im Safari-Tab beitritt, findet die Partie sonst nicht in der App.

## Gut zu wissen

- **Pausierte Projekte:** Supabase pausiert kostenlose Projekte nach etwa einer Woche ohne Nutzung.
  Dann im Supabase-Dashboard auf **Restore project** tippen; die Partien bleiben erhalten.
- **Gerät gewechselt oder App-Daten gelöscht:** Die anonyme Anmeldung hängt am Gerät. Die Datensicherung
  in den Einstellungen enthält die Anmeldung; nach dem Wiederherstellen sind die Online-Partien wieder da.
- **Benachrichtigungen** („Du bist am Zug“) gibt es noch nicht. Beim Öffnen der App zeigt die Startseite an,
  in wie vielen Partien du am Zug bist.
- **Kosten:** Für eine Handvoll Freunde reicht der kostenlose Tarif bei Weitem.
