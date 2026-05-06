import { createClient } from '@/lib/supabase/server';
import { MessageSquare, Zap, Store, TrendingUp } from 'lucide-react';

async function getStats(userId: string) {
  const supabase = createClient();
  const [{ count: ruleCount }, { count: accountCount }, { count: replyCount }] = await Promise.all([
    supabase.from('automation_rules').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('ml_accounts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('auto_reply_log')
      .select('ml_account_id', { count: 'exact', head: true })
      .in('ml_account_id', (await supabase.from('ml_accounts').select('id').eq('user_id', userId)).data?.map((a: any) => a.id) ?? [])
      .eq('status', 'sent')
      .gte('created_at', new Date(new Date().setDate(1)).toISOString()),
  ]);
  return { ruleCount: ruleCount ?? 0, accountCount: accountCount ?? 0, replyCount: replyCount ?? 0 };
}

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
        <div className="bg-ml-yellow/10 border border-ml-yellow/30 rounded-xl p-6 text-center">
          <Store className="w-10 h-10 text-ml-yellow mx-auto mb-3" />
          <h2 className="font-semibold text-gray-900 mb-1">Conecta tu cuenta de Mercado Libre</h2>
          <p className="text-sm text-gray-600 mb-4">Vincula tu cuenta para empezar a automatizar respuestas</p>
          <a href="/dashboard/accounts" className="inline-block bg-ml-blue text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-600 transition">
            Conectar cuenta
          </a>
        </div>
      )}
    </div>
  );
}
