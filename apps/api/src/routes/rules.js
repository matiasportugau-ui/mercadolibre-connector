import { Hono } from 'hono';
import { authMiddleware, planMiddleware } from '../middleware/auth.js';
import { getPlan, isUnlimited } from '@ml-automator/automation-engine';

export const rulesRouter = new Hono();
rulesRouter.use('*', authMiddleware, planMiddleware);

rulesRouter.get('/', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { data, error } = await userSupabase
    .from('automation_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: true });
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, rules: data });
});

rulesRouter.post('/', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const profile = c.get('profile');
  const plan = getPlan(profile?.plan_id);

  if (!isUnlimited(plan.maxRules)) {
    const { count } = await userSupabase
      .from('automation_rules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (count >= plan.maxRules) {
      return c.json({ ok: false, error: 'plan_limit_reached', upgrade: true, limit: plan.maxRules }, 403);
    }
  }

  const body = await c.req.json();
  const { name, ml_account_id, conditions, condition_mode, action, priority } = body;
  if (!name || !action?.templateId) {
    return c.json({ ok: false, error: 'name and action.templateId are required' }, 400);
  }

  const { data, error } = await userSupabase
    .from('automation_rules')
    .insert({ user_id: user.id, name, ml_account_id, conditions: conditions ?? [], condition_mode: condition_mode ?? 'any', action, priority: priority ?? 100 })
    .select()
    .single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, rule: data }, 201);
});

rulesRouter.put('/:id', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const body = await c.req.json();
  const { name, conditions, condition_mode, action, priority, enabled, ml_account_id } = body;

  const { data, error } = await userSupabase
    .from('automation_rules')
    .update({ name, conditions, condition_mode, action, priority, enabled, ml_account_id })
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, rule: data });
});

rulesRouter.patch('/:id/toggle', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { enabled } = await c.req.json();
  const { data, error } = await userSupabase
    .from('automation_rules')
    .update({ enabled })
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
    .select('id, enabled')
    .single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, rule: data });
});

rulesRouter.delete('/:id', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { error } = await userSupabase
    .from('automation_rules')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true });
});
