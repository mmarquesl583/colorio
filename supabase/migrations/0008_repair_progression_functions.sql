-- =========================================================================
-- color.io — REPARO: 0007_progression.sql rodou antes de 0002/0003/0004
-- (as migrações foram aplicadas fora de ordem nesse banco). O corpo de
-- apply_match_result/check_and_grant_achievements que o 0007 criou faz
-- referência a colunas de player_stats que só existem a partir do 0003
-- (hit_666_count, best_exact990_streak, fastest_correct_response_ms, etc.)
-- — como essas colunas não existiam, toda gravação de estatística de
-- partida vinha falhando silenciosamente desde então.
--
-- Rode este arquivo DEPOIS de já ter rodado 0002, 0003 e 0004 (nessa
-- ordem). Ele só recria as duas funções — não mexe em nenhuma coluna nem
-- tabela, então é seguro mesmo já tendo rodado 0007 uma vez.
-- =========================================================================

drop function if exists public.apply_match_result(uuid, uuid, text, text, text[], text, integer, integer, text, integer, timestamptz, text[], jsonb, integer, bigint, numeric, integer, integer, integer, numeric, integer, boolean, integer[], integer[]);

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
  p_round_response_ms integer[] default null,
  p_match_xp integer default null,
  p_match_best_combo integer default null
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
  v_old_xp bigint;
  v_new_xp bigint;
  v_new_level integer;
  v_precision_sum bigint := 0;
  v_response_sum bigint := 0;
  v_response_count integer := 0;
  v_avg_precision integer;
  v_avg_response_ms integer;
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
         fastest_correct_response_ms, fastest_perfect_response_ms, xp
    into v_answer_streak, v_perfect_streak, v_best_answer_streak, v_best_perfect_streak,
         v_last_play_date, v_current_day_streak, v_best_day_streak,
         v_old_best_score, v_current_990_streak, v_best_990_streak,
         v_fastest_correct_ms, v_fastest_perfect_ms, v_old_xp
    from public.player_stats where user_id = p_user_id for update;

  v_broke_record := p_score > v_old_best_score;

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
      v_precision_sum := v_precision_sum + v_round_score;
    end if;

    if v_response_ms is not null and v_outcome in ('correct','perfect') then
      v_fastest_correct_ms := least(v_fastest_correct_ms, v_response_ms);
      if v_response_ms < 2000 then v_sub2s_correct_count := v_sub2s_correct_count + 1; end if;
    end if;
    if v_response_ms is not null and v_outcome = 'perfect' then
      v_fastest_perfect_ms := least(v_fastest_perfect_ms, v_response_ms);
    end if;
    if v_response_ms is not null then
      v_response_sum := v_response_sum + v_response_ms;
      v_response_count := v_response_count + 1;
    end if;
  end loop;

  if v_last_play_date is null then v_current_day_streak := 1;
  elsif v_today = v_last_play_date then null;
  elsif v_today = v_last_play_date + 1 then v_current_day_streak := v_current_day_streak + 1;
  else v_current_day_streak := 1;
  end if;
  v_best_day_streak := greatest(v_best_day_streak, v_current_day_streak);

  v_avg_precision := case when v_n > 0 then round(v_precision_sum::numeric / v_n) else 0 end;
  v_avg_response_ms := case when v_response_count > 0 then round(v_response_sum::numeric / v_response_count) else null end;
  v_new_xp := v_old_xp + coalesce(p_match_xp, 0);
  v_new_level := 1;
  while v_new_xp >= 100 * v_new_level * v_new_level loop
    v_new_level := v_new_level + 1;
  end loop;

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
    hit_777_with_perfect_count = hit_777_with_perfect_count + (case when p_score = 777 and p_perfects > 0 then 1 else 0 end),
    xp = v_new_xp,
    level = v_new_level,
    best_combo = greatest(best_combo, coalesce(p_match_best_combo, 0)),
    best_avg_precision = greatest(best_avg_precision, v_avg_precision),
    best_avg_response_ms = least(best_avg_response_ms, v_avg_response_ms)
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

create or replace function public.check_and_grant_achievements(p_user_id uuid, p_mode_id text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_stats record; v_mode_stats record; v_ach record; v_reward record; v_friends_count integer;
begin
  insert into public.player_stats (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_stats from public.player_stats where user_id = p_user_id;

  select count(*) into v_friends_count from public.friendships where user_id = p_user_id;

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
        (v_ach.criteria_type = 'friends_count'                and v_friends_count                    >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'player_level'                and v_stats.level                      >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_combo'                  and v_stats.best_combo                 >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'best_day_streak'             and v_stats.best_day_streak            >= v_ach.criteria_value) or
        (v_ach.criteria_type = 'fastest_correct_response_ms' and v_stats.fastest_correct_response_ms is not null
           and v_stats.fastest_correct_response_ms <= v_ach.criteria_value) or
        (v_ach.criteria_type = 'fastest_perfect_response_ms' and v_stats.fastest_perfect_response_ms is not null
           and v_stats.fastest_perfect_response_ms <= v_ach.criteria_value)
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
