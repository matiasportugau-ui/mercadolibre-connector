import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { PLANS } from '@ml-automator/automation-engine';
import { supabase } from '../supabase.js';
import { config } from '../config.js';

export const billingRouter = new Hono();
billingRouter.use('*', authMiddleware);

billingRouter.get('/plans', (c) =>
  c.json({
    ok: true,
    plans: Object.entries(PLANS).map(([id, plan]) => ({ id, ...plan })),
  })
);

// Create a MercadoPago subscription
billingRouter.post('/subscribe/mercadopago', async (c) => {
  const user = c.get('user');
  const { plan_id, payer_email } = await c.req.json();
  if (!PLANS[plan_id] || plan_id === 'free') {
    return c.json({ ok: false, error: 'Invalid plan' }, 400);
  }

  const plan = PLANS[plan_id];
  const mpPayload = {
    reason: `ML Automator — Plan ${plan.label}`,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: plan.priceUsd,
      currency_id: 'USD',
    },
    payer_email,
    back_url: `${c.req.header('origin') ?? 'http://localhost:3000'}/dashboard/billing?success=1`,
    metadata: { user_id: user.id, plan_id },
  };

  const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mpAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mpPayload),
  });

  if (!mpRes.ok) {
    const err = await mpRes.json().catch(() => ({}));
    return c.json({ ok: false, error: 'MercadoPago error', details: err }, 500);
  }

  const mp = await mpRes.json();
  return c.json({ ok: true, checkoutUrl: mp.init_point, subscriptionId: mp.id });
});

// Create a Stripe checkout session
billingRouter.post('/subscribe/stripe', async (c) => {
  const user = c.get('user');
  const { plan_id, success_url, cancel_url } = await c.req.json();
  if (!PLANS[plan_id] || plan_id === 'free') {
    return c.json({ ok: false, error: 'Invalid plan' }, 400);
  }

  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(config.stripeSecretKey);
  const plan = PLANS[plan_id];

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, full_name')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: profile?.full_name ?? '' });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(plan.priceUsd * 100),
        recurring: { interval: 'month' },
        product_data: { name: `ML Automator — ${plan.label}` },
      },
      quantity: 1,
    }],
    subscription_data: { metadata: { plan_id, user_id: user.id } },
    success_url: success_url ?? `${c.req.header('origin')}/dashboard/billing?success=1`,
    cancel_url: cancel_url ?? `${c.req.header('origin')}/dashboard/billing`,
  });

  return c.json({ ok: true, checkoutUrl: session.url });
});

// Cancel subscription
billingRouter.post('/cancel', async (c) => {
  const user = c.get('user');
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_id, stripe_customer_id, mp_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.subscription_id) {
    return c.json({ ok: false, error: 'No active subscription' }, 400);
  }

  if (profile.stripe_customer_id) {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(config.stripeSecretKey);
    await stripe.subscriptions.cancel(profile.subscription_id);
  } else if (config.mpAccessToken) {
    await fetch(`https://api.mercadopago.com/preapproval/${profile.subscription_id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${config.mpAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
  }

  await supabase.from('profiles').update({ plan_id: 'free', subscription_status: 'canceled' }).eq('id', user.id);
  return c.json({ ok: true });
});
