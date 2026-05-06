import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/** Validates the Supabase JWT from Authorization header and attaches user to context. */
export const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'Missing authorization header' }, 401);
  }
  const token = authHeader.slice(7);

  // Use a per-request client with the user's token for RLS
  const userSupabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await userSupabase.auth.getUser(token);
  if (error || !user) {
    return c.json({ ok: false, error: 'Invalid or expired token' }, 401);
  }

  c.set('user', user);
  c.set('userSupabase', userSupabase);
  await next();
};

/** Checks plan limits for rules/accounts. Attaches profile to context. */
export const planMiddleware = async (c, next) => {
  const user = c.get('user');
  const userSupabase = c.get('userSupabase');

  const { data: profile } = await userSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  c.set('profile', profile);
  await next();
};
