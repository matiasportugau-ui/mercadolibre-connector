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
app.route('/webhooks', webhooksRouter);

app.onError((err, c) => {
  console.error(err);
  return c.json({ ok: false, error: err.message }, err.status ?? 500);
});

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`ML Automator API running on port ${config.port} [${config.appEnv}]`);
});
