import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import type { Expense, Group, Member } from '../src/types.js';
import { buildDefaultTrip } from './seed.js';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type LedgerState = {
  groups: Group[];
  members: Member[];
  expenses: Expense[];
  activeGroupId: string;
};

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    const needsSsl =
      process.env.DATABASE_SSL === 'true' ||
      /sslmode=(require|verify-full|verify-ca)/i.test(connectionString) ||
      /\.neon\.tech/i.test(connectionString);

    pool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);

    const { rows } = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM groups');
    if (Number(rows[0]?.count ?? 0) === 0) {
      await putState(buildDefaultTrip(), client);
    }
  } finally {
    client.release();
  }
}

export async function getState(): Promise<LedgerState> {
  const db = getPool();
  const [groupsRes, membersRes, expensesRes, metaRes] = await Promise.all([
    db.query(`
      SELECT id, name, description, created_at
      FROM groups
      ORDER BY created_at ASC
    `),
    db.query(`
      SELECT id, group_id, name, email, avatar_emoji, avatar_bg_color
      FROM members
      ORDER BY name ASC
    `),
    db.query(`
      SELECT id, group_id, title, amount, paid_by_id, split_with_ids, split_type, shares, category, created_at
      FROM expenses
      ORDER BY created_at ASC
    `),
    db.query(`SELECT value FROM app_meta WHERE key = 'active_group_id'`),
  ]);

  const groups: Group[] = groupsRes.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    createdAt: new Date(r.created_at as string | Date).toISOString(),
  }));

  const members: Member[] = membersRes.rows.map((r) => ({
    id: r.id as string,
    groupId: r.group_id as string,
    name: r.name as string,
    email: (r.email as string | null) ?? undefined,
    avatarEmoji: r.avatar_emoji as string,
    avatarBgColor: r.avatar_bg_color as string,
  }));

  const expenses: Expense[] = expensesRes.rows.map((r) => ({
    id: r.id as string,
    groupId: r.group_id as string,
    title: r.title as string,
    amount: Number(r.amount),
    paidById: r.paid_by_id as string,
    splitWithIds: r.split_with_ids as string[],
    splitType: r.split_type as Expense['splitType'],
    shares: r.shares as Record<string, number>,
    category: r.category as string,
    createdAt: new Date(r.created_at as string | Date).toISOString(),
  }));

  const storedActive = metaRes.rows[0]?.value as string | undefined;
  const activeGroupId =
    storedActive && groups.some((g) => g.id === storedActive)
      ? storedActive
      : groups[0]?.id ?? '';
  return { groups, members, expenses, activeGroupId };
}

export async function putState(
  state: LedgerState,
  existingClient?: pg.PoolClient,
): Promise<void> {
  const client = existingClient ?? (await getPool().connect());
  const ownClient = !existingClient;

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM expenses');
    await client.query('DELETE FROM members');
    await client.query('DELETE FROM groups');

    for (const g of state.groups) {
      await client.query(
        `INSERT INTO groups (id, name, description, created_at)
         VALUES ($1, $2, $3, $4)`,
        [g.id, g.name, g.description, g.createdAt],
      );
    }

    for (const m of state.members) {
      await client.query(
        `INSERT INTO members (id, group_id, name, email, avatar_emoji, avatar_bg_color)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [m.id, m.groupId, m.name, m.email ?? null, m.avatarEmoji, m.avatarBgColor],
      );
    }

    for (const e of state.expenses) {
      await client.query(
        `INSERT INTO expenses (
           id, group_id, title, amount, paid_by_id, split_with_ids, split_type, shares, category, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10)`,
        [
          e.id,
          e.groupId,
          e.title,
          e.amount,
          e.paidById,
          JSON.stringify(e.splitWithIds),
          e.splitType,
          JSON.stringify(e.shares ?? {}),
          e.category,
          e.createdAt,
        ],
      );
    }

    await client.query(
      `INSERT INTO app_meta (key, value) VALUES ('active_group_id', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [state.activeGroupId || state.groups[0]?.id || ''],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownClient) client.release();
  }
}

export async function resetAndSeed(): Promise<LedgerState> {
  const seed = buildDefaultTrip();
  await putState(seed);
  return seed;
}
