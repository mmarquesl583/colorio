-- =========================================================================
-- color.io — schema de estatísticas / histórico / conquistas / títulos /
-- avatares / progresso de campanha. Cole este arquivo inteiro no SQL
-- Editor do Supabase (dashboard → SQL Editor → New query) e rode uma vez.
-- Toda escrita nas tabelas abaixo acontece exclusivamente pela
-- service-role key (servidor) ou pelas funções SECURITY DEFINER no final —
-- não existe NENHUMA policy de insert/update/delete para anon/authenticated
-- em lugar nenhum deste arquivo.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. profiles — só os campos que NÃO existem em auth.users/user_metadata
--    (nome de usuário = user_metadata.display_name, avatar equipado =
--    user_metadata.avatar_icon — ambos reaproveitados, não duplicados aqui)
-- ---------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  title_id text null,
  first_seen_at timestamptz not null default now(),
  last_login_at timestamptz null,
  last_played_at timestamptz null,
  session_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. player_stats — agregado geral. Só soma/contagem bruta; toda
--    média/taxa (avg_score, win_rate, avg_session_time, avg_match_time,
--    precisão) é calculada no client a partir destes números, nunca
--    guardada — não pode haver divergência.
-- ---------------------------------------------------------------------
create table public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  games_played integer not null default 0,
  games_won integer not null default 0,
  games_lost integer not null default 0,
  games_drawn integer not null default 0,
  abandoned_games integer not null default 0,
  total_score bigint not null default 0,
  best_score integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  total_perfects integer not null default 0,
  current_answer_streak integer not null default 0,
  best_answer_streak integer not null default 0,
  current_perfect_streak integer not null default 0,
  best_perfect_streak integer not null default 0,
  total_playtime_seconds bigint not null default 0,
  longest_session_seconds integer not null default 0,
  total_match_duration_seconds bigint not null default 0,
  current_day_streak integer not null default 0,
  best_day_streak integer not null default 0,
  last_play_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. player_mode_stats — mode_id é texto livre de propósito: novos modos
--    nunca devem exigir mudar o schema. Hoje mode_id = 'players' | 'ai'
--    (o RoomConfig.phraseMode atual), mas o campo aceita qualquer string.
-- ---------------------------------------------------------------------
create table public.player_mode_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode_id text not null,
  games_played integer not null default 0,
  wins integer not null default 0,
  perfects integer not null default 0,
  best_score integer not null default 0,
  total_score bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode_id)
);

-- ---------------------------------------------------------------------
-- 4. player_theme_stats — theme_id texto livre, mesmo motivo. rounds_played
--    = correct_answers + wrong_answers sempre. best_score aqui é de UMA
--    rodada (escala 0-1000), diferente do best_score de player_stats/
--    player_mode_stats que é total de partida.
-- ---------------------------------------------------------------------
create table public.player_theme_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id text not null,
  rounds_played integer not null default 0,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  perfects integer not null default 0,
  best_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, theme_id)
);

-- ---------------------------------------------------------------------
-- 5. match_history — uma linha por jogador por partida concluída.
-- ---------------------------------------------------------------------
create table public.match_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null,
  room_code text not null,
  mode_id text not null,
  theme_ids text[] not null default '{}',
  difficulty text null,
  score integer not null,
  correct_answers integer not null default 0,
  wrong_answers integer not null default 0,
  perfects integer not null default 0,
  result text not null check (result in ('won','lost','drawn')),
  duration_seconds integer not null default 0,
  played_at timestamptz not null default now()
);
create index match_history_user_played_idx on public.match_history (user_id, played_at desc);
create index match_history_match_idx on public.match_history (match_id);

-- ---------------------------------------------------------------------
-- 6. game_sessions — "sessão" = tempo conectado a uma sala (não tempo no
--    menu inicial). Fecha no disconnect, sempre — não depende do timer de
--    reconexão da sala (aquele é sobre manter a vaga, não sobre contar
--    tempo), então nunca fica "aberta" indefinidamente se alguém só fecha
--    a aba.
-- ---------------------------------------------------------------------
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_code text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  duration_seconds integer null
);
create index game_sessions_user_idx on public.game_sessions (user_id, started_at desc);
create index game_sessions_open_idx on public.game_sessions (id) where ended_at is null;

-- ---------------------------------------------------------------------
-- 7. player_play_days — contador O(1) de dias distintos jogados (evita
--    escanear o histórico inteiro toda vez).
-- ---------------------------------------------------------------------
create table public.player_play_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  play_date date not null,
  primary key (user_id, play_date)
);

-- ---------------------------------------------------------------------
-- 8. campaign_progress — schema pronto, mas SEM nenhum escritor ainda:
--    hoje a campanha é só um card "EM BREVE" no client, não existe o loop
--    de jogo single-player em lugar nenhum. Esta tabela fica pronta pra
--    quando esse modo for implementado. stage_id é texto livre, definido
--    pela futura implementação da campanha.
-- ---------------------------------------------------------------------
create table public.campaign_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  stage_id text not null,
  completed boolean not null default false,
  perfect boolean not null default false,
  best_score integer not null default 0,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, stage_id)
);

-- ---------------------------------------------------------------------
-- 9 & 10. player_avatars / player_titles — mesmo padrão de desbloqueio.
--    avatar_id/title_id são texto livre batendo com os ids de
--    shared/avatarIcons.ts / shared/titleCatalog.ts (array TS, não tabela
--    — mesmo padrão leve já usado pelos temas). Avatares/títulos "grátis"
--    nunca precisam de linha aqui.
-- ---------------------------------------------------------------------
create table public.player_avatars (
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, avatar_id)
);
create table public.player_titles (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- ---------------------------------------------------------------------
-- 11 & 12. Catálogo de conquistas + mapeamento flexível de recompensas.
--    Uma conquista pode dar qualquer número de recompensas de qualquer
--    tipo, sem nunca precisar mudar código/schema no futuro.
-- ---------------------------------------------------------------------
create table public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text null,
  criteria_type text not null,
  criteria_value bigint not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.achievement_rewards (
  id uuid primary key default gen_random_uuid(),
  achievement_id text not null references public.achievements(id) on delete cascade,
  reward_type text not null, -- 'avatar' | 'title' | 'frame' | 'badge' | 'other'
  reward_id text not null
);
create index achievement_rewards_achievement_idx on public.achievement_rewards (achievement_id);

-- ---------------------------------------------------------------------
-- 13. player_achievements — concessões por usuário. Junto com
--    achievement_rewards também serve de registro durável pros tipos de
--    recompensa que ainda não têm tabela própria (frame/badge/other).
-- ---------------------------------------------------------------------
create table public.player_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------------
-- Seed: as 7 conquistas de exemplo do pedido original + recompensas de título.
-- ---------------------------------------------------------------------
insert into public.achievements (id, name, description, icon, criteria_type, criteria_value, sort_order) values
  ('first_match',       'Primeira Pintura',   'Jogue sua primeira partida.',            '🎨', 'games_played',           1,     10),
  ('first_perfect',     'Olho Perfeito',      'Acerte sua primeira cor perfeita.',      '🎯', 'total_perfects',         1,     20),
  ('ten_perfects',      'Colorista',          'Acerte 10 cores perfeitas.',             '🌈', 'total_perfects',         10,    30),
  ('hundred_matches',   'Maratonista',        'Jogue 100 partidas.',                    '🏃', 'games_played',           100,   40),
  ('ten_hours',         'Viciado em Cores',   'Acumule 10 horas de tempo de jogo.',     '⏰', 'total_playtime_seconds', 36000, 50),
  ('streak_twenty',     'Imparável',          'Alcance uma sequência de 20 acertos.',   '🔥', 'best_answer_streak',     20,    60),
  ('campaign_complete', 'Mestre das Cores',   'Complete o modo campanha.',              '👑', 'campaign_complete',      1,     70)
on conflict (id) do nothing;

insert into public.achievement_rewards (achievement_id, reward_type, reward_id) values
  ('first_match',       'title', 'primeira-pintura'),
  ('first_perfect',     'title', 'olho-perfeito'),
  ('ten_perfects',      'title', 'colorista'),
  ('hundred_matches',   'title', 'maratonista'),
  ('ten_hours',         'title', 'viciado-em-cores'),
  ('streak_twenty',     'title', 'imparavel'),
  ('campaign_complete', 'title', 'mestre-das-cores');
-- OBS: 'campaign_complete' não tem branch em check_and_grant_achievements()
-- abaixo ainda — fica inalcançável até o modo campanha existir de verdade.
-- Não é um bloqueio, é uma lacuna conhecida e intencional.

-- ---------------------------------------------------------------------
-- Trigger de updated_at, reaproveitado em toda tabela mutável.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_player_stats_updated_at before update on public.player_stats for each row execute function public.set_updated_at();
create trigger trg_player_mode_stats_updated_at before update on public.player_mode_stats for each row execute function public.set_updated_at();
create trigger trg_player_theme_stats_updated_at before update on public.player_theme_stats for each row execute function public.set_updated_at();
create trigger trg_campaign_progress_updated_at before update on public.campaign_progress for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Espelha first_seen_at/last_login_at de auth.users pra public.profiles
-- (o client não enxerga o schema auth por RLS, mas enxerga public.profiles).
-- ---------------------------------------------------------------------
create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.profiles (user_id, first_seen_at, last_login_at)
    values (new.id, new.created_at, new.last_sign_in_at)
    on conflict (user_id) do nothing;
  elsif TG_OP = 'UPDATE' then
    update public.profiles
      set last_login_at = new.last_sign_in_at
      where user_id = new.id and last_login_at is distinct from new.last_sign_in_at;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_auth_user_sync();
create trigger on_auth_user_updated after update of last_sign_in_at on auth.users
  for each row execute function public.handle_auth_user_sync();

-- ---------------------------------------------------------------------
-- Funções só-servidor. Todas SECURITY DEFINER (ignoram RLS como dono da
-- tabela) com EXECUTE revogado de anon/authenticated logo depois de
-- criadas — só a service-role key consegue chamar. Esta é a linha de
-- segurança mais importante do arquivo inteiro: um jogador nunca pode
-- escrever a própria pontuação/partidas/conquistas.
-- ---------------------------------------------------------------------

create or replace function public.open_game_session(p_user_id uuid, p_room_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.game_sessions (user_id, room_code) values (p_user_id, p_room_code) returning id into v_id;
  insert into public.profiles (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.profiles set session_count = session_count + 1 where user_id = p_user_id;
  return v_id;
end;
$$;

create or replace function public.close_game_session(p_session_id uuid, p_ended_at timestamptz default now())
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid; v_started_at timestamptz; v_duration integer;
begin
  select user_id, started_at into v_user_id, v_started_at
    from public.game_sessions where id = p_session_id and ended_at is null for update;
  if not found then return; end if;

  v_duration := greatest(0, extract(epoch from (p_ended_at - v_started_at))::integer);
  update public.game_sessions set ended_at = p_ended_at, duration_seconds = v_duration where id = p_session_id;

  insert into public.player_stats (user_id) values (v_user_id) on conflict (user_id) do nothing;
  update public.player_stats set
    total_playtime_seconds = total_playtime_seconds + v_duration,
    longest_session_seconds = greatest(longest_session_seconds, v_duration)
    where user_id = v_user_id;
end;
$$;

create or replace function public.close_stale_sessions(p_max_hours integer default 6)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count integer := 0; v_row record; v_capped_end timestamptz; v_duration integer;
begin
  for v_row in
    select * from public.game_sessions
    where ended_at is null and started_at < now() - (p_max_hours || ' hours')::interval
  loop
    v_capped_end := v_row.started_at + (p_max_hours || ' hours')::interval;
    v_duration := extract(epoch from (v_capped_end - v_row.started_at))::integer;
    update public.game_sessions set ended_at = v_capped_end, duration_seconds = v_duration where id = v_row.id;
    update public.player_stats set
      total_playtime_seconds = total_playtime_seconds + v_duration,
      longest_session_seconds = greatest(longest_session_seconds, v_duration)
      where user_id = v_row.user_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.record_abandoned_match(p_user_id uuid)
returns void
language sql security definer set search_path = public
as $$
  insert into public.player_stats (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.player_stats set abandoned_games = abandoned_games + 1 where user_id = p_user_id;
$$;

create or replace function public.apply_match_result(
  p_user_id uuid,
  p_match_id uuid,
  p_room_code text,
  p_mode_id text,
  p_theme_ids text[],
  p_difficulty text,
  p_score integer,
  p_perfects integer,
  p_result text,
  p_duration_seconds integer,
  p_played_at timestamptz,
  p_round_outcomes text[],   -- ordenado 'perfect'|'correct'|'wrong', só rodadas em que o jogador chutou
  p_theme_tallies jsonb      -- [{"theme_id":"pokemon","correct":2,"wrong":1,"perfects":1,"best_score":940}, ...]
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_correct integer; v_wrong integer; v_outcome text; v_theme jsonb;
  v_answer_streak integer; v_perfect_streak integer;
  v_best_answer_streak integer; v_best_perfect_streak integer;
  v_today date := (p_played_at at time zone 'utc')::date;
  v_last_play_date date; v_current_day_streak integer; v_best_day_streak integer;
begin
  select count(*) into v_correct from unnest(p_round_outcomes) o where o in ('correct','perfect');
  select count(*) into v_wrong   from unnest(p_round_outcomes) o where o = 'wrong';

  insert into public.match_history (
    user_id, match_id, room_code, mode_id, theme_ids, difficulty,
    score, correct_answers, wrong_answers, perfects, result, duration_seconds, played_at
  ) values (
    p_user_id, p_match_id, p_room_code, p_mode_id, p_theme_ids, p_difficulty,
    p_score, v_correct, v_wrong, p_perfects, p_result, p_duration_seconds, p_played_at
  );

  insert into public.player_stats (user_id) values (p_user_id) on conflict (user_id) do nothing;

  select current_answer_streak, current_perfect_streak, best_answer_streak, best_perfect_streak,
         last_play_date, current_day_streak, best_day_streak
    into v_answer_streak, v_perfect_streak, v_best_answer_streak, v_best_perfect_streak,
         v_last_play_date, v_current_day_streak, v_best_day_streak
    from public.player_stats where user_id = p_user_id for update;

  foreach v_outcome in array p_round_outcomes loop
    if v_outcome in ('correct','perfect') then v_answer_streak := v_answer_streak + 1; else v_answer_streak := 0; end if;
    v_best_answer_streak := greatest(v_best_answer_streak, v_answer_streak);
    if v_outcome = 'perfect' then v_perfect_streak := v_perfect_streak + 1; else v_perfect_streak := 0; end if;
    v_best_perfect_streak := greatest(v_best_perfect_streak, v_perfect_streak);
  end loop;

  if v_last_play_date is null then v_current_day_streak := 1;
  elsif v_today = v_last_play_date then null;
  elsif v_today = v_last_play_date + 1 then v_current_day_streak := v_current_day_streak + 1;
  else v_current_day_streak := 1;
  end if;
  v_best_day_streak := greatest(v_best_day_streak, v_current_day_streak);

  update public.player_stats set
    games_played = games_played + 1,
    games_won = games_won + (case when p_result = 'won' then 1 else 0 end),
    games_lost = games_lost + (case when p_result = 'lost' then 1 else 0 end),
    games_drawn = games_drawn + (case when p_result = 'drawn' then 1 else 0 end),
    total_score = total_score + p_score,
    best_score = greatest(best_score, p_score),
    correct_answers = correct_answers + v_correct,
    wrong_answers = wrong_answers + v_wrong,
    total_perfects = total_perfects + p_perfects,
    current_answer_streak = v_answer_streak, best_answer_streak = v_best_answer_streak,
    current_perfect_streak = v_perfect_streak, best_perfect_streak = v_best_perfect_streak,
    total_match_duration_seconds = total_match_duration_seconds + p_duration_seconds,
    current_day_streak = v_current_day_streak, best_day_streak = v_best_day_streak,
    last_play_date = v_today
  where user_id = p_user_id;

  insert into public.player_play_days (user_id, play_date) values (p_user_id, v_today)
    on conflict (user_id, play_date) do nothing;

  insert into public.player_mode_stats (user_id, mode_id, games_played, wins, perfects, best_score, total_score)
  values (p_user_id, p_mode_id, 1, case when p_result='won' then 1 else 0 end, p_perfects, p_score, p_score)
  on conflict (user_id, mode_id) do update set
    games_played = player_mode_stats.games_played + 1,
    wins = player_mode_stats.wins + (case when p_result='won' then 1 else 0 end),
    perfects = player_mode_stats.perfects + p_perfects,
    best_score = greatest(player_mode_stats.best_score, p_score),
    total_score = player_mode_stats.total_score + p_score;

  for v_theme in select * from jsonb_array_elements(p_theme_tallies) loop
    insert into public.player_theme_stats (user_id, theme_id, rounds_played, correct_answers, wrong_answers, perfects, best_score)
    values (
      p_user_id, v_theme->>'theme_id',
      (v_theme->>'correct')::integer + (v_theme->>'wrong')::integer,
      (v_theme->>'correct')::integer, (v_theme->>'wrong')::integer,
      (v_theme->>'perfects')::integer, (v_theme->>'best_score')::integer
    )
    on conflict (user_id, theme_id) do update set
      rounds_played = player_theme_stats.rounds_played + (v_theme->>'correct')::integer + (v_theme->>'wrong')::integer,
      correct_answers = player_theme_stats.correct_answers + (v_theme->>'correct')::integer,
      wrong_answers = player_theme_stats.wrong_answers + (v_theme->>'wrong')::integer,
      perfects = player_theme_stats.perfects + (v_theme->>'perfects')::integer,
      best_score = greatest(player_theme_stats.best_score, (v_theme->>'best_score')::integer);
  end loop;

  update public.profiles set last_played_at = p_played_at where user_id = p_user_id;
end;
$$;

create or replace function public.check_and_grant_achievements(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_stats record; v_ach record; v_reward record;
begin
  select * into v_stats from public.player_stats where user_id = p_user_id;
  if not found then return; end if;

  for v_ach in
    select a.* from public.achievements a
    where not exists (select 1 from public.player_achievements pa where pa.user_id = p_user_id and pa.achievement_id = a.id)
  loop
    if (
      (v_ach.criteria_type = 'games_played'           and v_stats.games_played           >= v_ach.criteria_value) or
      (v_ach.criteria_type = 'games_won'               and v_stats.games_won              >= v_ach.criteria_value) or
      (v_ach.criteria_type = 'total_perfects'          and v_stats.total_perfects         >= v_ach.criteria_value) or
      (v_ach.criteria_type = 'total_playtime_seconds'  and v_stats.total_playtime_seconds >= v_ach.criteria_value) or
      (v_ach.criteria_type = 'best_answer_streak'      and v_stats.best_answer_streak     >= v_ach.criteria_value) or
      (v_ach.criteria_type = 'best_perfect_streak'     and v_stats.best_perfect_streak    >= v_ach.criteria_value)
      -- 'campaign_complete' propositalmente sem branch — ver nota no seed acima.
    ) then
      insert into public.player_achievements (user_id, achievement_id) values (p_user_id, v_ach.id) on conflict do nothing;
      for v_reward in select * from public.achievement_rewards where achievement_id = v_ach.id loop
        if v_reward.reward_type = 'avatar' then
          insert into public.player_avatars (user_id, avatar_id) values (p_user_id, v_reward.reward_id) on conflict do nothing;
        elsif v_reward.reward_type = 'title' then
          insert into public.player_titles (user_id, title_id) values (p_user_id, v_reward.reward_id) on conflict do nothing;
        end if;
        -- 'frame'/'badge'/'other': recuperável depois via player_achievements ⋈ achievement_rewards.
      end loop;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Player-callable function: unlike everything above, this one is meant to
-- be invoked by the logged-in player themselves (via supabase.rpc from the
-- client), so it uses auth.uid() internally rather than trusting a
-- p_user_id argument, and it verifies ownership before allowing a title to
-- be equipped — the same "don't trust the client" rule, just applied to a
-- player-initiated action instead of a server-only one. profiles has no
-- update policy for authenticated (see RLS below), so this SECURITY
-- DEFINER function is the only legitimate way to change title_id.
--
-- 'novato' is the one always-free title from shared/titleCatalog.ts — kept
-- in sync by hand since it's a single stable value; if more free titles
-- are added later, extend the check below to match.
-- ---------------------------------------------------------------------
create or replace function public.equip_title(p_title_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  if p_title_id is not null
     and p_title_id <> 'novato'
     and not exists (select 1 from public.player_titles where user_id = v_uid and title_id = p_title_id)
  then
    return;
  end if;
  insert into public.profiles (user_id, title_id) values (v_uid, p_title_id)
    on conflict (user_id) do update set title_id = excluded.title_id;
end;
$$;
grant execute on function public.equip_title(text) to authenticated;

revoke execute on function
  public.open_game_session(uuid, text),
  public.close_game_session(uuid, timestamptz),
  public.close_stale_sessions(integer),
  public.record_abandoned_match(uuid),
  public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb),
  public.check_and_grant_achievements(uuid)
from public, anon, authenticated;
grant execute on function
  public.open_game_session(uuid, text),
  public.close_game_session(uuid, timestamptz),
  public.close_stale_sessions(integer),
  public.record_abandoned_match(uuid),
  public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb),
  public.check_and_grant_achievements(uuid)
to service_role;

-- ---------------------------------------------------------------------
-- RLS — ativado em toda tabela; SELECT só da própria linha (catálogo de
-- conquistas é legível por todo mundo logado); NENHUMA policy de
-- insert/update/delete pra anon/authenticated em lugar nenhum.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.player_mode_stats enable row level security;
alter table public.player_theme_stats enable row level security;
alter table public.match_history enable row level security;
alter table public.game_sessions enable row level security;
alter table public.player_play_days enable row level security;
alter table public.campaign_progress enable row level security;
alter table public.player_avatars enable row level security;
alter table public.player_titles enable row level security;
alter table public.achievements enable row level security;
alter table public.achievement_rewards enable row level security;
alter table public.player_achievements enable row level security;

create policy "own profile read" on public.profiles for select using (auth.uid() = user_id);
create policy "own stats read" on public.player_stats for select using (auth.uid() = user_id);
create policy "own mode stats read" on public.player_mode_stats for select using (auth.uid() = user_id);
create policy "own theme stats read" on public.player_theme_stats for select using (auth.uid() = user_id);
create policy "own match history read" on public.match_history for select using (auth.uid() = user_id);
create policy "own sessions read" on public.game_sessions for select using (auth.uid() = user_id);
create policy "own play days read" on public.player_play_days for select using (auth.uid() = user_id);
create policy "own campaign read" on public.campaign_progress for select using (auth.uid() = user_id);
create policy "own avatars read" on public.player_avatars for select using (auth.uid() = user_id);
create policy "own titles read" on public.player_titles for select using (auth.uid() = user_id);
create policy "own achievements read" on public.player_achievements for select using (auth.uid() = user_id);
create policy "achievements catalog read" on public.achievements for select to authenticated using (true);
create policy "achievement rewards catalog read" on public.achievement_rewards for select to authenticated using (true);

revoke insert, update, delete on
  public.profiles, public.player_stats, public.player_mode_stats, public.player_theme_stats,
  public.match_history, public.game_sessions, public.player_play_days, public.campaign_progress,
  public.player_avatars, public.player_titles, public.player_achievements
from authenticated, anon;
