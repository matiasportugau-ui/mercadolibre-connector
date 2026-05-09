import Link from 'next/link';
import { Check, Zap, MessageSquare, BarChart2, Store, Shield, ShoppingBag, MessageCircle, TrendingUp, Sparkles } from 'lucide-react';

const PLANS = [
  {
    id: 'free', label: 'Free', price: '$0', period: '/mes', questions: '50', rules: '3', accounts: '1',
    extras: [], cta: 'Empezar gratis', href: '/login', highlight: false,
  },
  {
    id: 'starter', label: 'Starter', price: '$9.99', period: '/mes', questions: '500', rules: '10', accounts: '1',
    extras: ['Mensajes post-venta', 'Órdenes (30 días)', 'Reputación (30 días)', 'Salud de publicaciones'],
    cta: 'Comenzar', href: '/login?plan=starter', highlight: false,
  },
  {
    id: 'pro', label: 'Pro', price: '$29.99', period: '/mes', questions: '5,000', rules: '50', accounts: '3',
    extras: ['Todo Starter', 'Historial 90 días', 'Reputación 1 año', 'Sugerencias con IA'],
    cta: 'Elegir Pro', href: '/login?plan=pro', highlight: true,
  },
  {
    id: 'enterprise', label: 'Enterprise', price: '$99.99', period: '/mes', questions: 'Ilimitadas', rules: 'Ilimitadas', accounts: '10',
    extras: ['Todo Pro', 'Datos ilimitados', 'White-label', 'Webhooks personalizados'],
    cta: 'Contactar', href: 'mailto:hola@mlautomator.com', highlight: false,
  },
];

const FEATURES = [
  { icon: Zap, title: 'Respuestas automáticas', desc: 'Configura reglas basadas en palabras clave, categorías o artículos específicos y responde preguntas al instante, 24/7.' },
  { icon: MessageCircle, title: 'Mensajes post-venta', desc: 'Gestiona los mensajes de compradores después de la compra desde un único panel centralizado.' },
  { icon: ShoppingBag, title: 'Inteligencia de órdenes', desc: 'Dashboard de ingresos, ventas confirmadas y valor promedio de orden con hasta 90 días de historial.' },
  { icon: TrendingUp, title: 'Reputación del vendedor', desc: 'Seguimiento histórico de tu nivel MercadoLíder, tasa de cancelaciones y demoras para detectar tendencias.' },
  { icon: BarChart2, title: 'Salud de publicaciones', desc: 'Alertas automáticas cuando una publicación se queda sin stock, es pausada o recibe menos visitas.' },
  { icon: Sparkles, title: 'Sugerencias con IA', desc: 'Claude sugiere respuestas personalizadas basadas en la descripción del artículo y la pregunta del comprador.' },
  { icon: Store, title: 'Multi-cuenta', desc: 'Gestiona múltiples tiendas de Mercado Libre — Argentina, Brasil, México, Colombia y más — desde un panel.' },
  { icon: Shield, title: 'Seguro y confiable', desc: 'Tokens cifrados con AES-256-GCM. Reintentos automáticos con backoff exponencial. 99.9% uptime.' },
  { icon: MessageSquare, title: 'Plantillas dinámicas', desc: 'Variables como {{buyer_name}} e {{item_title}} para respuestas naturales y personalizadas a escala.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <span className="flex items-center gap-2 font-black text-gray-900 text-lg">
          <span className="bg-ml-yellow w-8 h-8 rounded-lg flex items-center justify-center text-sm">ML</span>
          Automator
        </span>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <a href="#features" className="hover:text-gray-900 transition">Funciones</a>
          <a href="#pricing" className="hover:text-gray-900 transition">Precios</a>
          <Link href="/login" className="bg-ml-blue text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-600 transition">Iniciar sesión</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center px-6 pt-24 pb-20">
        <span className="inline-block bg-ml-yellow/20 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          Para vendedores de Mercado Libre en LATAM
        </span>
        <h1 className="text-5xl font-black text-gray-900 leading-tight mb-6">
          Automatiza tus respuestas<br />
          <span className="text-ml-blue">en segundos</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Configura reglas inteligentes, responde preguntas 24/7 y nunca pierdas una venta por falta de atención.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/login" className="bg-ml-blue text-white font-bold px-8 py-3.5 rounded-xl hover:bg-blue-600 transition text-lg">
            Empezar gratis
          </Link>
          <a href="#pricing" className="text-gray-600 font-semibold px-6 py-3.5 rounded-xl border border-gray-300 hover:bg-gray-50 transition">
            Ver planes
          </a>
        </div>
        <p className="text-sm text-gray-400 mt-5">No se requiere tarjeta de crédito · Plan gratuito disponible</p>
      </section>

      {/* Social proof strip */}
      <div className="bg-gray-50 border-y border-gray-100 py-5">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-x-12 gap-y-3 text-sm text-gray-500 text-center px-6">
          <span><strong className="text-gray-900">+500</strong> vendedores activos</span>
          <span><strong className="text-gray-900">+2M</strong> respuestas enviadas</span>
          <span><strong className="text-gray-900">99.9%</strong> uptime</span>
          <span><strong className="text-gray-900">AR · BR · MX · CO · CL · UY · PE</strong></span>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black text-gray-900 mb-3">Todo lo que necesitas para automatizar</h2>
          <p className="text-gray-500">Potentes funciones diseñadas para vendedores de Mercado Libre</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition">
              <div className="w-10 h-10 bg-ml-blue/10 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-ml-blue" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 border-t border-gray-100 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-gray-900 mb-3">Planes para cada etapa</h2>
            <p className="text-gray-500">Empieza gratis y escala cuando lo necesites</p>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`bg-white rounded-2xl border p-6 flex flex-col ${plan.highlight ? 'border-ml-blue shadow-xl shadow-ml-blue/10 relative' : 'border-gray-200'}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ml-blue text-white text-[11px] font-bold px-3 py-1 rounded-full">
                    Más popular
                  </div>
                )}
                <p className="font-bold text-gray-900 mb-1">{plan.label}</p>
                <p className="text-4xl font-black text-gray-900">{plan.price}<span className="text-sm font-normal text-gray-400">{plan.period}</span></p>
                <div className="my-5 space-y-1.5 text-sm text-gray-600 flex-1">
                  <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />{plan.questions} preguntas/mes</div>
                  <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />{plan.rules} reglas</div>
                  <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />{plan.accounts} cuenta{plan.accounts !== '1' ? 's' : ''} ML</div>
                  {plan.extras.map((extra) => (
                    <div key={extra} className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 shrink-0" />{extra}</div>
                  ))}
                </div>
                <Link
                  href={plan.href}
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition ${plan.highlight ? 'bg-ml-blue text-white hover:bg-blue-600' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto text-center px-6 py-24">
        <h2 className="text-3xl font-black text-gray-900 mb-4">¿Listo para automatizar?</h2>
        <p className="text-gray-500 mb-8">Empieza gratis hoy. Sin tarjeta de crédito.</p>
        <Link href="/login" className="inline-block bg-ml-blue text-white font-bold px-10 py-4 rounded-xl hover:bg-blue-600 transition text-lg">
          Crear cuenta gratis
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6 text-center text-xs text-gray-400">
        <p>&copy; {new Date().getFullYear()} ML Automator. Producto independiente, no afiliado a Mercado Libre.</p>
      </footer>
    </div>
  );
}
