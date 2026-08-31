import { useCallback, useEffect, useState } from 'react';
import { fetchProfileData, fetchMatchHistoryPage, type ProfileData, type MatchHistoryRow } from '../stats.ts';

export function useProfileData(userId: string | null) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<MatchHistoryRow[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetched once when the screen mounts (userId is stable for the session)
  // — not re-fetched on every render, and nothing here polls.
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchProfileData(userId).then((d) => {
      if (!cancelled) { setData(d); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userId]);

  const loadMoreHistory = useCallback(() => {
    if (!userId || historyLoading || !historyHasMore) return;
    setHistoryLoading(true);
    fetchMatchHistoryPage(userId, historyPage).then(({ rows, hasMore }) => {
      setHistory((prev) => [...prev, ...rows]);
      setHistoryHasMore(hasMore);
      setHistoryPage((p) => p + 1);
      setHistoryLoading(false);
    });
  }, [userId, historyPage, historyLoading, historyHasMore]);

  // Only the first page loads automatically — every page after that is a
  // deliberate "carregar mais" click (see ProfileScreen), so the history
  // table is never fetched in full just because the profile was opened.
  useEffect(() => {
    if (userId) loadMoreHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { data, loading, history, historyHasMore, historyLoading, loadMoreHistory };
}
