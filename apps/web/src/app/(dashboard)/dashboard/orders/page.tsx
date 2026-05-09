import { createClient } from '@/lib/supabase/server';
import { ShoppingBag } from 'lucide-react';

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: accounts } = await supabase
    .from('ml_accounts')
    .select('id')
    .eq('user_id', user!.id);

  const accountIds = accounts?.map((a) => a.id) ?? [];

  const since30d = new Date(Date.now() - 30 * 86400000).toISOString();

  let orders: any[] = [];
  if (accountIds.length > 0) {
    const { data } = await supabase
      .from('ml_orders')
      .select('ml_order_id, status, total_amount, currency_id, date_created, buyer_nickname, items')
      .in('ml_account_id', accountIds)
      .gte('date_created', since30d)
      .order('date_created', { ascending: false })
      .limit(50);
    orders = data ?? [];
  }

  const confirmed = orders.filter((o) => o.status === 'confirmed' || o.status === 'payment_done');
  const revenue = confirmed.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
  const currency = confirmed[0]?.currency_id ?? '';

  const statusLabel: Record<string, string> = {
    confirmed: 'Confirmado',
    payment_done: 'Pagado',
    cancelled: 'Cancelado',
    invalid: 'Inválido',
    payment_required: 'Pago pendiente',
  };

  const statusColor: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    payment_done: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    invalid: 'bg-gray-100 text-gray-500',
    payment_required: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
        <p className="text-gray-500 text-sm mt-1">Últimos 30 días</p>
      </div>

      {accountIds.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Conecta una cuenta de Mercado Libre para ver órdenes</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-3xl font-black text-ml-blue">{confirmed.length}</p>
              <p className="text-xs text-gray-500 mt-1">Órdenes confirmadas</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-3xl font-black text-green-600">
                {currency} {revenue.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">Ingresos del período</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-3xl font-black text-gray-700">{orders.length}</p>
              <p className="text-xs text-gray-500 mt-1">Total de órdenes</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Historial de órdenes</h2>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aún no hay órdenes. Los datos se sincronizan vía webhook automáticamente.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const itemList: any[] = Array.isArray(order.items) ? order.items : [];
                  return (
                    <div key={order.ml_order_id} className="px-6 py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-800">#{order.ml_order_id}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColor[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {statusLabel[order.status] ?? order.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {order.buyer_nickname ?? 'Comprador'} ·{' '}
                          {itemList.map((i: any) => i.title).join(', ').slice(0, 60) || 'Sin productos'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">
                          {order.currency_id} {Number(order.total_amount ?? 0).toLocaleString('es-AR')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {order.date_created ? new Date(order.date_created).toLocaleDateString('es-AR') : '—'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
