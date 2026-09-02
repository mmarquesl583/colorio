// Admin panel backend — every route here is gated by requireAdmin() before
// touching any data (never just a hidden frontend button). Lives on the
// same HTTP server as /rooms and /reports (server/src/index.ts calls
// handleAdminRequest() for every /admin/* path), using the same
// service-role `supabaseAdmin` client the rest of the stats pipeline
// already uses to bypass RLS — no new Postgres RPCs needed for most of
// this, the aggregation happens here in TS the same way recordMatchStats()
// in room.ts already tallies things by hand.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyUserToken, supabaseAdmin, statsConfigured } from './supabaseAdmin.ts';
import type { Room } from './room.ts';
import { LOBBY_THEMES } from '../../shared/gameData.ts';
import { AI_QUESTIONS } from '../../shared/aiQuestions.ts';
import { TITLE_CATALOG } from '../../shared/titleCatalog.ts';
import { AVATAR_ICONS } from '../../shared/avatarIcons.ts';

const THEME_BY_ID = new Map(LOBBY_THEMES.map((t) => [t.id, t]));
const MODE_LABELS: Record<string, string> = { players: 'Frase dos jogadores', ai: 'Frase da IA', race: 'Corrida contra o Tempo' };

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

function bearerToken(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7);
}

/** Verifies the caller's token AND profiles.is_admin — every /admin/* route
 * calls this before touching any data. A regular player with a perfectly
 * valid session gets 401 here the same as no token at all; nothing about
 * "is this an admin" is ever decided client-side. */
async function requireAdmin(req: IncomingMessage): Promise<string | null> {
  if (!statsConfigured) return null;
  const userId = await verifyUserToken(bearerToken(req));
  if (!userId) return null;
  const { data, error } = await supabaseAdmin!.from('profiles').select('is_admin').eq('user_id', userId).maybeSingle();
  if (error || !data?.is_admin) return null;
  return userId;
}

function since(url: URL): string | null {
  const period = url.searchParams.get('period') ?? '30d';
  const from = url.searchParams.get('from');
  if (period === 'custom' && from) return new Date(from).toISOString();
  const days = period === 'today' ? 0 : period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : period === 'all' ? null : 30;
  if (days === null) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

// --- Live (in-memory, straight from the WS server's own room state) ----
function getLive(rooms: Map<string, Room>) {
  const onlineUserIds = new Set<string>();
  let activeRooms = 0;
  let matchesInProgress = 0;
  const themeCounts = new Map<string, number>();
  const modeCounts = new Map<string, number>();
  const roomList: unknown[] = [];

  for (const room of rooms.values()) {
    const connectedPlayers = [...room.players.values()].filter((p) => p.connected);
    if (connectedPlayers.length === 0) continue;
    activeRooms += 1;
    for (const p of connectedPlayers) if (p.userId) onlineUserIds.add(p.userId);
    if (room.screen === 'playing') {
      matchesInProgress += 1;
      const modeId = room.config.gameMode === 'race' ? 'race' : room.config.phraseMode;
      modeCounts.set(modeId, (modeCounts.get(modeId) ?? 0) + 1);
      if (room.round) themeCounts.set(room.round.themeId, (themeCounts.get(room.round.themeId) ?? 0) + 1);
    }
    roomList.push({
      code: room.code,
      hostName: room.players.get(room.hostId ?? '')?.name ?? null,
      screen: room.screen,
      privacy: room.config.privacy,
      modeId: room.config.gameMode === 'race' ? 'race' : room.config.phraseMode,
      playerCount: connectedPlayers.length,
      numPlayers: room.config.numPlayers,
      roundNumber: room.round?.number ?? null,
      numRounds: room.config.numRounds,
      themeName: room.round?.themeName ?? null,
      createdAt: new Date(room.createdAt).toISOString(),
    });
  }

  const topThemeId = [...themeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topModeId = [...modeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    playersOnline: onlineUserIds.size,
    activeRooms,
    matchesInProgress,
    topCategory: topThemeId ? (THEME_BY_ID.get(topThemeId)?.name ?? topThemeId) : null,
    topMode: topModeId ? (MODE_LABELS[topModeId] ?? topModeId) : null,
    rooms: roomList.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1)),
  };
}

// --- Dashboard -----------------------------------------------------------
async function getDashboard(url: URL) {
  const sb = supabaseAdmin!;
  const sinceIso = since(url);
  const todayIso = new Date(); todayIso.setUTCHours(0, 0, 0, 0);
  const todayStr = todayIso.toISOString();

  const [usersRes, activeTodayRes, newTodayRes, matchesRes] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('player_stats').select('*', { count: 'exact', head: true }).eq('last_play_date', todayStr.slice(0, 10)),
    sb.from('profiles').select('*', { count: 'exact', head: true }).gte('first_seen_at', todayStr),
    sb.from('match_history').select('match_id, mode_id, theme_ids, duration_seconds, correct_answers, wrong_answers, played_at')
      .gte('played_at', sinceIso ?? '1970-01-01').order('played_at', { ascending: false }).limit(20000),
  ]);

  const rows = matchesRes.data ?? [];
  // match_history is one row per participant — dedupe by match_id for
  // anything that should count once per match (duration, matches/day).
  const byMatch = new Map<string, typeof rows[number]>();
  for (const r of rows) if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, r);
  const matches = [...byMatch.values()];

  const matchesToday = matches.filter((m) => m.played_at >= todayStr).length;
  const avgDuration = matches.length ? Math.round(matches.reduce((s, m) => s + (m.duration_seconds ?? 0), 0) / matches.length) : 0;
  const totalCorrect = rows.reduce((s, r) => s + (r.correct_answers ?? 0), 0);
  const totalWrong = rows.reduce((s, r) => s + (r.wrong_answers ?? 0), 0);
  const avgAccuracy = totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : null;

  const usersByDay = new Map<string, number>();
  const matchesByDay = new Map<string, number>();
  for (const m of matches) matchesByDay.set(dayKey(m.played_at), (matchesByDay.get(dayKey(m.played_at)) ?? 0) + 1);

  const { data: newUsers } = await sb.from('profiles').select('first_seen_at').gte('first_seen_at', sinceIso ?? '1970-01-01').limit(20000);
  for (const u of newUsers ?? []) usersByDay.set(dayKey(u.first_seen_at), (usersByDay.get(dayKey(u.first_seen_at)) ?? 0) + 1);

  const modeCounts = new Map<string, number>();
  const themeCounts = new Map<string, number>();
  const hourCounts = new Array(24).fill(0);
  for (const m of matches) {
    modeCounts.set(m.mode_id, (modeCounts.get(m.mode_id) ?? 0) + 1);
    hourCounts[new Date(m.played_at).getUTCHours()] += 1;
    for (const themeId of m.theme_ids ?? []) themeCounts.set(themeId, (themeCounts.get(themeId) ?? 0) + 1);
  }

  const toSeries = (map: Map<string, number>) => [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, count]) => ({ date, count }));

  return {
    kpis: {
      totalUsers: usersRes.count ?? 0,
      activeToday: activeTodayRes.count ?? 0,
      newToday: newTodayRes.count ?? 0,
      matchesToday,
      matchesInProgress: null, // filled client-side from /admin/live, kept separate (in-memory vs Postgres)
      avgMatchDurationSeconds: avgDuration,
      avgAccuracyPct: avgAccuracy,
      totalMatches: matches.length,
    },
    charts: {
      usersByDay: toSeries(usersByDay),
      matchesByDay: toSeries(matchesByDay),
      matchesByMode: [...modeCounts.entries()].map(([modeId, count]) => ({ label: MODE_LABELS[modeId] ?? modeId, count })),
      matchesByCategory: [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([themeId, count]) => ({ label: THEME_BY_ID.get(themeId)?.name ?? themeId, count })),
      busiestHours: hourCounts.map((count, hour) => ({ hour, count })),
    },
  };
}

// --- Usuários --------------------------------------------------------------
async function getUsers(url: URL) {
  const sb = supabaseAdmin!;
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
  const filter = url.searchParams.get('filter') ?? 'todos';
  const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50));

  // display_name/avatar live in auth.users metadata, not a normal table —
  // the Admin Auth API (unlocked by the service-role key) is the only way
  // to list that in bulk. Capped at 1000/page, fine for this project's scale.
  const { data: authRes, error: authErr } = await sb.auth.admin.listUsers({ perPage: 1000, page: 1 });
  if (authErr) throw authErr;
  const users = authRes.users;

  const ids = users.map((u) => u.id);
  const [statsRes, friendsRes, titlesRes] = await Promise.all([
    sb.from('player_stats').select('*').in('user_id', ids),
    sb.from('friendships').select('user_id').in('user_id', ids),
    sb.from('player_titles').select('user_id').in('user_id', ids),
  ]);
  const statsByUser = new Map((statsRes.data ?? []).map((s) => [s.user_id, s]));
  const friendCounts = new Map<string, number>();
  for (const f of friendsRes.data ?? []) friendCounts.set(f.user_id, (friendCounts.get(f.user_id) ?? 0) + 1);
  const titleCounts = new Map<string, number>();
  for (const t of titlesRes.data ?? []) titleCounts.set(t.user_id, (titleCounts.get(t.user_id) ?? 0) + 1);

  let rows = users.map((u) => {
    const s = statsByUser.get(u.id);
    const name = (u.user_metadata?.display_name as string | undefined)?.trim() || u.email?.split('@')[0] || 'Jogador';
    const accuracy = s && (s.correct_answers + s.wrong_answers) > 0 ? Math.round((s.correct_answers / (s.correct_answers + s.wrong_answers)) * 100) : null;
    return {
      id: u.id,
      name,
      avatarId: (u.user_metadata?.avatar_icon as string | undefined) ?? null,
      createdAt: u.created_at,
      lastLoginAt: u.last_sign_in_at ?? null,
      gamesPlayed: s?.games_played ?? 0,
      gamesWon: s?.games_won ?? 0,
      accuracyPct: accuracy,
      bestScore: s?.best_score ?? 0,
      totalPlaytimeSeconds: s?.total_playtime_seconds ?? 0,
      friendsCount: friendCounts.get(u.id) ?? 0,
      titlesCount: titleCounts.get(u.id) ?? 0,
      lastPlayDate: s?.last_play_date ?? null,
    };
  });

  if (search) rows = rows.filter((r) => r.name.toLowerCase().includes(search));
  const todayStr = new Date().toISOString().slice(0, 10);
  if (filter === 'novos') rows = rows.filter((r) => r.createdAt >= new Date(Date.now() - 7 * 86400000).toISOString());
  else if (filter === 'mais-ativos') rows = [...rows].sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  else if (filter === 'mais-vitorias') rows = [...rows].sort((a, b) => b.gamesWon - a.gamesWon);
  else if (filter === 'inativos') rows = rows.filter((r) => !r.lastPlayDate || r.lastPlayDate < new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  else if (filter === 'online') rows = rows.filter((r) => r.lastPlayDate === todayStr);
  if (filter === 'todos' || search) rows = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return { total: rows.length, users: rows.slice(0, limit) };
}

async function getUserDetail(userId: string) {
  const sb = supabaseAdmin!;
  const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) return null;
  const u = authUser.user;

  const [profileRes, statsRes, modeRes, matchesRes, friendsRes, titlesRes, avatarsRes, achRes] = await Promise.all([
    sb.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('player_stats').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('player_mode_stats').select('*').eq('user_id', userId),
    sb.from('match_history').select('*').eq('user_id', userId).order('played_at', { ascending: false }).limit(50),
    sb.from('friendships').select('friend_id').eq('user_id', userId),
    sb.from('player_titles').select('title_id').eq('user_id', userId),
    sb.from('player_avatars').select('avatar_id').eq('user_id', userId),
    sb.from('player_achievements').select('achievement_id, unlocked_at').eq('user_id', userId),
  ]);

  const name = (u.user_metadata?.display_name as string | undefined)?.trim() || u.email?.split('@')[0] || 'Jogador';
  return {
    id: u.id,
    name,
    email: u.email ?? null,
    avatarId: (u.user_metadata?.avatar_icon as string | undefined) ?? null,
    titleId: profileRes.data?.title_id ?? null,
    isAdmin: profileRes.data?.is_admin ?? false,
    createdAt: u.created_at,
    lastLoginAt: u.last_sign_in_at ?? null,
    stats: statsRes.data ?? null,
    modeStats: modeRes.data ?? [],
    friendsCount: (friendsRes.data ?? []).length,
    titleIds: (titlesRes.data ?? []).map((t) => t.title_id),
    avatarIds: (avatarsRes.data ?? []).map((a) => a.avatar_id),
    achievements: achRes.data ?? [],
    recentMatches: (matchesRes.data ?? []).map((m) => ({
      matchId: m.match_id, playedAt: m.played_at, modeId: m.mode_id, themeIds: m.theme_ids,
      result: m.result, score: m.score, perfects: m.perfects, durationSeconds: m.duration_seconds,
      correctAnswers: m.correct_answers, wrongAnswers: m.wrong_answers,
    })),
  };
}

// --- Partidas --------------------------------------------------------------
async function getMatches(url: URL) {
  const sb = supabaseAdmin!;
  const sinceIso = since(url);
  const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50));
  const { data, error } = await sb.from('match_history').select('*')
    .gte('played_at', sinceIso ?? '1970-01-01').order('played_at', { ascending: false }).limit(5000);
  if (error) throw error;
  const rows = data ?? [];

  const byMatch = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, []);
    byMatch.get(r.match_id)!.push(r);
  }

  const matches = [...byMatch.entries()].map(([matchId, participants]) => {
    const winner = participants.find((p) => p.result === 'won');
    const first = participants[0];
    return {
      matchId,
      playedAt: first.played_at,
      modeId: first.mode_id,
      themeIds: first.theme_ids,
      playerCount: participants.length,
      winnerName: null as string | null, // names aren't in match_history; resolved client-side isn't worth it here, admin can drill into /admin/matches/:id
      winnerScore: winner?.score ?? Math.max(...participants.map((p) => p.score)),
      durationSeconds: first.duration_seconds,
      roomCode: first.room_code,
    };
  }).sort((a, b) => (a.playedAt < b.playedAt ? 1 : -1));

  const totalToday = matches.filter((m) => dayKey(m.playedAt) === dayKey(new Date().toISOString())).length;
  const avgPlayers = matches.length ? matches.reduce((s, m) => s + m.playerCount, 0) / matches.length : 0;
  const avgDuration = matches.length ? matches.reduce((s, m) => s + m.durationSeconds, 0) / matches.length : 0;

  return {
    kpis: { total: matches.length, today: totalToday, avgPlayers: Math.round(avgPlayers * 10) / 10, avgDurationSeconds: Math.round(avgDuration) },
    matches: matches.slice(0, limit),
  };
}

async function getMatchDetail(matchId: string) {
  const sb = supabaseAdmin!;
  const [historyRes, guessesRes] = await Promise.all([
    sb.from('match_history').select('*').eq('match_id', matchId),
    sb.from('round_guesses').select('*').eq('match_id', matchId).order('created_at', { ascending: true }),
  ]);
  const participants = historyRes.data ?? [];
  if (participants.length === 0) return null;

  // Names: match_history/round_guesses only have user_id — resolve via the
  // Admin Auth API for just the users in this one match (small, bounded set).
  const userIds = [...new Set(participants.map((p) => p.user_id))];
  const names = new Map<string, string>();
  await Promise.all(userIds.map(async (id) => {
    const { data } = await sb.auth.admin.getUserById(id);
    const n = (data?.user?.user_metadata?.display_name as string | undefined)?.trim() || data?.user?.email?.split('@')[0] || 'Jogador';
    names.set(id, n);
  }));

  return {
    matchId,
    roomCode: participants[0].room_code,
    playedAt: participants[0].played_at,
    modeId: participants[0].mode_id,
    themeIds: participants[0].theme_ids,
    durationSeconds: participants[0].duration_seconds,
    participants: participants.map((p) => ({
      userId: p.user_id, name: names.get(p.user_id) ?? 'Jogador', result: p.result, score: p.score,
      perfects: p.perfects, correctAnswers: p.correct_answers, wrongAnswers: p.wrong_answers,
    })),
    rounds: (guessesRes.data ?? []).map((g) => ({
      userId: g.user_id, name: names.get(g.user_id) ?? 'Jogador', themeId: g.theme_id, questionId: g.question_id,
      phrase: g.phrase, secretHex: g.secret_hex, guessHex: g.guess_hex, deltaE: g.delta_e,
      score: g.score, badge: g.badge, responseMs: g.response_ms, createdAt: g.created_at,
    })),
  };
}

// --- Perguntas ---------------------------------------------------------
async function getQuestions(url: URL) {
  const sb = supabaseAdmin!;
  const themeFilter = url.searchParams.get('theme');
  const difficultyFilter = url.searchParams.get('difficulty');
  const sort = url.searchParams.get('sort') ?? 'mais-respondidas';

  const { data: overrides } = await sb.from('question_overrides').select('*');
  const overrideMap = new Map((overrides ?? []).map((o) => [`${o.theme_id}:${o.question_id}`, o.active]));

  const { data: guessRows } = await sb.from('round_guesses').select('theme_id, question_id, delta_e, score, response_ms')
    .not('question_id', 'is', null).limit(50000);
  const statsByQuestion = new Map<string, { count: number; sumDe: number; sumScore: number; sumMs: number; msCount: number }>();
  for (const g of guessRows ?? []) {
    const key = `${g.theme_id}:${g.question_id}`;
    const acc = statsByQuestion.get(key) ?? { count: 0, sumDe: 0, sumScore: 0, sumMs: 0, msCount: 0 };
    acc.count += 1; acc.sumDe += g.delta_e; acc.sumScore += g.score;
    if (g.response_ms != null) { acc.sumMs += g.response_ms; acc.msCount += 1; }
    statsByQuestion.set(key, acc);
  }

  let rows: any[] = [];
  for (const theme of LOBBY_THEMES) {
    if (themeFilter && theme.id !== themeFilter) continue;
    const bank = AI_QUESTIONS[theme.id] ?? [];
    for (const q of bank) {
      if (difficultyFilter && q.dificuldade !== difficultyFilter) continue;
      const key = `${theme.id}:${q.id}`;
      const s = statsByQuestion.get(key);
      rows.push({
        themeId: theme.id, themeName: theme.name, questionId: q.id, pergunta: q.pergunta,
        dificuldade: q.dificuldade, active: overrideMap.get(key) ?? true,
        responses: s?.count ?? 0,
        avgDeltaE: s ? Math.round((s.sumDe / s.count) * 100) / 100 : null,
        avgScore: s ? Math.round(s.sumScore / s.count) : null,
        avgResponseMs: s && s.msCount > 0 ? Math.round(s.sumMs / s.msCount) : null,
      });
    }
  }

  if (sort === 'mais-respondidas') rows.sort((a, b) => b.responses - a.responses);
  else if (sort === 'menos-respondidas') rows.sort((a, b) => a.responses - b.responses);
  else if (sort === 'mais-acertadas') rows.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
  else if (sort === 'menos-acertadas') rows.sort((a, b) => (a.avgScore ?? 1001) - (b.avgScore ?? 1001));
  else if (sort === 'maior-tempo') rows.sort((a, b) => (b.avgResponseMs ?? -1) - (a.avgResponseMs ?? -1));

  return { total: rows.length, questions: rows.slice(0, 300) };
}

// 6 faixas de precisão pedidas pelo admin, derivadas da mesma classificação
// de 7 faixas usada em toda a pontuação/revelação (shared/scoring.ts
// badgeFromScore) — QUASE LÁ e NEM PERTO viram "Mediano"/"Ruim" pra bater
// com o vocabulário do pedido, sem inventar uma segunda régua de corte.
const PRECISION_TIERS = [
  { key: 'perfeito', label: 'Perfeito', badges: ['PERFEITO'] },
  { key: 'quase-perfeito', label: 'Quase perfeito', badges: ['CIRÚRGICO'] },
  { key: 'bom', label: 'Bom', badges: ['MUITO PERTO'] },
  { key: 'mediano', label: 'Mediano', badges: ['PERTO', 'QUASE LÁ'] },
  { key: 'ruim', label: 'Ruim', badges: ['NEM PERTO'] },
  { key: 'muito-ruim', label: 'Muito ruim', badges: ['PASSOU LONGE'] },
];

async function getQuestionDetail(themeId: string, questionId: number) {
  const sb = supabaseAdmin!;
  const theme = THEME_BY_ID.get(themeId);
  const q = (AI_QUESTIONS[themeId] ?? []).find((x) => x.id === questionId);
  if (!theme || !q) return null;

  const { data: guesses, error } = await sb.from('round_guesses').select('*')
    .eq('theme_id', themeId).eq('question_id', questionId).limit(20000);
  if (error) throw error;
  const rows = guesses ?? [];

  const tierCounts = PRECISION_TIERS.map((t) => ({ ...t, count: rows.filter((r) => t.badges.includes(r.badge)).length }));
  const total = rows.length;
  const deltaEs = rows.map((r) => r.delta_e).sort((a, b) => a - b);
  const mean = deltaEs.length ? deltaEs.reduce((s, v) => s + v, 0) / deltaEs.length : null;
  const median = deltaEs.length ? deltaEs[Math.floor(deltaEs.length / 2)] : null;
  const best = rows.length ? rows.reduce((b, r) => (r.delta_e < b.delta_e ? r : b)) : null;
  const worst = rows.length ? rows.reduce((w, r) => (r.delta_e > w.delta_e ? r : w)) : null;
  const responseTimes = rows.map((r) => r.response_ms).filter((v): v is number => v != null);
  const avgResponseMs = responseTimes.length ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length) : null;
  const closePct = total ? Math.round((rows.filter((r) => r.score >= 800).length / total) * 100) : null;
  const farPct = total ? Math.round((rows.filter((r) => r.score < 0).length / total) * 100) : null;

  return {
    themeId, themeName: theme.name, questionId, pergunta: q.pergunta, dificuldade: q.dificuldade, secretHex: q.hex,
    totalResponses: total,
    precisionTiers: tierCounts.map((t) => ({ key: t.key, label: t.label, count: t.count, pct: total ? Math.round((t.count / total) * 100) : 0 })),
    avgDeltaE: mean !== null ? Math.round(mean * 100) / 100 : null,
    medianDeltaE: median !== null ? Math.round(median * 100) / 100 : null,
    bestGuess: best ? { hex: best.guess_hex, deltaE: best.delta_e } : null,
    worstGuess: worst ? { hex: worst.guess_hex, deltaE: worst.delta_e } : null,
    avgResponseMs,
    veryClosePct: closePct,
    veryFarPct: farPct,
    guessMap: rows.slice(0, 500).map((r) => ({ hex: r.guess_hex, deltaE: r.delta_e, score: r.score })),
  };
}

async function toggleQuestion(themeId: string, questionId: number, active: boolean) {
  const sb = supabaseAdmin!;
  const { error } = await sb.from('question_overrides').upsert({ theme_id: themeId, question_id: questionId, active, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// --- Categorias / Modos ---------------------------------------------------
async function getCategories(url: URL) {
  const sb = supabaseAdmin!;
  const sinceIso = since(url);
  const { data: themeStats } = await sb.from('player_theme_stats').select('*');
  const { data: matches } = await sb.from('match_history').select('theme_ids').gte('played_at', sinceIso ?? '1970-01-01').limit(20000);

  const playedCount = new Map<string, number>();
  for (const m of matches ?? []) for (const themeId of m.theme_ids ?? []) playedCount.set(themeId, (playedCount.get(themeId) ?? 0) + 1);

  const rows = LOBBY_THEMES.map((theme) => {
    const stats = (themeStats ?? []).filter((s) => s.theme_id === theme.id);
    const correct = stats.reduce((s, x) => s + x.correct_answers, 0);
    const wrong = stats.reduce((s, x) => s + x.wrong_answers, 0);
    const perfects = stats.reduce((s, x) => s + x.perfects, 0);
    return {
      themeId: theme.id, themeName: theme.name, icon: theme.icon,
      matchesPlayed: playedCount.get(theme.id) ?? 0,
      players: stats.length,
      accuracyPct: correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : null,
      perfects,
      hasAiBank: (AI_QUESTIONS[theme.id]?.length ?? 0) > 0,
    };
  });

  return {
    byPopularity: [...rows].sort((a, b) => b.matchesPlayed - a.matchesPlayed),
    byAccuracyDesc: [...rows].filter((r) => r.accuracyPct !== null).sort((a, b) => (b.accuracyPct ?? 0) - (a.accuracyPct ?? 0)),
    byAccuracyAsc: [...rows].filter((r) => r.accuracyPct !== null).sort((a, b) => (a.accuracyPct ?? 0) - (b.accuracyPct ?? 0)),
  };
}

async function getModes(url: URL) {
  const sb = supabaseAdmin!;
  const sinceIso = since(url);
  const { data: matches } = await sb.from('match_history').select('*').gte('played_at', sinceIso ?? '1970-01-01').limit(20000);
  const rows = matches ?? [];
  const byMatch = new Map<string, typeof rows>();
  for (const r of rows) { if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, []); byMatch.get(r.match_id)!.push(r); }

  const modeIds = ['players', 'ai', 'race'];
  const result = modeIds.map((modeId) => {
    const matchGroups = [...byMatch.values()].filter((g) => g[0].mode_id === modeId);
    const participants = rows.filter((r) => r.mode_id === modeId);
    const avgDuration = matchGroups.length ? matchGroups.reduce((s, g) => s + g[0].duration_seconds, 0) / matchGroups.length : 0;
    const avgScore = participants.length ? participants.reduce((s, p) => s + p.score, 0) / participants.length : 0;
    const correct = participants.reduce((s, p) => s + p.correct_answers, 0);
    const wrong = participants.reduce((s, p) => s + p.wrong_answers, 0);
    return {
      modeId, label: MODE_LABELS[modeId] ?? modeId,
      matches: matchGroups.length,
      participants: participants.length,
      avgDurationSeconds: Math.round(avgDuration),
      avgScore: Math.round(avgScore),
      accuracyPct: correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : null,
    };
  });
  return { modes: result, note: 'Modo "Desafio" ainda não existe no jogo — não aparece aqui porque não há dado real pra mostrar.' };
}

// --- Títulos / Avatares / Conquistas -------------------------------------
async function getTitles() {
  const sb = supabaseAdmin!;
  const { count: totalUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true });
  const { data: rows } = await sb.from('player_titles').select('title_id');
  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.title_id, (counts.get(r.title_id) ?? 0) + 1);
  const { data: overrides } = await sb.from('achievements').select('id, active');

  const list = TITLE_CATALOG.map((t) => {
    const holders = t.free ? (totalUsers ?? 0) : (counts.get(t.id) ?? 0);
    return {
      id: t.id, name: t.name, description: t.description, category: t.category, free: t.free ?? false,
      holders, pctOfPlayers: totalUsers ? Math.round((holders / totalUsers) * 1000) / 10 : 0,
      active: (overrides ?? []).find((o) => o.id === t.id)?.active ?? true,
    };
  });
  return {
    titles: list.sort((a, b) => b.holders - a.holders),
    mostUnlocked: [...list].sort((a, b) => b.holders - a.holders).slice(0, 5),
    rarest: [...list].filter((t) => !t.free).sort((a, b) => a.holders - b.holders).slice(0, 5),
  };
}

async function getAvatars() {
  const sb = supabaseAdmin!;
  const { data: authRes } = await sb.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const users = authRes?.users ?? [];
  const usageCounts = new Map<string, number>();
  for (const u of users) {
    const avatarId = u.user_metadata?.avatar_icon as string | undefined;
    if (avatarId) usageCounts.set(avatarId, (usageCounts.get(avatarId) ?? 0) + 1);
  }
  const { data: unlockRows } = await sb.from('player_avatars').select('avatar_id');
  const unlockCounts = new Map<string, number>();
  for (const r of unlockRows ?? []) unlockCounts.set(r.avatar_id, (unlockCounts.get(r.avatar_id) ?? 0) + 1);

  const list = AVATAR_ICONS.map((a) => ({
    id: a.id, name: a.name, rarity: a.rarity, free: a.free ?? false,
    inUseCount: usageCounts.get(a.id) ?? 0,
    inUsePct: users.length ? Math.round(((usageCounts.get(a.id) ?? 0) / users.length) * 1000) / 10 : 0,
    unlockedCount: a.free ? users.length : (unlockCounts.get(a.id) ?? 0),
  }));
  return {
    avatars: list.sort((a, b) => b.inUseCount - a.inUseCount),
    mostUsed: [...list].sort((a, b) => b.inUseCount - a.inUseCount).slice(0, 5),
    leastUsed: [...list].sort((a, b) => a.inUseCount - b.inUseCount).slice(0, 5),
  };
}

async function getAchievements() {
  const sb = supabaseAdmin!;
  const { count: totalUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true });
  const [{ data: achievements }, { data: grants }] = await Promise.all([
    sb.from('achievements').select('*').order('sort_order', { ascending: true }),
    sb.from('player_achievements').select('achievement_id'),
  ]);
  const counts = new Map<string, number>();
  for (const g of grants ?? []) counts.set(g.achievement_id, (counts.get(g.achievement_id) ?? 0) + 1);
  return {
    achievements: (achievements ?? []).map((a) => ({
      id: a.id, name: a.name, description: a.description, criteriaType: a.criteria_type, criteriaValue: a.criteria_value,
      createdAt: a.created_at, holders: counts.get(a.id) ?? 0, active: a.active ?? true,
      pctOfPlayers: totalUsers ? Math.round(((counts.get(a.id) ?? 0) / totalUsers) * 1000) / 10 : 0,
    })),
  };
}

async function toggleCatalogItem(table: 'achievements', id: string, active: boolean) {
  const sb = supabaseAdmin!;
  const { error } = await sb.from(table).update({ active }).eq('id', id);
  if (error) throw error;
}

// --- Denúncias -------------------------------------------------------------
async function getReports() {
  const sb = supabaseAdmin!;
  const { data, error } = await sb.from('question_reports').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return { reports: data ?? [] };
}

// --- Retenção --------------------------------------------------------------
async function getRetention() {
  const sb = supabaseAdmin!;
  const { data: profiles } = await sb.from('profiles').select('user_id, first_seen_at').limit(20000);
  const { data: playDays } = await sb.from('player_play_days').select('user_id, play_date').limit(200000);
  const daysByUser = new Map<string, Set<string>>();
  for (const row of playDays ?? []) {
    if (!daysByUser.has(row.user_id)) daysByUser.set(row.user_id, new Set());
    daysByUser.get(row.user_id)!.add(row.play_date);
  }

  let d1 = 0, d7 = 0, d30 = 0, cohort = 0;
  for (const p of profiles ?? []) {
    const firstDay = p.first_seen_at.slice(0, 10);
    const days = daysByUser.get(p.user_id);
    if (!days) continue;
    // Only counts as a real cohort member if there's enough elapsed time to
    // have possibly returned — otherwise "não voltou em 30 dias" would
    // unfairly include someone who signed up yesterday.
    const ageDays = Math.floor((Date.now() - new Date(p.first_seen_at).getTime()) / 86400000);
    if (ageDays < 1) continue;
    cohort += 1;
    const firstDate = new Date(firstDay);
    const plus1 = new Date(firstDate); plus1.setDate(plus1.getDate() + 1);
    const plus7 = new Date(firstDate); plus7.setDate(plus7.getDate() + 7);
    const plus30 = new Date(firstDate); plus30.setDate(plus30.getDate() + 30);
    if ([...days].some((d) => d === plus1.toISOString().slice(0, 10))) d1 += 1;
    if (ageDays >= 7 && [...days].some((d) => d >= plus1.toISOString().slice(0, 10) && d <= plus7.toISOString().slice(0, 10))) d7 += 1;
    if (ageDays >= 30 && [...days].some((d) => d >= plus1.toISOString().slice(0, 10) && d <= plus30.toISOString().slice(0, 10))) d30 += 1;
  }

  return {
    cohortSize: cohort,
    d1RetentionPct: cohort ? Math.round((d1 / cohort) * 1000) / 10 : null,
    d7RetentionPct: cohort ? Math.round((d7 / cohort) * 1000) / 10 : null,
    d30RetentionPct: cohort ? Math.round((d30 / cohort) * 1000) / 10 : null,
  };
}

// --- Análise de palpites -----------------------------------------------
async function getGuesses(url: URL) {
  const sb = supabaseAdmin!;
  const sinceIso = since(url);
  const themeId = url.searchParams.get('theme');
  const modeId = url.searchParams.get('mode');
  let q = sb.from('round_guesses').select('*').gte('created_at', sinceIso ?? '1970-01-01').limit(20000);
  if (themeId) q = q.eq('theme_id', themeId);
  if (modeId) q = q.eq('mode_id', modeId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const total = rows.length;
  const tierCounts = PRECISION_TIERS.map((t) => ({ label: t.label, count: rows.filter((r) => t.badges.includes(r.badge)).length }));
  const avgDeltaE = total ? Math.round((rows.reduce((s, r) => s + r.delta_e, 0) / total) * 100) / 100 : null;

  const hueBuckets = new Array(12).fill(0); // 12 x 30° hue slices — needs guess_hex -> hue
  for (const r of rows) {
    const hue = hexToHue(r.guess_hex);
    if (hue !== null) hueBuckets[Math.floor(hue / 30) % 12] += 1;
  }

  return {
    totalGuesses: total,
    avgDeltaE,
    precisionBreakdown: tierCounts.map((t) => ({ ...t, pct: total ? Math.round((t.count / total) * 100) : 0 })),
    hueDistribution: hueBuckets.map((count, i) => ({ hueStart: i * 30, count })),
  };
}

function hexToHue(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

// --- Router ----------------------------------------------------------------
export async function handleAdminRequest(req: IncomingMessage, res: ServerResponse, url: URL, rooms: Map<string, Room>): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST',
      'access-control-allow-headers': 'authorization,content-type',
    });
    res.end();
    return;
  }

  const adminId = await requireAdmin(req);
  if (!adminId) { json(res, 401, { error: 'unauthorized' }); return; }

  const parts = url.pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);

  try {
    if (parts[0] === 'check') { json(res, 200, { ok: true }); return; }
    if (parts[0] === 'dashboard') { json(res, 200, await getDashboard(url)); return; }
    if (parts[0] === 'live') { json(res, 200, getLive(rooms)); return; }

    if (parts[0] === 'users' && parts.length === 1) { json(res, 200, await getUsers(url)); return; }
    if (parts[0] === 'users' && parts.length === 2) {
      const detail = await getUserDetail(parts[1]);
      json(res, detail ? 200 : 404, detail ?? { error: 'not_found' });
      return;
    }

    if (parts[0] === 'matches' && parts.length === 1) { json(res, 200, await getMatches(url)); return; }
    if (parts[0] === 'matches' && parts.length === 2) {
      const detail = await getMatchDetail(parts[1]);
      json(res, detail ? 200 : 404, detail ?? { error: 'not_found' });
      return;
    }

    if (parts[0] === 'questions' && parts.length === 1) { json(res, 200, await getQuestions(url)); return; }
    if (parts[0] === 'questions' && parts.length === 3 && parts[2] === 'toggle' && req.method === 'POST') {
      const [themeId, qidRaw] = parts[1].split(':');
      const active = url.searchParams.get('active') !== 'false';
      await toggleQuestion(themeId, Number(qidRaw), active);
      json(res, 200, { ok: true });
      return;
    }
    if (parts[0] === 'questions' && parts.length === 2) {
      const [themeId, qidRaw] = parts[1].split(':');
      const detail = await getQuestionDetail(themeId, Number(qidRaw));
      json(res, detail ? 200 : 404, detail ?? { error: 'not_found' });
      return;
    }

    if (parts[0] === 'categories') { json(res, 200, await getCategories(url)); return; }
    if (parts[0] === 'modes') { json(res, 200, await getModes(url)); return; }

    if (parts[0] === 'titles') { json(res, 200, await getTitles()); return; }
    if (parts[0] === 'avatars') { json(res, 200, await getAvatars()); return; }
    if (parts[0] === 'achievements' && parts.length === 1) { json(res, 200, await getAchievements()); return; }
    if (parts[0] === 'achievements' && parts.length === 3 && parts[2] === 'toggle' && req.method === 'POST') {
      const active = url.searchParams.get('active') !== 'false';
      await toggleCatalogItem('achievements', parts[1], active);
      json(res, 200, { ok: true });
      return;
    }

    if (parts[0] === 'reports') { json(res, 200, await getReports()); return; }
    if (parts[0] === 'retention') { json(res, 200, await getRetention()); return; }
    if (parts[0] === 'guesses') { json(res, 200, await getGuesses(url)); return; }

    json(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error('Admin route error:', err);
    json(res, 500, { error: 'internal' });
  }
}
