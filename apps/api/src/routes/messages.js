import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { supabase } from '../supabase.js';
import crypto from 'node:crypto';
import { config } from '../config.js';

export const messagesRouter = new Hono();
messagesRouter.use('*', authMiddleware);

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

const getAccountToken = async (accountId, userId) => {
  const { data: acc } = await supabase
    .from('ml_accounts')
    .select('id, ml_user_id, access_token_enc')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();
  if (!acc) return null;
  return { ...acc, accessToken: decryptToken(acc.access_token_enc) };
};

// GET /api/messages?account_id=&limit=20&offset=0
messagesRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('account_id');
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
  const offset = Number(c.req.query('offset') ?? 0);

  let query = supabase
    .from('ml_messages')
    .select('id, pack_id, message_id, from_user_id, from_role, text, status, auto_replied, created_at, ml_account_id')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

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
  return c.json({ data: data ?? [] });
});

// POST /api/messages/:pack_id/reply
// Body: { account_id, seller_id, text }
messagesRouter.post('/:pack_id/reply', async (c) => {
  const userId = c.get('userId');
  const packId = c.req.param('pack_id');
  const { account_id, seller_id, text } = await c.req.json();

  if (!account_id || !seller_id || !text?.trim()) {
    return c.json({ error: 'account_id, seller_id and text are required' }, 400);
  }

  const acc = await getAccountToken(account_id, userId);
  if (!acc) return c.json({ error: 'account_not_found' }, 404);

  const res = await fetch(
    `https://api.mercadolibre.com/messages/packs/${packId}/sellers/${seller_id}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${acc.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.trim() }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    return c.json({ error: `ML API error ${res.status}`, detail: body }, res.status);
  }

  const result = await res.json();
  return c.json({ ok: true, message: result });
});
