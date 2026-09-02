-- =========================================================================
-- color.io — sistema de amigos + títulos de amizade + "tem novidade pra
-- conferir". Cole este arquivo inteiro no SQL Editor do Supabase e rode
-- uma vez, DEPOIS de já ter rodado 0001, 0002 e 0003.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. profiles ganha um código de amigo (curto, único, gerado sozinho —
--    igual ao código de sala que o jogo já usa, mesma ideia de "convite
--    sem fricção") e um timestamp de "última vez que conferiu novidades",
--    usado pra saber se tem título/ícone novo pra mostrar.
-- ---------------------------------------------------------------------
create or replace function public.gen_friend_code()
returns text
language sql
as $$
  select upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$;

alter table public.profiles add column friend_code text unique default public.gen_friend_code();
alter table public.profiles add column last_checked_unlocks_at timestamptz not null default now();

-- Backfill pra quem já tinha profile antes desta coluna existir (o
-- DEFAULT acima só vale pra linhas novas a partir de agora).
update public.profiles set friend_code = public.gen_friend_code() where friend_code is null;

-- ---------------------------------------------------------------------
-- 2. friendships — uma linha por direção (A→B e B→A) pra cada amizade,
--    assim "meus amigos" é sempre só `where user_id = auth.uid()`, sem
--    precisar de OR nem de saber quem adicionou quem primeiro. Mesmo
--    padrão "sem policy de escrita pra authenticated" do resto do schema
--    — toda escrita passa pelas funções SECURITY DEFINER abaixo.
-- ---------------------------------------------------------------------
create table public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friendships_friend_idx on public.friendships (friend_id);

alter table public.friendships enable row level security;
create policy "own friendships read" on public.friendships for select using (auth.uid() = user_id);
revoke insert, update, delete on public.friendships from authenticated, anon;

-- ---------------------------------------------------------------------
-- 3. add_friend / remove_friend — chamadas pelo próprio jogador (usa
--    auth.uid() internamente, igual equip_title), não pelo servidor.
--    Adicionar é imediato e nas duas direções — sem pedido/aceite, mesma
--    filosofia "quem tem o código entra" das salas privadas do jogo.
-- ---------------------------------------------------------------------
create or replace function public.add_friend(p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
begin
  if v_uid is null then return 'not_authenticated'; end if;

  select user_id into v_target from public.profiles where friend_code = upper(trim(p_code));
  if v_target is null then return 'not_found'; end if;
  if v_target = v_uid then return 'self'; end if;
  if exists (select 1 from public.friendships where user_id = v_uid and friend_id = v_target) then
    return 'already_friends';
  end if;

  insert into public.friendships (user_id, friend_id) values (v_uid, v_target), (v_target, v_uid);

  -- Explicit 2-arg call, not the bare 1-arg form — see the note by
  -- check_and_grant_achievements below about why a 1-arg call is
  -- genuinely ambiguous here, not just stylistically worse.
  perform public.check_and_grant_achievements(v_uid, null);
  perform public.check_and_grant_achievements(v_target, null);

  return 'ok';
end;
$$;
grant execute on function public.add_friend(text) to authenticated;

create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  delete from public.friendships
    where (user_id = v_uid and friend_id = p_friend_id)
       or (user_id = p_friend_id and friend_id = v_uid);
end;
$$;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. get_friends_stats — nome/ícone/título vivem em auth.users (display_
--    name/avatar_icon) e profiles (title_id), não em nenhuma tabela que o
--    RLS deixe o jogador ler de outra pessoa — só uma função SECURITY
--    DEFINER (que enxerga auth.users inteiro, como o handle_auth_user_
--    sync do 0001) consegue montar essa lista com dados de terceiros.
-- ---------------------------------------------------------------------
create or replace function public.get_friends_stats()
returns table (
  friend_id uuid,
  name text,
  avatar_id text,
  title_id text,
  games_played integer,
  games_won integer,
  best_score integer,
  total_perfects integer
)
language plpgsql security definer set search_path = public
as $$
begin
  return query
    select
      f.friend_id,
      coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), split_part(u.email, '@', 1)) as name,
      u.raw_user_meta_data->>'avatar_icon' as avatar_id,
      p.title_id,
      coalesce(ps.games_played, 0),
      coalesce(ps.games_won, 0),
      coalesce(ps.best_score, 0),
      coalesce(ps.total_perfects, 0)
    from public.friendships f
    join auth.users u on u.id = f.friend_id
    left join public.profiles p on p.user_id = f.friend_id
    left join public.player_stats ps on ps.user_id = f.friend_id
    where f.user_id = auth.uid()
    order by u.raw_user_meta_data->>'display_name';
end;
$$;
grant execute on function public.get_friends_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 5. mark_unlocks_seen — profiles não tem policy de update pra
--    authenticated (mesma razão do equip_title), então essa é a única
--    forma do jogador "confirmar que já viu" os desbloqueios novos.
-- ---------------------------------------------------------------------
create or replace function public.mark_unlocks_seen()
returns void
language sql security definer set search_path = public
as $$
  update public.profiles set last_checked_unlocks_at = now() where user_id = auth.uid();
$$;
grant execute on function public.mark_unlocks_seen() to authenticated;

-- ---------------------------------------------------------------------
-- 6. check_and_grant_achievements ganha o critério friends_count.
--
--    O 0003 mudou a assinatura de (uuid) pra (uuid, text default null) —
--    só que `create or replace function` casa por nome + TIPOS dos
--    parâmetros, ignorando defaults. Como as duas listas de tipos são
--    diferentes ((uuid) vs (uuid, text)), o 0003 nunca substituiu a
--    versão do 0001: criou uma SEGUNDA função em sobrecarga, e as duas
--    convivem no banco desde então. O servidor nunca notou porque sempre
--    chama com os dois parâmetros nomeados — mas uma chamada futura com
--    só 1 argumento posicional bateria na versão velha do 0001 (mais
--    específica pra esse número de argumentos), que não sabe nada sobre
--    friends_count nem qualquer critério adicionado depois dela. O drop
--    abaixo elimina essa ambiguidade de vez.
-- ---------------------------------------------------------------------
drop function if exists public.check_and_grant_achievements(uuid);

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
-- 7. Seed: os 3 títulos de amizade.
-- ---------------------------------------------------------------------
insert into public.achievements (id, name, description, icon, criteria_type, criteria_value, sort_order, required_mode_id) values
  ('um-bom-amigo',          'Um Bom Amigo',            'Adicione 1 amigo.', '🤝', 'friends_count', 1, 500, null),
  ('amigao-da-vizinhanca',  'Amigão da Vizinhança',    'Adicione 3 amigos.', '🏘️', 'friends_count', 3, 510, null),
  ('popularidade-maxima',   'Popularidade Máxima',     'Adicione 5 amigos.', '🎉', 'friends_count', 5, 520, null)
on conflict (id) do nothing;

insert into public.achievement_rewards (achievement_id, reward_type, reward_id) values
  ('um-bom-amigo', 'title', 'um-bom-amigo'),
  ('amigao-da-vizinhanca', 'title', 'amigao-da-vizinhanca'),
  ('popularidade-maxima', 'title', 'popularidade-maxima')
on conflict do nothing;
