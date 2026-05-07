import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { supabase } from '../supabase.js';
import { getPlan } from '@ml-automator/automation-engine';
import { config } from '../config.js';
import crypto from 'node:crypto';

export const questionsRouter = new Hono();
questionsRouter.use('*', authMiddleware);

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

const getAccount = async (accountId, userId) => {
  const { data } = await supabase
    .from('ml_accounts')
    .select('id, ml_user_id, access_token_enc')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();
  if (!data) return null;
  return { ...data, accessToken: decryptToken(data.access_token_enc) };
};

// GET /api/questions?account_id=&status=UNANSWERED&limit=20&offset=0
// Fetches questions from ML API for the given account
questionsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('account_id');
  const status = c.req.query('status') ?? 'UNANSWERED';
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
  const offset = Number(c.req.query('offset') ?? 0);

  if (!accountId) return c.json({ error: 'account_id is required' }, 400);

  const acc = await getAccount(accountId, userId);
  if (!acc) return c.json({ error: 'account_not_found' }, 404);

  const url = new URL('https://api.mercadolibre.com/questions/search');
  url.searchParams.set('seller_id', acc.ml_user_id);
  url.searchParams.set('status', status);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('sort_fields', 'date_created');
  url.searchParams.set('sort_types', 'DESC');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${acc.accessToken}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    return c.json({ error: `ML API error ${res.status}`, detail: body }, res.status);
  }

  const data = await res.json();
  return c.json({ ok: true, questions: data.questions ?? [], total: data.total ?? 0 });
});

// GET /api/questions/:id/suggest
// Generate an AI reply suggestion for a question (Pro gate)
questionsRouter.get('/:id/suggest', async (c) => {
  const userId = c.get('userId');
  const userPlanId = c.get('planId') ?? 'free';
  const plan = getPlan(userPlanId);

  if (!plan.features?.includes('ai_suggestions')) {
    return c.json({ error: 'plan_limit_reached', upgrade: true }, 403);
  }

  const questionId = c.req.param('id');
  const accountId = c.req.query('account_id');
  if (!accountId) return c.json({ error: 'account_id is required' }, 400);

  const acc = await getAccount(accountId, userId);
  if (!acc) return c.json({ error: 'account_not_found' }, 404);

  // Fetch the question
  const qRes = await fetch(`https://api.mercadolibre.com/questions/${questionId}`, {
    headers: { Authorization: `Bearer ${acc.accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!qRes.ok) return c.json({ error: 'question_fetch_error' }, 502);
  const question = await qRes.json();

  // Fetch item info for context
  let itemTitle = '';
  let itemDescription = '';
  if (question.item_id) {
    const iRes = await fetch(`https://api.mercadolibre.com/items/${question.item_id}`, {
      headers: { Authorization: `Bearer ${acc.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (iRes.ok) {
      const item = await iRes.json();
      itemTitle = item.title ?? '';
      itemDescription = `Precio: ${item.price} ${item.currency_id}. Condición: ${item.condition}. Stock disponible: ${item.available_quantity}.`;
    }
  }

  if (!config.anthropicApiKey) return c.json({ error: 'AI not configured' }, 503);

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: 'Eres un asistente de ventas en Mercado Libre. Responde las preguntas de compradores de forma amable, clara, concisa y profesional. Incluye información de precios o disponibilidad si es relevante. Responde siempre en el idioma de la pregunta.',
    messages: [
      {
        role: 'user',
        content: `Producto: "${itemTitle}"\n${itemDescription}\n\nPregunta del comprador: "${question.text}"\n\nGenera una respuesta breve, útil y vendedora para esta pregunta.`,
      },
    ],
  });

  const suggestion = message.content[0]?.type === 'text' ? message.content[0].text : '';
  return c.json({ ok: true, suggestion, question_text: question.text, item_title: itemTitle });
});

// POST /api/questions/:id/answer
// Send a reply to a question via the ML API
questionsRouter.post('/:id/answer', async (c) => {
  const userId = c.get('userId');
  const questionId = c.req.param('id');
  const { account_id, text } = await c.req.json();

  if (!account_id || !text?.trim()) {
    return c.json({ error: 'account_id and text are required' }, 400);
  }

  const acc = await getAccount(account_id, userId);
  if (!acc) return c.json({ error: 'account_not_found' }, 404);

  const res = await fetch('https://api.mercadolibre.com/answers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${acc.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question_id: Number(questionId), text: text.trim() }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text();
    return c.json({ error: `ML API error ${res.status}`, detail: body }, res.status);
  }

  const result = await res.json();

  // Log to auto_reply_log with status 'sent' (manual reply)
  await supabase.from('auto_reply_log').insert({
    ml_account_id: acc.id,
    question_id: Number(questionId),
    answer_text: text.trim(),
    status: 'sent',
  });

  return c.json({ ok: true, answer: result });
});
