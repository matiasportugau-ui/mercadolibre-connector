'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, Zap } from 'lucide-react';
import { cn, API_URL } from '@/lib/utils';

const PLANS = [
  { id: 'free', label: 'Free', price: '$0', period: '/mes', questions: '50 preguntas', rules: '3 reglas', accounts: '1 cuenta', features: ['Respuestas automáticas', 'Plantillas de texto'] },
  { id: 'starter', label: 'Starter', price: '$9.99', period: '/mes', questions: '500 preguntas', rules: '10 reglas', accounts: '1 cuenta', features: ['Todo del Free', 'Analíticas básicas'], popular: false },
  { id: 'pro', label: 'Pro', price: '$29.99', period: '/mes', questions: '5,000 preguntas', rules: '50 reglas', accounts: '3 cuentas', features: ['Todo del Starter', 'Sugerencias con IA', 'Soporte prioritario'], popular: true },
  { id: 'enterprise', label: 'Enterprise', price: '$99.99', period: '/mes', questions: 'Ilimitadas', rules: 'Ilimitadas', accounts: '10 cuentas', features: ['Todo del Pro', 'White-label', 'Webhooks personalizados'] },
];

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [provider, setProvider] = useState<'mp' | 'stripe'>('mp');

  useEffect(() => {
    createClient().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const supabase = createClient();
      const { data } = await supabase.from('profiles').select('plan_id').eq('id', session.user.id).single();
      setCurrentPlan(data?.plan_id ?? 'free');
      setLoading(false);
    });
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free' || planId === currentPlan) return;
    setSubscribing(planId);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const endpoint = provider === 'mp' ? '/api/billing/subscribe/mercadopago' : '/api/billing/subscribe/stripe';
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, payer_email: session.user.email }),
    });
    const data = await res.json();
    if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    setSubscribing(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Plan & Facturación</h1>
        <p className="text-gray-500 text-sm mt-1">
          Plan actual: <span className="font-semibold text-gray-900 capitalize">{currentPlan}</span>
        </p>
      </div>

      {/* Payment method toggle */}
      <div className="mb-8 flex items-center gap-3">
        <span className="text-sm text-gray-600">Pagar con:</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setProvider('mp')} className={cn('px-4 py-1.5 text-sm font-medium transition', provider === 'mp' ? 'bg-ml-blue text-white' : 'text-gray-600 hover:bg-gray-50')}>
            MercadoPago
          </button>
          <button onClick={() => setProvider('stripe')} className={cn('px-4 py-1.5 text-sm font-medium transition', provider === 'stripe' ? 'bg-ml-blue text-white' : 'text-gray-600 hover:bg-gray-50')}>
            Tarjeta / Stripe
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isPopular = plan.popular;
          return (
            <div key={plan.id} className={cn(
              'bg-white rounded-2xl border p-6 flex flex-col relative',
              isPopular ? 'border-ml-blue shadow-lg shadow-ml-blue/10' : 'border-gray-200',
            )}>
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ml-blue text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Más popular
                </div>
              )}
              <div className="mb-5">
                <p className="font-bold text-gray-900">{plan.label}</p>
                <p className="text-3xl font-black text-gray-900 mt-1">{plan.price}<span className="text-sm font-normal text-gray-500">{plan.period}</span></p>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600 flex-1 mb-6">
                <li className="font-medium text-gray-800">{plan.questions} · {plan.rules} · {plan.accounts}</li>
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-500 shrink-0" />{f}</li>
                ))}
              </ul>
              <button
                disabled={isCurrent || plan.id === 'free' || subscribing === plan.id || loading}
                onClick={() => handleSubscribe(plan.id)}
                className={cn(
                  'w-full py-2.5 rounded-xl text-sm font-semibold transition',
                  isCurrent
                    ? 'bg-gray-100 text-gray-400 cursor-default'
                    : isPopular
                    ? 'bg-ml-blue text-white hover:bg-blue-600'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                )}
              >
                {isCurrent ? 'Plan actual' : subscribing === plan.id ? 'Procesando...' : plan.id === 'free' ? 'Gratuito' : 'Elegir plan'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
