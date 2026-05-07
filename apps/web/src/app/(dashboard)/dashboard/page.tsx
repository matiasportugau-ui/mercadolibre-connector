import { createClient } from '@/lib/supabase/server';
import { MessageSquare, Zap, Store, TrendingUp, ShoppingBag, MessageCircle, Package, BarChart2, ArrowRight } from 'lucide-react';

async function getStats(userId: string) {
  const supabase = createClient();

  const [{ count: ruleCount }, { count: accountCount }, { data: accounts }] = await Promise.all([
    supabase.from('automation_rules').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('ml_accounts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('ml_accounts').select('id').eq('user_id', userId),
  ]);

  const accountIds = accounts?.map((a) => a.id) ?? [];

  let replyCount = 0;
  if (accountIds.length > 0) {
    const { count } = await supabase
      .from('auto_reply_log')
      .select('ml_account_id', { count: 'exact', head: true })
      .in('ml_account_id', accountIds)
      .eq('status', 'sent')
      .gte('created_at', new Date(new Date().setDate(1)).toISOString());
    replyCount = count ?? 0;
  }

  return { ruleCount: ruleCount ?? 0, accountCount: accountCount ?? 0, replyCount };
}

const QUICK_NAV = [
  { href: '/dashboard/questions', label: 'Preguntas', description: 'Historial de respuestas automáticas', icon: MessageSquare, color: 'bg-blue-50 text-blue-600' },
  { href: '/dashboard/messages', label: 'Mensajes', description: 'Mensajes post-venta de compradores', icon: MessageCircle, color: 'bg-indigo-50 text-indigo-600' },
  { href: '/dashboard/orders', label: 'Órdenes', description: 'Ingresos y estado de ventas', icon: ShoppingBag, color: 'bg-green-50 text-green-600' },
  { href: '/dashboard/items', label: 'Publicaciones', description: 'Salud y stock de tu catálogo', icon: Package, color: 'bg-orange-50 text-orange-600' },
  { href: '/dashboard/analytics', label: 'Analíticas', description: 'Reputación, tendencias y métricas', icon: BarChart2, color: 'bg-purple-50 text-purple-600' },
  { href: '/dashboard/rules', label: 'Automatizaciones', description: 'Reglas y condiciones de respuesta', icon: Zap, color: 'bg-yellow-50 text-yellow-600' },
];

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { ruleCount, accountCount, replyCount } = await getStats(user!.id);

  const cards = [
    { label: 'Respuestas este mes', value: replyCount, icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
    { label: 'Reglas activas', value: ruleCount, icon: Zap, color: 'text-purple-600 bg-purple-50' },
    { label: 'Cuentas conectadas', value: accountCount, icon: Store, color: 'text-green-600 bg-green-50' },
    { label: 'Tasa de respuesta', value: ruleCount > 0 ? '98%' : '—', icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Resumen</h1>
        <p className="text-gray-500 text-sm mt-1">Vista general de tu actividad de automatización</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`rounded-lg p-2.5 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {accountCount === 0 && (
        <div className="bg-ml-yellow/10 border border-ml-yellow/30 rounded-xl p-6 text-center mb-8">
          <Store className="w-10 h-10 text-ml-yellow mx-auto mb-3" />
          <h2 className="font-semibold text-gray-900 mb-1">Conecta tu cuenta de Mercado Libre</h2>
          <p className="text-sm text-gray-600 mb-4">Vincula tu cuenta para empezar a automatizar respuestas</p>
          <a href="/dashboard/accounts" className="inline-block bg-ml-blue text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-600 transition">
            Conectar cuenta
          </a>
        </div>
      )}

      {/* Quick navigation */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Acceso rápido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_NAV.map(({ href, label, description, icon: Icon, color }) => (
            <a
              key={href}
              href={href}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-gray-300 hover:shadow-sm transition group"
            >
              <div className={`rounded-lg p-2 shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 truncate">{description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 group-hover:text-gray-500 transition" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
