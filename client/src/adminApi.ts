// Thin fetch wrapper for the /admin/* routes on the game server — every
// call attaches the current session's access token, and the server itself
// re-verifies is_admin on every single request (see server/src/admin.ts).
// A stale/expired token or a non-admin account gets a 401 here no matter
// what the client thinks it knows.
import { supabase } from './supabase.ts';
import { HTTP_BASE } from './ws.ts';

export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchAdmin<T = unknown>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError(401, 'Sem sessão ativa.');

  const url = new URL(`${HTTP_BASE}/admin/${path}`);
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AdminApiError(res.status, body?.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function postAdmin(path: string, params?: Record<string, string | undefined>): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError(401, 'Sem sessão ativa.');

  const url = new URL(`${HTTP_BASE}/admin/${path}`);
  if (params) for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AdminApiError(res.status, body?.error ?? `Erro ${res.status}`);
  }
}

/** Converts an array of flat objects to a CSV string and triggers a
 * download — no backend endpoint needed, the data's already in the browser
 * by the time an admin clicks "Exportar". */
export function exportCsv<T extends object>(filename: string, rows: T[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]) as (keyof T)[];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
