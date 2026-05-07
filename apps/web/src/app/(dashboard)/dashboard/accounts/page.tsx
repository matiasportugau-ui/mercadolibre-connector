import { createClient } from '@/lib/supabase/server';
import { Store, Plus } from 'lucide-react';
import { DisconnectButton } from '@/components/dashboard/DisconnectButton';

export default async function AccountsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: accounts } = await supabase
    .from('ml_accounts')
    .select('id, ml_user_id, ml_nickname, country_site, is_active, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true });

  const connectorUrl = process.env.NEXT_PUBLIC_CONNECTOR_URL ?? 'http://localhost:3001';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas de Mercado Libre</h1>
          <p className="text-gray-500 text-sm mt-1">Vincula tus cuentas para automatizar respuestas</p>
        </div>
        <a
          href={`${connectorUrl}/auth/ml/start`}
          className="flex items-center gap-2 bg-ml-yellow hover:bg-yellow-400 text-gray-900 font-bold text-sm px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-4 h-4" /> Conectar cuenta
        </a>
      </div>

      {!accounts || accounts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Store className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-gray-600 mb-1">Ninguna cuenta conectada</p>
          <p className="text-sm mb-6">Conecta tu cuenta de Mercado Libre para comenzar</p>
          <a href={`${connectorUrl}/auth/ml/start`} className="inline-block bg-ml-yellow text-gray-900 font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-yellow-400 transition">
            Conectar ahora
          </a>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-ml-yellow/20 flex items-center justify-center text-xl font-black text-ml-yellow">
                {account.country_site}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{account.ml_nickname ?? 'Sin nombre'}</p>
                <p className="text-xs text-gray-400">ID: {account.ml_user_id}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${account.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {account.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <DisconnectButton accountId={account.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
