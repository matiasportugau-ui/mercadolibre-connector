import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/** Validates the Supabase JWT from Authorization header and attaches user to context. */
export const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'Missing authorization header' }, 401);
  }
  const token = authHeader.slice(7);

  // Verify the token using the service-role client (auth.getUser is safe here)
  const adminSupabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) {
    return c.json({ ok: false, error: 'Invalid or expired token' }, 401);
  }

  // Per-request client uses the anon key + user JWT so RLS is enforced
  const userSupabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  // Fetch plan_id so feature gates work without a second round-trip
  const adminSb = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  });
  const { data: profile } = await adminSb.from('profiles').select('plan_id').eq('id', user.id).single();

  c.set('user', user);
  c.set('userId', user.id);
  c.set('planId', profile?.plan_id ?? 'free');
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
