import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { supabase } from '../supabase.js';
import { config } from '../config.js';

export const reportsRouter = new Hono();
reportsRouter.use('*', authMiddleware);

// GET /api/reports/summary?days=7|30
reportsRouter.get('/summary', async (c) => {
  const userId = c.get('userId');
  const days = Math.min(Number(c.req.query('days') ?? 7), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [sentRes, followUpRes, convertedRes] = await Promise.all([
    supabase
      .from('sent_leads')
      .select('id, source, rule_name, follow_up_status, sent_at', { count: 'exact' })
      .eq('user_id', userId)
      .gte('sent_at', since),
    supabase
      .from('sent_leads')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('follow_up_status', 'pending')
      .lte('follow_up_at', new Date().toISOString()),
    supabase
      .from('sent_leads')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('follow_up_status', 'converted')
      .gte('sent_at', since),
  ]);

  const leads = sentRes.data ?? [];
  const totalSent = sentRes.count ?? 0;
  const followUpsDue = followUpRes.count ?? 0;
  const converted = convertedRes.count ?? 0;

  // Rule usage breakdown
  const ruleCounts = leads.reduce((acc, l) => {
    const key = l.rule_name ?? 'Manual';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const topRule = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])[0];

  // Daily volume for sparkline (last `days` days)
  const dailyMap = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dailyMap[d] = 0;
  }
  for (const l of leads) {
    const d = l.sent_at.slice(0, 10);
    if (d in dailyMap) dailyMap[d]++;
  }
  const dailyVolume = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  return c.json({
    ok: true,
    period_days: days,
    total_sent: totalSent,
    follow_ups_due: followUpsDue,
    converted,
    conversion_rate: totalSent > 0 ? Math.round((converted / totalSent) * 100) : 0,
    top_rule: topRule ? { name: topRule[0], count: topRule[1] } : null,
    daily_volume: dailyVolume,
  });
});

// GET /api/reports/follow-ups?status=pending&limit=20
reportsRouter.get('/follow-ups', async (c) => {
  const userId = c.get('userId');
  const status = c.req.query('status') ?? 'pending';
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);

  const query = supabase
    .from('sent_leads')
    .select('id, question_id, question_text, item_id, item_title, buyer_id, quote_text, sent_at, follow_up_at, follow_up_status, source, rule_name, notes')
    .eq('user_id', userId)
    .order('follow_up_at', { ascending: true })
    .limit(limit);

  if (status === 'pending') {
    query.eq('follow_up_status', 'pending');
  } else if (status !== 'all') {
    query.eq('follow_up_status', status);
  }

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, follow_ups: data ?? [] });
});

// PATCH /api/reports/follow-ups/:id — update status or notes
reportsRouter.patch('/follow-ups/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { follow_up_status, notes } = await c.req.json();

  const allowed = ['pending', 'sent', 'skipped', 'converted'];
  if (follow_up_status && !allowed.includes(follow_up_status)) {
    return c.json({ error: 'invalid status' }, 400);
  }

  const update = {};
  if (follow_up_status) update.follow_up_status = follow_up_status;
  if (notes !== undefined) update.notes = notes;

  const { error } = await supabase
    .from('sent_leads')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// GET /api/reports/ai-analysis?days=30
// Generates an AI report using Claude based on recent sent_leads data.
reportsRouter.get('/ai-analysis', async (c) => {
  const userId = c.get('userId');
  const days = Math.min(Number(c.req.query('days') ?? 30), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  if (!config.anthropicApiKey) return c.json({ error: 'AI not configured' }, 503);

  const { data: leads } = await supabase
    .from('sent_leads')
    .select('question_text, item_title, quote_text, follow_up_status, source, rule_name, sent_at')
    .eq('user_id', userId)
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(50);

  if (!leads || leads.length === 0) {
    return c.json({ ok: true, analysis: 'No hay suficientes datos para generar un análisis. Envía algunas cotizaciones primero.' });
  }

  const converted = leads.filter(l => l.follow_up_status === 'converted').length;
  const manual = leads.filter(l => l.source === 'manual').length;
  const automated = leads.filter(l => l.source === 'auto').length;

  const sampleLeads = leads.slice(0, 15).map(l => ({
    pregunta: l.question_text ?? '(sin texto)',
    producto: l.item_title ?? '(sin título)',
    cotizacion: (l.quote_text ?? '').slice(0, 120),
    estado: l.follow_up_status,
  }));

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `Eres un analista de ventas para vendedores de Mercado Libre.
Analiza los datos de leads y cotizaciones enviadas y genera:
1. Un resumen de patrones detectados (máx 3 puntos)
2. Análisis de oportunidades de mejora (máx 2 puntos)
3. Acciones concretas sugeridas (máx 3 acciones numeradas)
Responde en español, sé específico y accionable. Formato: usa secciones con títulos en negrita.`,
    messages: [{
      role: 'user',
      content: `Período analizado: últimos ${days} días
Total cotizaciones enviadas: ${leads.length}
Manuales: ${manual} | Automáticas: ${automated}
Convertidas a orden: ${converted} (${leads.length > 0 ? Math.round(converted/leads.length*100) : 0}%)

Muestra de leads recientes:
${JSON.stringify(sampleLeads, null, 2)}

Genera el análisis de ventas.`,
    }],
  });

  const analysis = message.content[0]?.type === 'text' ? message.content[0].text : '';
  return c.json({ ok: true, analysis, leads_analyzed: leads.length, period_days: days });
});
