-- =========================================================================
-- color.io — 3 novos títulos de tempo de jogo + detalhe de partida
-- self-service pro jogador (histórico clicável na tela de Perfil). Cole
-- este arquivo inteiro no SQL Editor do Supabase e rode uma vez, DEPOIS de
-- já ter rodado 0001 a 0005.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Títulos de tempo de jogo (shared/titleCatalog.ts, categoria
--    "experiencia") — mesma coluna já usada por 'morador-do-colorio'
--    (total_playtime_seconds), check_and_grant_achievements já sabe
--    avaliar esse criteria_type, não precisa de lógica nova.
-- ---------------------------------------------------------------------
insert into public.achievements (id, name, description, icon, criteria_type, criteria_value, sort_order) values
  ('playtime_1h',  'Desocupado',      'Jogue por 1 hora no total.',   '🛋️', 'total_playtime_seconds', 3600,  80),
  ('playtime_6h',  'Vagabundo',       'Jogue por 6 horas no total.',  '🦥', 'total_playtime_seconds', 21600, 81),
  ('playtime_12h', 'Acorda pra Vida', 'Jogue por 12 horas no total.', '⏰', 'total_playtime_seconds', 43200, 82)
on conflict (id) do nothing;

insert into public.achievement_rewards (achievement_id, reward_type, reward_id) values
  ('playtime_1h',  'title', 'desocupado'),
  ('playtime_6h',  'title', 'vagabundo'),
  ('playtime_12h', 'title', 'acorda-pra-vida')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. get_match_participants — a tela de Perfil já lista o próprio
--    histórico de partidas (match_history, RLS "own row only"), mas pra
--    mostrar QUEM MAIS jogou e o placar de cada um (clique numa partida
--    do histórico) precisa enxergar as linhas dos outros participantes
--    daquela mesma match_id. RLS não deixa isso direto — mesma solução já
--    usada por get_friends_stats(): SECURITY DEFINER, só que aqui o
--    "quem pode ver" é verificado explicitamente (só quem tem uma linha
--    própria naquela match_id), não confiado ao RLS de auth.uid() da
--    tabela base.
-- ---------------------------------------------------------------------
create or replace function public.get_match_participants(p_match_id uuid)
returns table (
  user_id uuid,
  name text,
  avatar_id text,
  mode_id text,
  theme_ids text[],
  score integer,
  perfects integer,
  result text,
  duration_seconds integer,
  played_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.match_history mh
    where mh.match_id = p_match_id and mh.user_id = auth.uid()
  ) then
    return;
  end if;

  return query
    select
      mh.user_id,
      coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), split_part(u.email, '@', 1), 'Jogador') as name,
      u.raw_user_meta_data->>'avatar_icon' as avatar_id,
      mh.mode_id, mh.theme_ids, mh.score, mh.perfects, mh.result, mh.duration_seconds, mh.played_at
    from public.match_history mh
    join auth.users u on u.id = mh.user_id
    where mh.match_id = p_match_id
    order by mh.score desc;
end;
$$;
grant execute on function public.get_match_participants(uuid) to authenticated;
revoke execute on function public.get_match_participants(uuid) from anon;
