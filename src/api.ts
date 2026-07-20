import type { Expense, Group, Member } from './types';

const TOKEN_KEY = 'sp_auth_token';

export type LedgerState = {
  groups: Group[];
  members: Member[];
  expenses: Expense[];
  activeGroupId: string;
};

function apiBase(): string {
  const base = import.meta.env.VITE_API_URL as string | undefined;
  return base?.replace(/\/$/, '') ?? '';
}

function authHeaders(): HeadersInit {
  const token = sessionStorage.getItem(TOKEN_KEY);
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function unlock(pin: string): Promise<{ token: string; lastLoginAt: string }> {
  const res = await fetch(`${apiBase()}/api/auth/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || 'Invalid PIN');
  }
  const data = (await res.json()) as { token: string; lastLoginAt: string };
  sessionStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

export async function getState(): Promise<LedgerState> {
  const res = await fetch(`${apiBase()}/api/state`, { headers: authHeaders() });
  if (res.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error('Failed to load ledger');
  return res.json() as Promise<LedgerState>;
}

export async function putState(state: LedgerState): Promise<void> {
  const res = await fetch(`${apiBase()}/api/state`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(state),
  });
  if (res.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error('Failed to save ledger');
}

export async function resetDb(): Promise<LedgerState> {
  const res = await fetch(`${apiBase()}/api/reset`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (res.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error('Failed to reset database');
  return res.json() as Promise<LedgerState>;
}
