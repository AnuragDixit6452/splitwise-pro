import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createSessionToken, getAppPin, verifySessionToken } from './auth.js';
import { getState, initDb, putState, resetAndSeed, type LedgerState } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: '5mb' }));

function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7);
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!verifySessionToken(getBearerToken(req))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function isLedgerState(body: unknown): body is LedgerState {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.groups) &&
    Array.isArray(b.members) &&
    Array.isArray(b.expenses) &&
    typeof b.activeGroupId === 'string'
  );
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/unlock', (req, res) => {
  const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
  if (pin !== getAppPin()) {
    res.status(401).json({ error: 'Invalid PIN' });
    return;
  }
  const token = createSessionToken();
  res.json({ token, lastLoginAt: new Date().toISOString() });
});

app.get('/api/state', requireAuth, async (_req, res) => {
  try {
    const state = await getState();
    res.json(state);
  } catch (err) {
    console.error('GET /api/state failed:', err);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

app.put('/api/state', requireAuth, async (req, res) => {
  if (!isLedgerState(req.body)) {
    res.status(400).json({ error: 'Invalid ledger payload' });
    return;
  }
  try {
    await putState(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/state failed:', err);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

app.post('/api/reset', requireAuth, async (_req, res) => {
  try {
    const state = await resetAndSeed();
    res.json(state);
  } catch (err) {
    console.error('POST /api/reset failed:', err);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) {
    next();
    return;
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

async function main(): Promise<void> {
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Splitwise Pro listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
