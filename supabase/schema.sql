-- SchachTrainer – Online-Partien mit Freunden
-- Einmalig im Supabase-Dashboard unter "SQL Editor" ausführen.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.
--
-- Prinzip: Die Tabelle ist nur lesbar (für die beiden Spieler). Alle Änderungen laufen über
-- die Funktionen unten, die prüfen, wer am Zug ist, und die Schachuhr auf dem Server führen.
-- Die Legalität der Züge prüfen beide Apps mit chess.js.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('live', 'corr')),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'aborted')),
  creator_id uuid not null,
  white_id uuid,
  black_id uuid,
  white_name text,
  black_name text,
  start_fen text,
  moves text[] not null default '{}',
  fen text not null,
  tc_initial int,
  tc_inc int,
  clock_w bigint,
  clock_b bigint,
  last_move_at timestamptz,
  draw_offer text check (draw_offer in ('w', 'b')),
  result text check (result in ('1-0', '0-1', '1/2-1/2')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_white_idx on public.games (white_id);
create index if not exists games_black_idx on public.games (black_id);

alter table public.games enable row level security;
alter table public.games replica identity full;

drop policy if exists "Spieler sehen ihre Partien" on public.games;
create policy "Spieler sehen ihre Partien" on public.games
  for select to authenticated
  using (auth.uid() = white_id or auth.uid() = black_id or auth.uid() = creator_id);

revoke all on public.games from anon, authenticated;
grant select on public.games to authenticated;

-- Echtzeit-Benachrichtigungen bei Änderungen
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games') then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;

-- ---------- Hilfsfunktionen ----------

create or replace function public.server_now() returns timestamptz
language sql stable as $$ select now() $$;

create or replace function public._my_color(g public.games) returns text
language sql immutable as $$
  select case when auth.uid() = g.white_id then 'w' when auth.uid() = g.black_id then 'b' end
$$;

-- Spieler am Zug (aus der FEN)
create or replace function public._turn(g public.games) returns text
language sql immutable as $$ select split_part(g.fen, ' ', 2) $$;

-- Verbleibende Zeit (ms) des Spielers am Zug
create or replace function public._remaining(g public.games) returns bigint
language sql stable as $$
  select case
    when g.tc_initial is null then null
    when coalesce(array_length(g.moves, 1), 0) = 0 then
      case when public._turn(g) = 'w' then g.clock_w else g.clock_b end
    else
      (case when public._turn(g) = 'w' then g.clock_w else g.clock_b end)
        - (extract(epoch from (now() - g.last_move_at)) * 1000)::bigint
  end
$$;

-- Netzwerk-Toleranz: Züge, die bis zu 0,5 s nach Ablauf der Zeit ankommen, zählen noch
-- (Verzögerung im Mobilfunknetz). Erst danach gilt die Zeit als überschritten.
create or replace function public._grace_ms() returns bigint
language sql immutable as $$ select 500::bigint $$;

-- Partie beenden; die laufende Uhr wird dabei auf die tatsächliche Restzeit gesetzt
-- (bei Zeitüberschreitung also auf 0), damit die Anzeige danach stimmt.
create or replace function public._finish(p_id uuid, p_result text, p_reason text) returns public.games
language plpgsql as $$
declare
  g public.games;
  left_ms bigint;
begin
  select * into g from public.games where id = p_id;
  if g.tc_initial is not null and coalesce(array_length(g.moves, 1), 0) > 0 and g.status = 'active' then
    left_ms := greatest(public._remaining(g), 0);
    if public._turn(g) = 'w' then g.clock_w := left_ms; else g.clock_b := left_ms; end if;
  end if;
  update public.games
     set status = 'finished', result = p_result, reason = p_reason, draw_offer = null,
         clock_w = g.clock_w, clock_b = g.clock_b, updated_at = now()
   where id = p_id
  returning * into g;
  return g;
end $$;

-- ---------- Partie anlegen / beitreten ----------

create or replace function public.create_game(
  p_mode text, p_color text, p_name text, p_tc_initial int default null, p_tc_inc int default null,
  p_start_fen text default null
) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  col text := p_color;
  new_code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  g public.games;
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  if p_mode not in ('live', 'corr') then raise exception 'Ungültiger Modus'; end if;
  if col = 'random' then col := case when random() < 0.5 then 'w' else 'b' end; end if;
  if col not in ('w', 'b') then raise exception 'Ungültige Farbe'; end if;
  if p_mode = 'corr' then p_tc_initial := null; p_tc_inc := null; end if;
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where code = new_code);
  end loop;
  insert into public.games (code, mode, creator_id, white_id, black_id, white_name, black_name,
                            start_fen, fen, tc_initial, tc_inc, clock_w, clock_b)
  values (new_code, p_mode, uid,
          case when col = 'w' then uid end, case when col = 'b' then uid end,
          case when col = 'w' then left(p_name, 30) end, case when col = 'b' then left(p_name, 30) end,
          p_start_fen,
          coalesce(p_start_fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
          p_tc_initial, coalesce(p_tc_inc, 0),
          p_tc_initial::bigint * 1000, p_tc_initial::bigint * 1000)
  returning * into g;
  return g;
end $$;

create or replace function public.join_game(p_code text, p_name text) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g public.games;
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  select * into g from public.games where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Keine Partie mit diesem Code gefunden'; end if;
  if uid in (g.white_id, g.black_id) then return g; end if;
  if g.status <> 'waiting' then raise exception 'Diese Partie hat bereits zwei Spieler'; end if;
  update public.games set
    white_id = coalesce(white_id, uid),
    white_name = case when white_id is null then left(p_name, 30) else white_name end,
    black_id = coalesce(black_id, uid),
    black_name = case when black_id is null then left(p_name, 30) else black_name end,
    status = 'active', last_move_at = now(), updated_at = now()
  where id = g.id
  returning * into g;
  return g;
end $$;

-- ---------- Spielzüge ----------

create or replace function public.make_move(
  p_id uuid, p_ply int, p_san text, p_fen text, p_result text default null, p_reason text default null
) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  mover text;
  n int;
  left_ms bigint;
begin
  select * into g from public.games where id = p_id for update;
  if not found then raise exception 'Partie nicht gefunden'; end if;
  if g.status <> 'active' then raise exception 'Die Partie läuft nicht'; end if;
  mover := public._turn(g);
  if public._my_color(g) is distinct from mover then raise exception 'Du bist nicht am Zug'; end if;
  n := coalesce(array_length(g.moves, 1), 0);
  if n <> p_ply then raise exception 'Spielstand veraltet – bitte neu laden'; end if;
  if p_result is not null and p_result not in ('1-0', '0-1', '1/2-1/2') then raise exception 'Ungültiges Ergebnis'; end if;

  -- Schachuhr (läuft ab dem ersten Zug von Weiß)
  if g.tc_initial is not null and n > 0 then
    left_ms := public._remaining(g);
    if left_ms <= -public._grace_ms() then
      return public._finish(g.id, case when mover = 'w' then '0-1' else '1-0' end, 'Zeitüberschreitung');
    end if;
    left_ms := greatest(left_ms, 0) + g.tc_inc * 1000;
    if mover = 'w' then g.clock_w := left_ms; else g.clock_b := left_ms; end if;
  end if;

  update public.games set
    moves = moves || p_san,
    fen = p_fen,
    clock_w = g.clock_w,
    clock_b = g.clock_b,
    last_move_at = now(),
    draw_offer = case when draw_offer = mover then draw_offer end,
    status = case when p_result is null then status else 'finished' end,
    result = p_result,
    reason = p_reason,
    updated_at = now()
  where id = g.id
  returning * into g;
  return g;
end $$;

create or replace function public.resign_game(p_id uuid) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  me text;
begin
  select * into g from public.games where id = p_id for update;
  me := public._my_color(g);
  if me is null or g.status <> 'active' then raise exception 'Nicht möglich'; end if;
  return public._finish(g.id, case when me = 'w' then '0-1' else '1-0' end,
                        case when me = 'w' then 'Weiß gibt auf' else 'Schwarz gibt auf' end);
end $$;

create or replace function public.offer_draw(p_id uuid) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  me text;
begin
  select * into g from public.games where id = p_id for update;
  me := public._my_color(g);
  if me is null or g.status <> 'active' then raise exception 'Nicht möglich'; end if;
  update public.games set draw_offer = me, updated_at = now() where id = g.id returning * into g;
  return g;
end $$;

create or replace function public.answer_draw(p_id uuid, p_accept boolean) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  me text;
begin
  select * into g from public.games where id = p_id for update;
  me := public._my_color(g);
  if me is null or g.status <> 'active' or g.draw_offer is null or g.draw_offer = me then
    raise exception 'Kein Remis-Angebot vorhanden';
  end if;
  if p_accept then
    return public._finish(g.id, '1/2-1/2', 'Remis vereinbart');
  end if;
  update public.games set draw_offer = null, updated_at = now() where id = g.id returning * into g;
  return g;
end $$;

-- Zeitüberschreitung feststellen (darf jeder der beiden Spieler aufrufen)
create or replace function public.claim_timeout(p_id uuid) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
begin
  select * into g from public.games where id = p_id for update;
  if public._my_color(g) is null then raise exception 'Nicht möglich'; end if;
  if g.status = 'active' and g.tc_initial is not null and coalesce(array_length(g.moves, 1), 0) > 0
     and public._remaining(g) <= -public._grace_ms() then
    return public._finish(g.id, case when public._turn(g) = 'w' then '0-1' else '1-0' end, 'Zeitüberschreitung');
  end if;
  return g;
end $$;

-- Wartende Partie (noch ohne Gegner) zurückziehen
create or replace function public.abort_game(p_id uuid) returns public.games
language plpgsql security definer set search_path = public as $$
declare
  g public.games;
begin
  select * into g from public.games where id = p_id for update;
  if g.creator_id is distinct from auth.uid() or g.status <> 'waiting' then raise exception 'Nicht möglich'; end if;
  update public.games set status = 'aborted', updated_at = now() where id = g.id returning * into g;
  return g;
end $$;

revoke execute on function public._finish(uuid, text, text) from public, anon, authenticated;
grant execute on function public.server_now() to authenticated;
grant execute on function public.create_game(text, text, text, int, int, text) to authenticated;
grant execute on function public.join_game(text, text) to authenticated;
grant execute on function public.make_move(uuid, int, text, text, text, text) to authenticated;
grant execute on function public.resign_game(uuid) to authenticated;
grant execute on function public.offer_draw(uuid) to authenticated;
grant execute on function public.answer_draw(uuid, boolean) to authenticated;
grant execute on function public.claim_timeout(uuid) to authenticated;
grant execute on function public.abort_game(uuid) to authenticated;
