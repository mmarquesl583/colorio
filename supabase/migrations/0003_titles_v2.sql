-- =========================================================================
-- color.io — novo catálogo de 25 títulos (shared/titleCatalog.ts). Cole
-- este arquivo inteiro no SQL Editor do Supabase e rode uma vez, DEPOIS de
-- já ter rodado 0001 e 0002. Não edita nada deles em produção — só
-- adiciona colunas/funções por cima.
--
-- Escopo: a maioria dos 25 títulos reaproveita estatísticas GLOBAIS já
-- existentes (games_played, games_won, total_perfects, best_answer_streak,
-- best_perfect_streak, total_playtime_seconds) — só ganham uma linha nova
-- em `achievements`. O resto precisa de colunas novas em player_stats,
-- todas alimentadas a partir de dois arrays por-rodada novos que o
-- servidor agora manda pra TODO modo (não só corrida):
-- p_round_scores (baseScore 0-1000 de cada rodada) e p_round_response_ms
-- (tempo de resposta em ms, null = nunca confirmou/estourou o tempo).
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas novas em player_stats (globais, todo modo).
-- ---------------------------------------------------------------------
alter table public.player_stats
  add column zero_score_guesses integer not null default 0,
  add column best_precision98_in_match integer not null default 0,
  add column current_exact990_streak integer not null default 0,
  add column best_exact990_streak integer not null default 0,
  add column fastest_correct_response_ms integer null,
  add column fastest_perfect_response_ms integer null,
  add column sub2s_correct_count integer not null default 0,
  add column personal_best_breaks integer not null default 0,
  add column hit_666_count integer not null default 0,
  add column hit_666_won_count integer not null default 0,
  add column hit_666_with_perfect_count integer not null default 0,
  add column hit_777_count integer not null default 0,
  add column hit_777_with_perfect_count integer not null default 0;

-- ---------------------------------------------------------------------
-- apply_match_result ganha p_round_scores/p_round_response_ms — muda a
-- lista de tipos de parâmetro, então precisa de drop+recreate (mesma
-- razão documentada no 0002) em vez de um create or replace direto.
-- ---------------------------------------------------------------------
drop function if exists public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb, integer, bigint, numeric, integer, integer, integer, numeric, integer, boolean);

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
  p_race_no_timeout boolean default null,
  p_round_scores integer[] default null,
  p_round_response_ms integer[] default null
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
  v_old_best_score integer;
  v_broke_record boolean := false;
  v_current_990_streak integer; v_best_990_streak integer;
  v_fastest_correct_ms integer; v_fastest_perfect_ms integer;
  v_round_score integer; v_response_ms integer;
  v_zero_count integer := 0;
  v_high_precision_in_match integer := 0;
  v_sub2s_correct_count integer := 0;
  v_i integer; v_n integer;
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
         last_play_date, current_day_streak, best_day_streak,
         best_score, current_exact990_streak, best_exact990_streak,
         fastest_correct_response_ms, fastest_perfect_response_ms
    into v_answer_streak, v_perfect_streak, v_best_answer_streak, v_best_perfect_streak,
         v_last_play_date, v_current_day_streak, v_best_day_streak,
         v_old_best_score, v_current_990_streak, v_best_990_streak,
         v_fastest_correct_ms, v_fastest_perfect_ms
    from public.player_stats where user_id = p_user_id for update;

  v_broke_record := p_score > v_old_best_score;

  -- Single index-based pass over every round the player guessed in this
  -- match — extends the existing answer/perfect streak walk (unchanged
  -- logic) to also derive the newer per-round-history-based stats from
  -- p_round_scores/p_round_response_ms in the same loop, instead of a
  -- second pass or a separate TS-side accumulator per title.
  v_n := coalesce(array_length(p_round_outcomes, 1), 0);
  for v_i in 1..v_n loop
    v_outcome := p_round_outcomes[v_i];
    v_round_score := case when p_round_scores is not null then p_round_scores[v_i] else null end;
    v_response_ms := case when p_round_response_ms is not null then p_round_response_ms[v_i] else null end;

    if v_outcome in ('correct','perfect') then v_answer_streak := v_answer_streak + 1; else v_answer_streak := 0; end if;
    v_best_answer_streak := greatest(v_best_answer_streak, v_answer_streak);
    if v_outcome = 'perfect' then v_perfect_streak := v_perfect_streak + 1; else v_perfect_streak := 0; end if;
    v_best_perfect_streak := greatest(v_best_perfect_streak, v_perfect_streak);

    if v_round_score is not null then
      if v_round_score = 0 then v_zero_count := v_zero_count + 1; end if;
      if v_round_score >= 980 then v_high_precision_in_match := v_high_precision_in_match + 1; end if;
      if v_round_score = 990 then v_current_990_streak := v_current_990_streak + 1; else v_current_990_streak := 0; end if;
      v_best_990_streak := greatest(v_best_990_streak, v_current_990_streak);
    end if;

    if v_response_ms is not null and v_outcome in ('correct','perfect') then
      v_fastest_correct_ms := least(v_fastest_correct_ms, v_response_ms);
      if v_response_ms < 2000 then v_sub2s_correct_count := v_sub2s_correct_count + 1; end if;
    end if;
    if v_response_ms is not null and v_outcome = 'perfect' then
      v_fastest_perfect_ms := least(v_fastest_perfect_ms, v_response_ms);
    end if;
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
    last_play_date = v_today,
    zero_score_guesses = zero_score_guesses + v_zero_count,
    best_precision98_in_match = greatest(best_precision98_in_match, v_high_precision_in_match),
    current_exact990_streak = v_current_990_streak, best_exact990_streak = v_best_990_streak,
    fastest_correct_response_ms = v_fastest_correct_ms,
    fastest_perfect_response_ms = v_fastest_perfect_ms,
    sub2s_correct_count = sub2s_correct_count + v_sub2s_correct_count,
    personal_best_breaks = personal_best_breaks + (case when v_broke_record then 1 else 0 end),
    hit_666_count = hit_666_count + (case when p_score = 666 then 1 else 0 end),
    hit_666_won_count = hit_666_won_count + (case when p_score = 666 and p_result = 'won' then 1 else 0 end),
    hit_666_with_perfect_count = hit_666_with_perfect_count + (case when p_score = 666 and p_perfects > 0 then 1 else 0 end),
    hit_777_count = hit_777_count + (case when p_score = 777 then 1 else 0 end),
    hit_777_with_perfect_count = hit_777_with_perfect_count + (case when p_score = 777 and p_perfects > 0 then 1 else 0 end)
  where user_id = p_user_id;

  insert into public.player_play_days (user_id, play_date) values (p_user_id, v_today)
    on conflict (user_id, play_date) do nothing;

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
-- check_and_grant_achievements — mesma assinatura do 0002 (uuid, text),
-- create or replace direto preserva OID/grants, sem precisar de drop.
-- Só o corpo do bloco GLOBAL (required_mode_id is null) ganha os novos
-- criteria_type; o bloco por-modo fica idêntico ao 0002.
-- ---------------------------------------------------------------------
create or replace function public.check_and_grant_achievements(p_user_id uuid, p_mode_id text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_stats record; v_mode_stats record; v_ach record; v_reward record;
begin
  select * into v_stats from public.player_stats where user_id = p_user_id;
  if not found then return; end if;

  select * into v_mode_stats from public.player_mode_stats where user_id = p_user_id and mode_id = p_mode_id;

  for v_ach in
    select a.* from public.achievements a
    where not exists (select 1 from public.player_achievements pa where pa.user_id = p_user_id and pa.achievement_id = a.id)
      and (a.required_mode_id is null or a.required_mode_id = p_mode_id)
  loop
    if (
      (v_ach.required_mode_id is null and (
        (v_ach.criteria_type = 'games_played'               and v_stats.games_played               >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'games_won'                   and v_stats.games_won                  >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'total_perfects'              and v_stats.total_perfects             >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'total_playtime_seconds'      and v_stats.total_playtime_seconds     >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_answer_streak'          and v_stats.best_answer_streak         >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_perfect_streak'         and v_stats.best_perfect_streak        >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_score'                  and v_stats.best_score                 >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'zero_score_guesses'          and v_stats.zero_score_guesses         >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_precision98_in_match'   and v_stats.best_precision98_in_match  >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_exact990_streak'        and v_stats.best_exact990_streak       >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'sub2s_correct_count'         and v_stats.sub2s_correct_count        >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'personal_best_breaks'        and v_stats.personal_best_breaks       >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'hit_666_count'                and v_stats.hit_666_count              >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'hit_666_won_count'            and v_stats.hit_666_won_count          >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'hit_666_with_perfect_count'   and v_stats.hit_666_with_perfect_count >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'hit_777_count'                and v_stats.hit_777_count              >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'hit_777_with_perfect_count'   and v_stats.hit_777_with_perfect_count >= v_ach.criteria_value) or
        -- único critério "quanto menor melhor" no bloco global — os outros são >=.
        (v_ach.criteria_type = 'fastest_correct_response_ms' and v_stats.fastest_correct_response_ms is not null
           and v_stats.fastest_correct_response_ms <= v_ach.criteria_value) or
        (v_ach.criteria_type = 'fastest_perfect_response_ms' and v_stats.fastest_perfect_response_ms is not null
           and v_stats.fastest_perfect_response_ms <= v_ach.criteria_value)
        -- 'campaign_complete' propositalmente sem branch — ver nota no seed do 0001.
      ))
      or
      (v_ach.required_mode_id is not null and v_mode_stats.user_id is not null and (
        (v_ach.criteria_type = 'mode_perfects' and v_mode_stats.perfects >= v_ach.criteria_value) or
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
      end loop;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Repurpose 'relampago' (era corrida-only, <2s) e 'velocista' (nome
-- exibido) pro novo catálogo, sem trocar o id — evita mexer em
-- achievement_rewards, que já aponta pro id certo.
-- ---------------------------------------------------------------------
update public.achievements set
  required_mode_id = null,
  criteria_value = 1000,
  description = 'Acerte uma cor em menos de 1 segundo.'
where id = 'relampago';

update public.achievements set
  name = 'Tempo é Dinheiro',
  description = 'Consiga 10 multiplicadores de 2x na Corrida contra o Tempo.'
where id = 'velocista';

-- ---------------------------------------------------------------------
-- Seed: as 22 conquistas novas restantes do catálogo de 25 (relampago e
-- velocista já tratados acima; imparavel já existe idêntico desde o 0001).
-- ---------------------------------------------------------------------
insert into public.achievements (id, name, description, icon, criteria_type, criteria_value, sort_order, required_mode_id) values
  ('daltonico',              'Daltônico',              'Tire 0 pontos em 10 palpites.',                                        '🙈', 'zero_score_guesses',          10,    200, null),
  ('michelangelo',           'Michelangelo',           'Consiga 10 palpites perfeitos.',                                       '🎨', 'total_perfects',              10,    210, null),
  ('olho-de-aguia',          'Olho de Águia',          'Consiga 5 palpites com pelo menos 98% de precisão em uma única partida.', '🦅', 'best_precision98_in_match', 5,     220, null),
  ('mao-de-deus',            'Mão de Deus',            'Consiga 5 perfeitos consecutivos.',                                    '✋', 'best_perfect_streak',        5,     230, null),
  ('cirurgico',              'Cirúrgico',              'Consiga 3 palpites consecutivos com exatamente 99% de precisão.',     '🔪', 'best_exact990_streak',       3,     240, null),
  ('flash',                  'Flash',                  'Consiga 10 acertos em menos de 2 segundos.',                           '⚡', 'sub2s_correct_count',        10,    250, null),
  ('sem-pensar',             'Sem Pensar',             'Consiga um palpite perfeito em menos de 1 segundo.',                   '🧠', 'fastest_perfect_response_ms', 1000, 260, null),
  ('embalado',               'Embalado',               'Acerte 10 palpites consecutivos.',                                     '🔥', 'best_answer_streak',         10,    270, null),
  ('perfeicao-ininterrupta', 'Perfeição Ininterrupta', 'Consiga 10 palpites perfeitos consecutivos.',                          '💎', 'best_perfect_streak',        10,    280, null),
  ('rei-dos-pontos',         'Rei dos Pontos',         'Termine 10 partidas em primeiro lugar.',                               '👑', 'games_won',                  10,    290, null),
  ('recordista',             'Recordista',             'Quebre seu próprio recorde de pontuação 5 vezes.',                     '📈', 'personal_best_breaks',       5,     300, null),
  ('monstro-dos-pontos',     'Monstro dos Pontos',     'Faça 10.000 pontos em uma única partida.',                             '👹', 'best_score',                 10000, 310, null),
  ('666',                    '666',                    'Alcance exatamente 666 pontos em uma partida.',                        '😈', 'hit_666_count',              1,     320, null),
  ('pega-infernal',          'Pega Infernal',          'Alcance exatamente 666 pontos 3 vezes.',                               '🔱', 'hit_666_count',              3,     330, null),
  ('diabolico',              'Diabólico',              'Alcance exatamente 666 pontos e termine a partida em primeiro lugar.', '👺', 'hit_666_won_count',          1,     340, null),
  ('bafomeeeeeeee',          'Bafomeeeeeeee',          'Alcance exatamente 666 pontos após conseguir um palpite perfeito.',   '🐐', 'hit_666_with_perfect_count', 1,     350, null),
  ('777',                    '777',                    'Alcance exatamente 777 pontos em uma partida.',                        '🍀', 'hit_777_count',              1,     360, null),
  ('santinho',               'Santinho',               'Alcance exatamente 777 pontos 3 vezes.',                               '😇', 'hit_777_count',              3,     370, null),
  ('abencoado',              'Abençoado',              'Alcance exatamente 777 pontos e consiga um perfeito na mesma partida.', '🙏', 'hit_777_with_perfect_count', 1,   380, null),
  ('divindade',              'Divindade',              'Alcance exatamente 777 pontos 5 vezes.',                               '✨', 'hit_777_count',              5,     390, null),
  ('veterano-das-cores',     'Veterano das Cores',     'Jogue 100 partidas.',                                                  '🎖️', 'games_played',               100,   400, null),
  ('morador-do-colorio',     'Morador do Colorio',     'Passe 10 horas dentro do jogo.',                                       '🏠', 'total_playtime_seconds',     36000, 410, null)
on conflict (id) do nothing;

insert into public.achievement_rewards (achievement_id, reward_type, reward_id) values
  ('daltonico', 'title', 'daltonico'),
  ('michelangelo', 'title', 'michelangelo'),
  ('olho-de-aguia', 'title', 'olho-de-aguia'),
  ('mao-de-deus', 'title', 'mao-de-deus'),
  ('cirurgico', 'title', 'cirurgico'),
  ('flash', 'title', 'flash'),
  ('sem-pensar', 'title', 'sem-pensar'),
  ('embalado', 'title', 'embalado'),
  ('perfeicao-ininterrupta', 'title', 'perfeicao-ininterrupta'),
  ('rei-dos-pontos', 'title', 'rei-dos-pontos'),
  ('recordista', 'title', 'recordista'),
  ('monstro-dos-pontos', 'title', 'monstro-dos-pontos'),
  ('666', 'title', '666'),
  ('pega-infernal', 'title', 'pega-infernal'),
  ('diabolico', 'title', 'diabolico'),
  ('bafomeeeeeeee', 'title', 'bafomeeeeeeee'),
  ('777', 'title', '777'),
  ('santinho', 'title', 'santinho'),
  ('abencoado', 'title', 'abencoado'),
  ('divindade', 'title', 'divindade'),
  ('veterano-das-cores', 'title', 'veterano-das-cores'),
  ('morador-do-colorio', 'title', 'morador-do-colorio')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Grants — apply_match_result precisa de novo revoke/grant (assinatura
-- mudou, o drop acima já invalidou os grants antigos daquela função).
-- check_and_grant_achievements não muda de assinatura neste arquivo, já
-- mantém os grants do 0002 automaticamente.
-- ---------------------------------------------------------------------
revoke execute on function
  public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb, integer, bigint, numeric, integer, integer, integer, numeric, integer, boolean, integer[], integer[])
from public, anon, authenticated;
grant execute on function
  public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb, integer, bigint, numeric, integer, integer, integer, numeric, integer, boolean, integer[], integer[])
to service_role;
