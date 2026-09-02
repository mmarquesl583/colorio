-- =========================================================================
-- color.io — substitui os 4 títulos de nível provisórios (0007) por 10
-- marcos reais, a cada 5 níveis de 5 a 50 (shared/titleCatalog.ts). Rode
-- este arquivo depois de 0001 a 0008 já terem rodado.
-- =========================================================================

-- Remove os 4 antigos — ninguém ainda tinha alcançado nível 5 pra ter
-- ganhado algum deles, então é seguro apagar (cascade limpa
-- achievement_rewards e qualquer player_achievements que exista).
delete from public.achievements where id in ('nivel-5', 'nivel-10', 'nivel-20', 'nivel-35');

insert into public.achievements (id, name, description, icon, criteria_type, criteria_value, sort_order) values
  ('nivel-5',  'Pupilo',            'Alcance o nível 5.',  '🔰', 'player_level', 5,  900),
  ('nivel-10', 'Gafanhoto',         'Alcance o nível 10.', '🦗', 'player_level', 10, 901),
  ('nivel-15', 'Soldado',           'Alcance o nível 15.', '🪖', 'player_level', 15, 902),
  ('nivel-20', 'Guerreiro',         'Alcance o nível 20.', '⚔️', 'player_level', 20, 903),
  ('nivel-25', 'Viking',            'Alcance o nível 25.', '🪓', 'player_level', 25, 904),
  ('nivel-30', 'Samurai',           'Alcance o nível 30.', '🎌', 'player_level', 30, 905),
  ('nivel-35', 'Sensei',            'Alcance o nível 35.', '🥋', 'player_level', 35, 906),
  ('nivel-40', 'Máquina de Guerra', 'Alcance o nível 40.', '🤖', 'player_level', 40, 907),
  ('nivel-45', 'Lenda',             'Alcance o nível 45.', '🌟', 'player_level', 45, 908),
  ('nivel-50', 'Mestre Supremo',    'Alcance o nível 50.', '👑', 'player_level', 50, 909)
on conflict (id) do nothing;

insert into public.achievement_rewards (achievement_id, reward_type, reward_id) values
  ('nivel-5', 'title', 'pupilo'),
  ('nivel-10', 'title', 'gafanhoto'),
  ('nivel-15', 'title', 'soldado'),
  ('nivel-20', 'title', 'guerreiro'),
  ('nivel-25', 'title', 'viking'),
  ('nivel-30', 'title', 'samurai'),
  ('nivel-35', 'title', 'sensei'),
  ('nivel-40', 'title', 'maquina-de-guerra'),
  ('nivel-45', 'title', 'lenda'),
  ('nivel-50', 'title', 'mestre-supremo')
on conflict do nothing;
