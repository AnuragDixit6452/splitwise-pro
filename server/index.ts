import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createSessionToken, getAppPin, verifySessionToken } from './auth.js';
import { getState, initDb, putState, resetAndSeed, type LedgerState } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const distPath = path.join(__dirname, '..', 'dist');
const indexHtml = path.join(distPath, 'index.html');

let dbReady = false;
let dbError: string | null = null;

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

function requireDb(_req: Request, res: Response, next: NextFunction): void {
  if (!dbReady) {
    res.status(503).json({ error: dbError || 'Database is still starting. Retry in a few seconds.' });
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

// Always 200 once the process is listening — required for Render health checks.
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    dbReady,
    dbError,
    hasDist: fs.existsSync(indexHtml),
  });
});

app.post('/api/auth/unlock', requireDb, (req, res) => {
  const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
  if (pin !== getAppPin()) {
    res.status(401).json({ error: 'Invalid PIN' });
    return;
  }
  const token = createSessionToken();
  res.json({ token, lastLoginAt: new Date().toISOString() });
});

app.get('/api/state', requireAuth, requireDb, async (_req, res) => {
  try {
    const state = await getState();
    res.json(state);
  } catch (err) {
    console.error('GET /api/state failed:', err);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

app.put('/api/state', requireAuth, requireDb, async (req, res) => {
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

app.post('/api/reset', requireAuth, requireDb, async (_req, res) => {
  try {
    const state = await resetAndSeed();
    res.json(state);
  } catch (err) {
    console.error('POST /api/reset failed:', err);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

if (fs.existsSync(distPath)) {
  app.use(
    '/assets',
    express.static(path.join(distPath, 'assets'), {
      index: false,
      fallthrough: false,
      setHeaders(res) {
        // Vite tags assets with crossorigin; allow same-origin CORS apply.
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
}

app.get('/', (_req, res) => {
  if (!fs.existsSync(indexHtml)) {
    res
      .status(500)
      .type('text')
      .send('Frontend build missing (dist/index.html). Check the Docker build logs.');
    return;
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(indexHtml);
});

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/assets/')) {
    next();
    return;
  }
  if (!fs.existsSync(indexHtml)) {
    res.status(404).type('text').send('Not Found');
    return;
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(indexHtml);
});

async function connectDbWithRetry(maxAttempts = 8): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Connecting to database (attempt ${attempt}/${maxAttempts})...`);
      await initDb();
      dbReady = true;
      dbError = null;
      console.log('Database ready.');
      return;
    } catch (err) {
      dbReady = false;
      dbError = err instanceof Error ? err.message : String(err);
      console.error(`Database init failed (attempt ${attempt}):`, dbError);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 10000)));
      }
    }
  }
  console.error('Database still unavailable after retries. API routes will return 503 until it recovers.');
}

async function main(): Promise<void> {
  console.log(`Starting Splitwise Pro on 0.0.0.0:${PORT}`);
  console.log(`dist path: ${distPath} (index exists: ${fs.existsSync(indexHtml)})`);
  console.log(`DATABASE_URL set: ${Boolean(process.env.DATABASE_URL)}`);

  // Bind to PORT immediately so Render health checks / routing succeed.
  await new Promise<void>((resolve) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Listening on http://0.0.0.0:${PORT}`);
      resolve();
    });
  });

  void connectDbWithRetry();
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
