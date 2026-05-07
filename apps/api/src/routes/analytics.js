import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { supabase } from '../supabase.js';

export const analyticsRouter = new Hono();
analyticsRouter.use('*', authMiddleware);

// GET /api/analytics/reputation?account_id=&days=30
analyticsRouter.get('/reputation', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('account_id');
  const days = Math.min(Number(c.req.query('days') ?? 30), 365);

  // Validate account belongs to user
  if (accountId) {
    const { data: acc } = await supabase.from('ml_accounts').select('id').eq('id', accountId).eq('user_id', userId).single();
    if (!acc) return c.json({ error: 'account_not_found' }, 404);
  }

  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  let query = supabase
    .from('ml_seller_metrics')
    .select('snapshot_date, level, power_seller_status, total_sales, completed_sales, canceled_sales, delayed_shipments, claims')
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  if (accountId) {
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

// GET /api/analytics/orders?account_id=&days=30
analyticsRouter.get('/orders', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('account_id');
  const days = Math.min(Number(c.req.query('days') ?? 30), 365);

  const since = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from('ml_orders')
    .select('ml_order_id, status, total_amount, currency_id, date_created, buyer_nickname, items')
    .gte('date_created', since)
    .order('date_created', { ascending: false });

  if (accountId) {
    const { data: acc } = await supabase.from('ml_accounts').select('id').eq('id', accountId).eq('user_id', userId).single();
    if (!acc) return c.json({ error: 'account_not_found' }, 404);
    query = query.eq('ml_account_id', accountId);
  } else {
    const { data: accounts } = await supabase.from('ml_accounts').select('id').eq('user_id', userId);
    const ids = accounts?.map((a) => a.id) ?? [];
    if (ids.length === 0) return c.json({ data: [], summary: { total: 0, revenue: 0, count: 0 } });
    query = query.in('ml_account_id', ids);
  }

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const confirmed = (data ?? []).filter((o) => o.status === 'confirmed' || o.status === 'payment_done');
  const revenue = confirmed.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

  return c.json({
    data: data ?? [],
    summary: { total: (data ?? []).length, confirmed: confirmed.length, revenue },
  });
});

// GET /api/analytics/items?account_id=
analyticsRouter.get('/items', async (c) => {
  const userId = c.get('userId');
  const accountId = c.req.query('account_id');

  let query = supabase
    .from('ml_item_metrics')
    .select('ml_item_id, title, status, available_quantity, visits, snapshot_date')
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

  // Get latest snapshot per item by limiting date range (last 2 days)
  const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  query = query.gte('snapshot_date', since);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  // Deduplicate: keep latest snapshot per item
  const seen = new Set();
  const deduped = (data ?? []).filter((row) => {
    if (seen.has(row.ml_item_id)) return false;
    seen.add(row.ml_item_id);
    return true;
  });

  return c.json({ data: deduped });
});
