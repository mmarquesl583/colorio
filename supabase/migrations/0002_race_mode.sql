-- =========================================================================
-- color.io — "Corrida contra o Tempo" (gameMode:'race'). Cole este arquivo
-- inteiro no SQL Editor do Supabase (dashboard → SQL Editor → New query) e
-- rode uma vez, DEPOIS de já ter rodado 0001_player_stats.sql. Não edita
-- nada do 0001 em produção — só adiciona colunas/funções por cima.
--
-- Como no 0001: toda escrita continua exclusiva da service-role key ou das
-- funções SECURITY DEFINER abaixo. Nenhuma policy nova de insert/update/
-- delete pra anon/authenticated é criada aqui.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. player_mode_stats ganha colunas específicas de tempo de resposta.
--    Nomes genéricos (não prefixados "race") porque a tabela já é por
--    modo — outro modo baseado em tempo no futuro reaproveita as mesmas
--    colunas em vez de precisar de outras novas.
-- ---------------------------------------------------------------------
alter table public.player_mode_stats
  add column best_response_ms integer null,
  add column best_correct_response_ms integer null,
  add column best_multiplier numeric(3,2) null,
  add column multiplier_2x_count integer not null default 0,
  add column total_response_ms bigint not null default 0,
  add column timed_rounds_count integer not null default 0,
  add column no_timeout_matches integer not null default 0;

-- ---------------------------------------------------------------------
-- 2. match_history ganha um resumo por partida do modo Corrida — a tabela
--    é uma linha por jogador por PARTIDA (várias rodadas), então isso é
--    agregado (soma/média/melhor), não um histórico rodada a rodada. Tudo
--    null fora do modo corrida; `score`/`perfects` já existentes cobrem
--    final_score/perfect, não duplicados aqui.
-- ---------------------------------------------------------------------
alter table public.match_history
  add column race_score_normal_total integer null,
  add column race_avg_response_ms integer null,
  add column race_avg_multiplier numeric(3,2) null,
  add column race_best_multiplier numeric(3,2) null;

-- ---------------------------------------------------------------------
-- 3. achievements ganha um escopo opcional por modo — quando setado,
--    check_and_grant_achievements() valida contra a linha de
--    player_mode_stats daquele modo em vez do player_stats global. As 7
--    conquistas do 0001 ficam com required_mode_id null (comportamento
--    idêntico a antes).
-- ---------------------------------------------------------------------
alter table public.achievements
  add column required_mode_id text null;

-- ---------------------------------------------------------------------
-- apply_match_result ganha parâmetros novos (todos default null) — como
-- isso muda a lista de tipos de parâmetro, não é um "replace" de verdade
-- da função de 13 parâmetros do 0001 (o Postgres trataria como uma
-- sobrecarga nova, deixando a antiga só ocupando espaço) — por isso o
-- drop explícito antes de recriar.
-- ---------------------------------------------------------------------
drop function if exists public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb);

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
  p_round_outcomes text[],
  p_theme_tallies jsonb,
  p_race_score_normal_total integer default null,
  p_race_response_ms_sum bigint default null,
  p_race_multiplier_sum numeric default null,
  p_race_timed_rounds integer default null,
  p_race_best_response_ms integer default null,
  p_race_best_correct_response_ms integer default null,
  p_race_best_multiplier numeric default null,
  p_race_multiplier_2x_count integer default null,
  p_race_no_timeout boolean default null
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
  v_race_avg_response_ms integer;
  v_race_avg_multiplier numeric;
begin
  select count(*) into v_correct from unnest(p_round_outcomes) o where o in ('correct','perfect');
  select count(*) into v_wrong   from unnest(p_round_outcomes) o where o = 'wrong';

  if p_race_timed_rounds is not null and p_race_timed_rounds > 0 then
    v_race_avg_response_ms := round(p_race_response_ms_sum::numeric / p_race_timed_rounds);
    v_race_avg_multiplier := round(p_race_multiplier_sum / p_race_timed_rounds, 2);
  end if;

  insert into public.match_history (
    user_id, match_id, room_code, mode_id, theme_ids, difficulty,
    score, correct_answers, wrong_answers, perfects, result, duration_seconds, played_at,
    race_score_normal_total, race_avg_response_ms, race_avg_multiplier, race_best_multiplier
  ) values (
    p_user_id, p_match_id, p_room_code, p_mode_id, p_theme_ids, p_difficulty,
    p_score, v_correct, v_wrong, p_perfects, p_result, p_duration_seconds, p_played_at,
    p_race_score_normal_total, v_race_avg_response_ms, v_race_avg_multiplier, p_race_best_multiplier
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

  -- Race columns: `least`/`greatest` ignore nulls and only return null when
  -- every input is null (Postgres built-in behavior), so a non-race
  -- mode_id row's race columns simply stay null forever without any extra
  -- branching here — only a 'race' mode_id row ever gets real values.
  insert into public.player_mode_stats (
    user_id, mode_id, games_played, wins, perfects, best_score, total_score,
    best_response_ms, best_correct_response_ms, best_multiplier, multiplier_2x_count,
    total_response_ms, timed_rounds_count, no_timeout_matches
  )
  values (
    p_user_id, p_mode_id, 1, case when p_result='won' then 1 else 0 end, p_perfects, p_score, p_score,
    p_race_best_response_ms, p_race_best_correct_response_ms, p_race_best_multiplier,
    coalesce(p_race_multiplier_2x_count, 0), coalesce(p_race_response_ms_sum, 0), coalesce(p_race_timed_rounds, 0),
    case when p_race_no_timeout then 1 else 0 end
  )
  on conflict (user_id, mode_id) do update set
    games_played = player_mode_stats.games_played + 1,
    wins = player_mode_stats.wins + (case when p_result='won' then 1 else 0 end),
    perfects = player_mode_stats.perfects + p_perfects,
    best_score = greatest(player_mode_stats.best_score, p_score),
    total_score = player_mode_stats.total_score + p_score,
    best_response_ms = least(player_mode_stats.best_response_ms, p_race_best_response_ms),
    best_correct_response_ms = least(player_mode_stats.best_correct_response_ms, p_race_best_correct_response_ms),
    best_multiplier = greatest(player_mode_stats.best_multiplier, p_race_best_multiplier),
    multiplier_2x_count = player_mode_stats.multiplier_2x_count + coalesce(p_race_multiplier_2x_count, 0),
    total_response_ms = player_mode_stats.total_response_ms + coalesce(p_race_response_ms_sum, 0),
    timed_rounds_count = player_mode_stats.timed_rounds_count + coalesce(p_race_timed_rounds, 0),
    no_timeout_matches = player_mode_stats.no_timeout_matches + (case when p_race_no_timeout then 1 else 0 end);

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

-- ---------------------------------------------------------------------
-- check_and_grant_achievements ganha p_mode_id — mesmo motivo do drop
-- acima (a assinatura muda de 1 pra 2 parâmetros).
-- ---------------------------------------------------------------------
drop function if exists public.check_and_grant_achievements(uuid);

create or replace function public.check_and_grant_achievements(p_user_id uuid, p_mode_id text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_stats record; v_mode_stats record; v_ach record; v_reward record;
begin
  select * into v_stats from public.player_stats where user_id = p_user_id;
  if not found then return; end if;

  -- Sempre executado (mesmo com p_mode_id null) pra v_mode_stats ficar
  -- "assigned" — evita erro de record não inicializado no loop abaixo;
  -- com p_mode_id null isso só retorna zero linhas, sem problema.
  select * into v_mode_stats from public.player_mode_stats where user_id = p_user_id and mode_id = p_mode_id;

  for v_ach in
    select a.* from public.achievements a
    where not exists (select 1 from public.player_achievements pa where pa.user_id = p_user_id and pa.achievement_id = a.id)
      and (a.required_mode_id is null or a.required_mode_id = p_mode_id)
  loop
    if (
      (v_ach.required_mode_id is null and (
        (v_ach.criteria_type = 'games_played'           and v_stats.games_played           >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'games_won'               and v_stats.games_won              >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'total_perfects'          and v_stats.total_perfects         >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'total_playtime_seconds'  and v_stats.total_playtime_seconds >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_answer_streak'      and v_stats.best_answer_streak     >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_perfect_streak'     and v_stats.best_perfect_streak    >= v_ach.criteria_value)
        -- 'campaign_complete' propositalmente sem branch — ver nota no seed do 0001.
      ))
      or
      (v_ach.required_mode_id is not null and v_mode_stats.user_id is not null and (
        (v_ach.criteria_type = 'mode_perfects' and v_mode_stats.perfects >= v_ach.criteria_value) or
        -- único critério "quanto menor melhor" — todos os outros são >=.
        (v_ach.criteria_type = 'fastest_correct_response_ms'
           and v_mode_stats.best_correct_response_ms is not null
           and v_mode_stats.best_correct_response_ms <= v_ach.criteria_value) or
        (v_ach.criteria_type = 'multiplier_2x_count' and v_mode_stats.multiplier_2x_count >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'no_timeout_matches'   and v_mode_stats.no_timeout_matches  >= v_ach.criteria_value)
      ))
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
-- Seed: as 4 conquistas do modo Corrida contra o Tempo + recompensas de
-- título (títulos já adicionados em shared/titleCatalog.ts).
-- ---------------------------------------------------------------------
insert into public.achievements (id, name, description, icon, criteria_type, criteria_value, sort_order, required_mode_id) values
  ('relampago',          'Relâmpago',          'Acerte uma cor em menos de 2 segundos na Corrida contra o Tempo.', '⚡',  'fastest_correct_response_ms', 2000, 80,  'race'),
  ('velocista',          'Velocista',          'Consiga multiplicador 2x em 10 respostas na Corrida contra o Tempo.', '🏎️', 'multiplier_2x_count', 10, 90, 'race'),
  ('sem-tempo-a-perder', 'Sem Tempo a Perder', 'Complete uma partida na Corrida contra o Tempo sem nenhum tempo esgotado.', '⏳', 'no_timeout_matches', 1, 100, 'race'),
  ('olho-rapido',        'Olho Rápido',        'Acerte 5 cores perfeitas na Corrida contra o Tempo.', '👁️', 'mode_perfects', 5, 110, 'race')
on conflict (id) do nothing;

insert into public.achievement_rewards (achievement_id, reward_type, reward_id) values
  ('relampago', 'title', 'relampago'),
  ('velocista', 'title', 'velocista'),
  ('sem-tempo-a-perder', 'title', 'sem-tempo-a-perder'),
  ('olho-rapido', 'title', 'olho-rapido')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Grants — mesma disciplina do 0001: EXECUTE revogado de anon/
-- authenticated, concedido só a service_role, pras duas funções que
-- acabaram de ser recriadas com assinatura nova.
-- ---------------------------------------------------------------------
revoke execute on function
  public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb, integer, bigint, numeric, integer, integer, integer, numeric, integer, boolean),
  public.check_and_grant_achievements(uuid, text)
from public, anon, authenticated;
grant execute on function
  public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb, integer, bigint, numeric, integer, integer, integer, numeric, integer, boolean),
  public.check_and_grant_achievements(uuid, text)
to service_role;
