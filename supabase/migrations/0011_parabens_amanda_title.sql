-- =========================================================================
-- color.io — 0011: libera o título "Parabéns, Amanda!" (evento de 1 dia)
--
-- equip_title só deixa equipar um título sem dono em player_titles se o id
-- for literalmente 'novato' (caso especial já existente) — marcar o título
-- como free: true em shared/titleCatalog.ts não basta sozinho, a chamada
-- real ia falhar em silêncio. Aqui a mesma exceção passa a valer também
-- pra 'parabens-amanda', só que com data de validade: a partir de
-- 2026-09-04 (UTC) a função volta a exigir o dono normal, então mesmo
-- chamando a RPC direto (fora da grade do seletor, que já esconde o
-- título depois de hoje) ninguém mais consegue equipar depois do dia.
-- Mesma assinatura de sempre — create or replace basta.
-- =========================================================================

create or replace function public.equip_title(p_title_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_uid is null then return; end if;
  if p_title_id is not null
     and not (
       p_title_id = 'novato'
       or (p_title_id = 'parabens-amanda' and v_today <= date '2026-09-03')
     )
     and not exists (select 1 from public.player_titles where user_id = v_uid and title_id = p_title_id)
  then
    return;
  end if;
  insert into public.profiles (user_id, title_id) values (v_uid, p_title_id)
    on conflict (user_id) do update set title_id = excluded.title_id;
end;
$$;
