import { createClient } from '@/lib/supabase/server';
import { Package, AlertTriangle } from 'lucide-react';

const statusLabel: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
  under_review: 'En revisión',
};

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-500',
  under_review: 'bg-orange-100 text-orange-700',
};

export default async function ItemsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: accounts } = await supabase
    .from('ml_accounts')
    .select('id')
    .eq('user_id', user!.id);

  const accountIds = accounts?.map((a) => a.id) ?? [];

  let items: any[] = [];
  if (accountIds.length > 0) {
    const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('ml_item_metrics')
      .select('ml_item_id, title, status, available_quantity, visits, snapshot_date')
      .in('ml_account_id', accountIds)
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: false });

    // Deduplicate by item id
    const seen = new Set<string>();
    items = (data ?? []).filter((row) => {
      if (seen.has(row.ml_item_id)) return false;
      seen.add(row.ml_item_id);
      return true;
    });
  }

  const alerts = items.filter((i) => i.available_quantity === 0 || i.status !== 'active');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Estado de publicaciones</h1>
        <p className="text-gray-500 text-sm mt-1">Salud y métricas de tus listados</p>
      </div>

      {accountIds.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Conecta una cuenta de Mercado Libre para ver publicaciones</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin datos aún. Los datos se sincronizan diariamente con tu catálogo de ML.</p>
        </div>
      ) : (
        <>
          {alerts.length > 0 && (
            <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">
                  {alerts.length} publicación{alerts.length > 1 ? 'es' : ''} requiere{alerts.length > 1 ? 'n' : ''} atención
                </p>
                <p className="text-xs text-orange-600 mt-0.5">
                  {alerts.filter((i) => i.available_quantity === 0).length} sin stock ·{' '}
                  {alerts.filter((i) => i.status !== 'active').length} no activas
                </p>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Publicaciones ({items.length})</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.ml_item_id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-800 truncate">{item.title ?? item.ml_item_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColor[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[item.status] ?? item.status}
                      </span>
                      <span className="text-xs text-gray-500">Stock: {item.available_quantity ?? '—'}</span>
                      {item.available_quantity === 0 && (
                        <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">Sin stock</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-700">{item.visits ?? '—'}</p>
                    <p className="text-xs text-gray-400">visitas</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
