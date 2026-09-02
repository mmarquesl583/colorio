-- =========================================================================
-- color.io — painel administrativo: sinalizador de admin, palpites por
-- rodada (base real pra análise de precisão de cor), ativar/desativar
-- pergunta, e persistência real das denúncias de pergunta. Cole este
-- arquivo inteiro no SQL Editor do Supabase e rode uma vez, DEPOIS de já
-- ter rodado 0001, 0002, 0003 e 0004.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. profiles ganha o sinalizador de admin. RLS de leitura já existe
--    ("own profile read"), então o próprio jogador já pode ler seu
--    is_admin — ler o próprio `false` não vaza nada, e nenhuma ação
--    sensível confia nesse valor sem reconferir no servidor.
-- ---------------------------------------------------------------------
alter table public.profiles add column is_admin boolean not null default false;

-- Primeiro admin — mesmo padrão usado antes pro ícone exclusivo do Morfeu.
update public.profiles set is_admin = true
where user_id = (select id from auth.users where email = 'matheus05linhares@hotmail.com');

-- ---------------------------------------------------------------------
-- 1b. achievements ganha ativar/desativar (afeta Títulos e Conquistas no
--     admin, já que título é sempre uma recompensa de uma conquista).
--     Leitura já é pública pra authenticated (policy do 0001); escrita só
--     pelo servidor.
-- ---------------------------------------------------------------------
alter table public.achievements add column active boolean not null default true;

-- ---------------------------------------------------------------------
-- 2. round_guesses — um palpite = uma linha. Sem isso não existe em
--    lugar nenhum "distância real entre o palpite e a cor certa" por
--    pergunta; só o resumo agregado da partida inteira é gravado hoje
--    (match_history). Gravado pelo servidor (service-role) logo depois
--    que computeReveal() já calculou baseScore/deltaE/badge — não é uma
--    métrica nova, é a persistência do que o jogo já calcula.
-- ---------------------------------------------------------------------
create table public.round_guesses (
  id bigint generated always as identity primary key,
  match_id uuid not null,
  room_code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode_id text not null,
  theme_id text not null,
  question_id integer null,   -- null no modo "Frase dos jogadores" (sem catálogo fixo)
  phrase text not null,
  secret_hex text not null,
  guess_hex text not null,
  delta_e numeric not null,
  score integer not null,     -- baseScore: pontuação de precisão pura, -100..1000 (shared/scoring.ts)
  badge text not null,        -- mesma faixa de badgeFromScore() usada na revelação
  response_ms integer null,   -- null = nunca confirmou (timeout)
  created_at timestamptz not null default now()
);
create index round_guesses_theme_question_idx on public.round_guesses (theme_id, question_id);
create index round_guesses_match_idx on public.round_guesses (match_id);
create index round_guesses_user_idx on public.round_guesses (user_id, created_at desc);
create index round_guesses_created_idx on public.round_guesses (created_at desc);

alter table public.round_guesses enable row level security;
create policy "own guesses read" on public.round_guesses for select using (auth.uid() = user_id);
revoke insert, update, delete on public.round_guesses from authenticated, anon;

-- ---------------------------------------------------------------------
-- 3. question_overrides — ativar/desativar uma pergunta do catálogo
--    estático (shared/aiQuestions.ts) sem migrar o catálogo inteiro pro
--    banco. Leitura pública pra authenticated (mesmo padrão de
--    achievements/achievement_rewards — catálogo pequeno, sem dado
--    sensível); escrita só pelo servidor.
-- ---------------------------------------------------------------------
create table public.question_overrides (
  theme_id text not null,
  question_id integer not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (theme_id, question_id)
);
alter table public.question_overrides enable row level security;
create policy "question overrides read" on public.question_overrides for select to authenticated using (true);
revoke insert, update, delete on public.question_overrides from authenticated, anon;

-- ---------------------------------------------------------------------
-- 4. question_reports — persistência real do que reportQuestion() já
--    coleta hoje (hoje só em memória + arquivo local no disco do Render,
--    que não é garantido sobreviver a um redeploy). O servidor passa a
--    gravar nos dois lugares; nada do que já funciona é removido.
-- ---------------------------------------------------------------------
create table public.question_reports (
  id bigint generated always as identity primary key,
  user_id uuid null references auth.users(id) on delete set null,
  room_code text not null,
  theme_id text not null,
  question_id integer null,
  phrase text not null,
  created_at timestamptz not null default now()
);
alter table public.question_reports enable row level security;
revoke select, insert, update, delete on public.question_reports from authenticated, anon;

-- ---------------------------------------------------------------------
-- 5. Ajuste no título "Bafomeeeeeeee": era "666 pontos logo após um
--    palpite perfeito" (hit_666_with_perfect_count >= 1), passa a ser
--    "666 pontos 6 vezes" (hit_666_count >= 6) — hit_666_count já existe
--    e já é incrementado a cada 666 desde o 0003, então não precisa de
--    coluna nova, só trocar o critério que o achievement aponta.
-- ---------------------------------------------------------------------
update public.achievements
set criteria_type = 'hit_666_count', criteria_value = 6
where id = 'bafomeeeeeeee';
