import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

export const templatesRouter = new Hono();
templatesRouter.use('*', authMiddleware);

templatesRouter.get('/', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { data, error } = await userSupabase
    .from('reply_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, templates: data });
});

templatesRouter.post('/', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { name, content } = await c.req.json();
  if (!name || !content) return c.json({ ok: false, error: 'name and content are required' }, 400);
  const { data, error } = await userSupabase
    .from('reply_templates')
    .insert({ user_id: user.id, name, content })
    .select()
    .single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, template: data }, 201);
});

templatesRouter.put('/:id', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { name, content } = await c.req.json();
  const { data, error } = await userSupabase
    .from('reply_templates')
    .update({ name, content })
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true, template: data });
});

templatesRouter.delete('/:id', async (c) => {
  const userSupabase = c.get('userSupabase');
  const user = c.get('user');
  const { error } = await userSupabase
    .from('reply_templates')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id);
  if (error) return c.json({ ok: false, error: error.message }, 500);
  return c.json({ ok: true });
});
