import { Hono } from 'hono';
import crypto from 'node:crypto';
import { createAutomationEngine } from '@ml-automator/automation-engine';
import { supabase } from '../supabase.js';
import { config } from '../config.js';

export const webhooksRouter = new Hono();

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

/** Build an authed ML API fetch for a given account */
const buildMlApiFetch = (accessToken) => (path, options = {}) =>
  fetch(`https://api.mercadolibre.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });

// MercadoLibre webhooks
webhooksRouter.post('/ml', async (c) => {
  const body = await c.req.json();
  const topic = c.req.header('x-topic') ?? body.topic ?? '';
  const resource = body.resource ?? '';

  // Find the ML account this webhook belongs to
  const mlUserId = String(body.user_id ?? '');
  const { data: account } = await supabase
    .from('ml_accounts')
    .select('id, user_id, access_token_enc')
    .eq('ml_user_id', mlUserId)
    .eq('is_active', true)
    .single();

  // Persist event
  const { data: event } = await supabase
    .from('webhook_events')
    .insert({ ml_account_id: account?.id ?? null, topic, resource, raw_body: body })
    .select('id')
    .single();

  if (!account) return c.json({ ok: true, eventId: event?.id, note: 'account_not_found' });

  // Fire-and-forget automation processing
  const accessToken = decryptToken(account.access_token_enc);
  const engine = createAutomationEngine({ supabase });

  engine
    .processWebhookEvent({
      eventId: event.id,
      topic,
      resource,
      mlAccountId: account.id,
      userId: account.user_id,
      mlApiFetch: buildMlApiFetch(accessToken),
    })
    .catch((err) => console.error('Automation engine error:', err));

  return c.json({ ok: true, eventId: event?.id });
});

// MercadoPago billing webhooks
webhooksRouter.post('/mercadopago', async (c) => {
  const body = await c.req.json();
  const { type, data } = body;

  if (type === 'payment') {
    // Payment confirmed — look up subscription and activate plan
    const paymentId = data?.id;
    if (paymentId && config.mpAccessToken) {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${config.mpAccessToken}` },
      });
      if (res.ok) {
        const payment = await res.json();
        const subscriptionId = payment.metadata?.subscription_id;
        const planId = payment.metadata?.plan_id;
        const userId = payment.metadata?.user_id;
        if (subscriptionId && planId && userId) {
          await supabase
            .from('profiles')
            .update({ plan_id: planId, subscription_id: subscriptionId, subscription_status: 'active' })
            .eq('id', userId);
        }
      }
    }
  }

  return c.json({ ok: true });
});

// Stripe billing webhooks
webhooksRouter.post('/stripe', async (c) => {
  const rawBody = await c.req.text();
  const sig = c.req.header('stripe-signature');

  // Stripe signature verification happens in the main app before this route
  let event;
  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(config.stripeSecretKey);
    event = stripe.webhooks.constructEvent(rawBody, sig, config.stripeWebhookSecret);
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 400);
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const sub = event.data.object;
    const planId = sub.metadata?.plan_id ?? 'free';
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', sub.customer)
      .single();
    if (profile) {
      await supabase
        .from('profiles')
        .update({ plan_id: planId, subscription_id: sub.id, subscription_status: sub.status })
        .eq('id', profile.id);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', sub.customer)
      .single();
    if (profile) {
      await supabase
        .from('profiles')
        .update({ plan_id: 'free', subscription_status: 'canceled' })
        .eq('id', profile.id);
    }
  }

  return c.json({ ok: true });
});
