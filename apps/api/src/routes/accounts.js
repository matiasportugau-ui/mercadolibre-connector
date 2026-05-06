import { Hono } from 'hono';
import crypto from 'node:crypto';
import { authMiddleware, planMiddleware } from '../middleware/auth.js';
import { getPlan, isUnlimited } from '@ml-automator/automation-engine';
import { config } from '../config.js';

// Validate encryption key once at startup — fail fast if it's present but invalid.
let encryptionKey = null;
if (config.tokenEncryptionKey) {
  const keyBuf = Buffer.from(config.tokenEncryptionKey, 'hex');
  if (keyBuf.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  encryptionKey = keyBuf;
}

const encryptToken = (plaintext) => {
  if (!encryptionKey) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), tag: tag.toString('hex'), data: enc.toString('hex') });
};

export const accountsRouter = new Hono();
accountsRouter.use('*', authMiddleware, planMiddleware);

// List connected ML accounts
accountsRouter.get('/', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { data, error } = await userSupabase
    .from('ml_accounts')
    .select('id, ml_user_id, ml_nickname, country_site, is_active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, accounts: data });
});

// Disconnect an ML account
accountsRouter.delete('/:id', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { error } = await userSupabase
    .from('ml_accounts')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true });
});

// Store tokens after OAuth callback (called by connector redirect)
accountsRouter.post('/connect', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const profile = c.get('profile');
  const plan = getPlan(profile?.plan_id);

  if (!isUnlimited(plan.maxAccounts)) {
    const { count } = await userSupabase
      .from('ml_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (count >= plan.maxAccounts) {
      return c.json({ ok: false, error: 'plan_limit_reached', upgrade: true }, 403);
    }
  }

  const { ml_user_id, ml_nickname, access_token, refresh_token, expires_at, country_site } = await c.req.json();
  if (!ml_user_id || !access_token || !refresh_token) {
    return c.json({ ok: false, error: 'Missing required fields' }, 400);
  }

  const { data, error } = await userSupabase
    .from('ml_accounts')
    .upsert({
      user_id: user.id,
      ml_user_id,
      ml_nickname,
      access_token_enc: encryptToken(access_token),
      refresh_token_enc: encryptToken(refresh_token),
      expires_at,
      country_site: country_site ?? 'MLA',
      is_active: true,
    }, { onConflict: 'user_id,ml_user_id' })
    .select('id')
    .single();

  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, accountId: data.id });
});
