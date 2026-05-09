import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config.js';
import { accountsRouter } from './routes/accounts.js';
import { rulesRouter } from './routes/rules.js';
import { templatesRouter } from './routes/templates.js';
import { webhooksRouter } from './routes/webhooks.js';
import { billingRouter } from './routes/billing.js';
import { analyticsRouter } from './routes/analytics.js';
import { messagesRouter } from './routes/messages.js';
import { itemsRouter } from './routes/items.js';
import { questionsRouter } from './routes/questions.js';
import { reportsRouter } from './routes/reports.js';
import { runReputationSnapshot } from './jobs/snapshotReputation.js';
import { runItemsSnapshot } from './jobs/snapshotItems.js';

const app = new Hono();

app.use('*', logger());
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use('/api/*', cors({
  origin: (origin) => allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  allowHeaders: ['Authorization', 'Content-Type'],
}));

app.get('/health', (c) => c.json({ ok: true, service: 'ml-automator-api', env: config.appEnv }));

app.route('/api/accounts', accountsRouter);
app.route('/api/rules', rulesRouter);
app.route('/api/templates', templatesRouter);
app.route('/api/billing', billingRouter);
app.route('/api/questions', questionsRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/messages', messagesRouter);
app.route('/api/items', itemsRouter);
app.route('/api/reports', reportsRouter);
app.route('/webhooks', webhooksRouter);

// Cron job endpoints — protected by CRON_SECRET
const verifyCron = (c) => {
  const auth = c.req.header('Authorization') ?? '';
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  return null;
};

app.get('/api/jobs/snapshot-reputation', async (c) => {
  const denied = verifyCron(c);
  if (denied) return denied;
  const results = await runReputationSnapshot();
  return c.json({ ok: true, results });
});

app.get('/api/jobs/snapshot-items', async (c) => {
  const denied = verifyCron(c);
  if (denied) return denied;
  const results = await runItemsSnapshot();
  return c.json({ ok: true, results });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ ok: false, error: err.message }, err.status ?? 500);
});

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`ML Automator API running on port ${config.port} [${config.appEnv}]`);
});
