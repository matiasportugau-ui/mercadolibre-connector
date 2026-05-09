import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { supabase } from '../supabase.js';
import { getPlan } from '@ml-automator/automation-engine';
import { config } from '../config.js';
import crypto from 'node:crypto';

export const itemsRouter = new Hono();
itemsRouter.use('*', authMiddleware);

const decryptToken = (encryptedJson) => {
  if (!config.tokenEncryptionKey) return encryptedJson;
  try {
    const { iv, tag, data } = JSON.parse(encryptedJson);
    const key = Buffer.from(config.tokenEncryptionKey, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return encryptedJson;
  }
};

// GET /api/items?account_id=
itemsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('account_id');

  const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  let query = supabase
    .from('ml_item_metrics')
    .select('ml_item_id, title, status, available_quantity, visits, snapshot_date')
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: false });

  if (accountId) {
    const { data: acc } = await supabase.from('ml_accounts').select('id').eq('id', accountId).eq('user_id', userId).single();
    if (!acc) return c.json({ error: 'account_not_found' }, 404);
    query = query.eq('ml_account_id', accountId);
  } else {
    const { data: accounts } = await supabase.from('ml_accounts').select('id').eq('user_id', userId);
    const ids = accounts?.map((a) => a.id) ?? [];
    if (ids.length === 0) return c.json({ data: [] });
    query = query.in('ml_account_id', ids);
  }

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  // Deduplicate: keep latest snapshot per item
  const seen = new Set();
  const deduped = (data ?? []).filter((row) => {
    if (seen.has(row.ml_item_id)) return false;
    seen.add(row.ml_item_id);
    return true;
  });

  // Add health flags
  const enriched = deduped.map((item) => ({
    ...item,
    alerts: [
      item.available_quantity === 0 && 'sin_stock',
      item.status !== 'active' && item.status && `estado_${item.status}`,
    ].filter(Boolean),
  }));

  return c.json({ data: enriched });
});

// GET /api/items/:ml_item_id/suggest-reply?question=...&account_id=
// Pro/Enterprise gate: generates an AI reply suggestion using Claude
itemsRouter.get('/:ml_item_id/suggest-reply', async (c) => {
  const userId = c.get('userId');
  const userPlanId = c.get('planId') ?? 'free';
  const plan = getPlan(userPlanId);

  if (!plan.features?.includes('ai_suggestions')) {
    return c.json({ error: 'plan_limit_reached', upgrade: true }, 403);
  }

  const mlItemId = c.req.param('ml_item_id');
  const question = c.req.query('question') ?? '';
  const accountId = c.req.query('account_id');

  if (!question.trim()) return c.json({ error: 'question is required' }, 400);
  if (!accountId) return c.json({ error: 'account_id is required' }, 400);

  const { data: acc } = await supabase
    .from('ml_accounts')
    .select('id, access_token_enc')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();
  if (!acc) return c.json({ error: 'account_not_found' }, 404);

  const token = decryptToken(acc.access_token_enc);
  let itemTitle = mlItemId;
  let itemDescription = '';

  const itemRes = await fetch(`https://api.mercadolibre.com/items/${mlItemId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (itemRes.ok) {
    const item = await itemRes.json();
    itemTitle = item.title ?? mlItemId;
    itemDescription = `Precio: ${item.price} ${item.currency_id}. Condición: ${item.condition}. Stock: ${item.available_quantity}.`;
  }

  if (!config.anthropicApiKey) {
    return c.json({ error: 'AI suggestions not configured' }, 503);
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: 'Eres un asistente de ventas en Mercado Libre. Responde preguntas de compradores de forma amable, concisa y profesional. Responde siempre en el idioma de la pregunta.',
    messages: [
      {
        role: 'user',
        content: `Producto: "${itemTitle}"\n${itemDescription}\n\nPregunta del comprador: "${question}"\n\nGenera una respuesta breve y útil para esta pregunta.`,
      },
    ],
  });

  const suggestion = message.content[0]?.type === 'text' ? message.content[0].text : '';
  return c.json({ suggestion });
});
