import { createClient } from '@/lib/supabase/server';
import { BarChart2 } from 'lucide-react';

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: accounts } = await supabase
    .from('ml_accounts')
    .select('id')
    .eq('user_id', user!.id);

  const accountIds = accounts?.map((a) => a.id) ?? [];

  const [{ data: bySatus }, { data: topRules }] = await Promise.all([
    supabase
      .from('auto_reply_log')
      .select('status')
      .in('ml_account_id', accountIds)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('automation_rules')
      .select('name, total_matched, last_matched_at')
      .eq('user_id', user!.id)
      .order('total_matched', { ascending: false })
      .limit(5),
  ]);

  const sent = bySatus?.filter((r) => r.status === 'sent').length ?? 0;
  const failed = bySatus?.filter((r) => r.status === 'failed').length ?? 0;
  const skipped = bySatus?.filter((r) => r.status === 'skipped').length ?? 0;
  const total = sent + failed + skipped;
  const rate = total > 0 ? Math.round((sent / total) * 100) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analíticas</h1>
        <p className="text-gray-500 text-sm mt-1">Últimos 30 días</p>
      </div>

      {accountIds.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Conecta una cuenta de Mercado Libre para ver analíticas</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Respuestas enviadas', value: sent, color: 'text-green-600' },
              { label: 'Errores', value: failed, color: 'text-red-500' },
              { label: 'Omitidas', value: skipped, color: 'text-gray-500' },
              { label: 'Tasa de éxito', value: `${rate}%`, color: 'text-ml-blue' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className={`text-3xl font-black ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Reglas más activas</h2>
            {!topRules || topRules.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos aún</p>
            ) : (
              <div className="space-y-3">
                {topRules.map((rule) => (
                  <div key={rule.name} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800 truncate">{rule.name}</span>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">{rule.total_matched} hits</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-ml-blue h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (rule.total_matched / (topRules[0]?.total_matched || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
