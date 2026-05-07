import { createClient } from '@/lib/supabase/server';
import { BarChart2, Lock, TrendingUp, ShoppingBag } from 'lucide-react';

const LEVEL_COLOR: Record<string, string> = {
  '5_green': 'bg-green-100 text-green-700',
  '4_light_green': 'bg-lime-100 text-lime-700',
  '3_yellow': 'bg-yellow-100 text-yellow-700',
  '2_orange': 'bg-orange-100 text-orange-700',
  '1_red': 'bg-red-100 text-red-600',
};

const LEVEL_LABEL: Record<string, string> = {
  '5_green': 'MercadoLíder Platinum',
  '4_light_green': 'MercadoLíder Gold',
  '3_yellow': 'MercadoLíder',
  '2_orange': 'Clásico',
  '1_red': 'Inicial',
};

function UpgradeGate({ feature }: { feature: string }) {
  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-6 overflow-hidden">
      <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center z-10 rounded-xl">
        <Lock className="w-5 h-5 text-gray-400 mb-2" />
        <p className="text-sm font-semibold text-gray-700">{feature}</p>
        <p className="text-xs text-gray-400 mb-3">Disponible desde el plan Starter</p>
        <a
          href="/dashboard/billing"
          className="text-xs font-semibold bg-ml-blue text-white px-4 py-1.5 rounded-lg hover:bg-blue-600 transition"
        >
          Mejorar plan
        </a>
      </div>
      {/* Blurred placeholder */}
      <div className="blur-sm pointer-events-none select-none">
        <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
        <div className="h-8 w-24 bg-gray-300 rounded mb-2" />
        <div className="h-3 w-40 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: accounts }, { data: profile }] = await Promise.all([
    supabase.from('ml_accounts').select('id').eq('user_id', user!.id),
    supabase.from('profiles').select('plan_id').eq('id', user!.id).single(),
  ]);

  const accountIds = accounts?.map((a) => a.id) ?? [];
  const planId = (profile as any)?.plan_id ?? 'free';
  const hasAdvancedAnalytics = planId !== 'free';

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Base queries always run
  const [{ data: byStatus }, { data: topRules }] = await Promise.all([
    accountIds.length > 0
      ? supabase.from('auto_reply_log').select('status').in('ml_account_id', accountIds).gte('created_at', since30d)
      : Promise.resolve({ data: [] }),
    supabase.from('automation_rules').select('name, total_matched').eq('user_id', user!.id).order('total_matched', { ascending: false }).limit(5),
  ]);

  // Advanced queries only for paid plans (avoid wasting DB calls on free tier)
  let reputationRows: any[] = [];
  let orderRows: any[] = [];
  if (hasAdvancedAnalytics && accountIds.length > 0) {
    const [{ data: rep }, { data: ord }] = await Promise.all([
      supabase
        .from('ml_seller_metrics')
        .select('ml_account_id, level, power_seller_status, total_sales, completed_sales, canceled_sales, snapshot_date')
        .in('ml_account_id', accountIds)
        .order('snapshot_date', { ascending: false })
        .limit(accountIds.length * 2),
      supabase
        .from('ml_orders')
        .select('total_amount, currency_id, status')
        .in('ml_account_id', accountIds)
        .gte('date_created', since30d),
    ]);
    reputationRows = rep ?? [];
    orderRows = ord ?? [];
  }

  const sent = (byStatus ?? []).filter((r: any) => r.status === 'sent').length;
  const failed = (byStatus ?? []).filter((r: any) => r.status === 'failed').length;
  const skipped = (byStatus ?? []).filter((r: any) => r.status === 'skipped').length;
  const total = sent + failed + skipped;
  const rate = total > 0 ? Math.round((sent / total) * 100) : 0;

  // Dedup reputation: latest snapshot per account
  const seen = new Set<string>();
  const latestReputation = reputationRows.filter((r) => {
    if (seen.has(r.ml_account_id)) return false;
    seen.add(r.ml_account_id);
    return true;
  });

  const confirmedOrders = orderRows.filter((o: any) => o.status === 'confirmed' || o.status === 'payment_done');
  const revenue = confirmedOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount ?? 0), 0);
  const orderCurrency = confirmedOrders[0]?.currency_id ?? '';
  const avgOrder = confirmedOrders.length > 0 ? revenue / confirmedOrders.length : 0;

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
        <div className="space-y-8">
          {/* Auto-reply stats */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Respuestas automáticas</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          </div>

          {/* Reputation + Revenue row */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Reputación y ventas</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {hasAdvancedAnalytics ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-gray-900 text-sm">Reputación del vendedor</h3>
                  </div>
                  {latestReputation.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      Sin datos aún — se actualizan diariamente
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {latestReputation.map((rep) => (
                        <div key={rep.ml_account_id} className="flex items-center justify-between">
                          <div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${LEVEL_COLOR[rep.level] ?? 'bg-gray-100 text-gray-600'}`}>
                              {LEVEL_LABEL[rep.level] ?? rep.level ?? '—'}
                            </span>
                            {rep.power_seller_status && (
                              <span className="ml-2 text-[10px] text-gray-400 uppercase">{rep.power_seller_status}</span>
                            )}
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <p>{rep.completed_sales ?? '—'} ventas completadas</p>
                            <p className="text-gray-400">{rep.snapshot_date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <UpgradeGate feature="Reputación del vendedor" />
              )}

              {hasAdvancedAnalytics ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingBag className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-gray-900 text-sm">Ingresos (últimos 30 días)</h3>
                  </div>
                  {orderRows.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      Sin órdenes aún — se sincronizan vía webhook automáticamente
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-end gap-2">
                        <p className="text-3xl font-black text-gray-900">
                          {orderCurrency} {revenue.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </p>
                        <p className="text-sm text-gray-400 mb-1">ingresos</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <p className="text-lg font-bold text-green-600">{confirmedOrders.length}</p>
                          <p className="text-xs text-gray-500">órdenes confirmadas</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-gray-700">
                            {orderCurrency} {avgOrder.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-gray-500">valor promedio</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <UpgradeGate feature="Ingresos y órdenes" />
              )}
            </div>
          </div>

          {/* Top rules */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Reglas más activas</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              {!topRules || topRules.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin datos aún</p>
              ) : (
                <div className="space-y-3">
                  {topRules.map((rule: any) => (
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
          </div>
        </div>
      )}
    </div>
  );
}
