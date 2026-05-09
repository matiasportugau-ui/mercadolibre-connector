import { createClient } from '@/lib/supabase/server';
import { MessageCircle } from 'lucide-react';

export default async function MessagesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: accounts } = await supabase
    .from('ml_accounts')
    .select('id')
    .eq('user_id', user!.id);

  const accountIds = accounts?.map((a) => a.id) ?? [];

  let messages: any[] = [];
  if (accountIds.length > 0) {
    const { data } = await supabase
      .from('ml_messages')
      .select('id, pack_id, from_user_id, from_role, text, status, auto_replied, created_at')
      .in('ml_account_id', accountIds)
      .order('created_at', { ascending: false })
      .limit(50);
    messages = data ?? [];
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mensajes post-venta</h1>
        <p className="text-gray-500 text-sm mt-1">Mensajes de compradores después de la venta</p>
      </div>

      {accountIds.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Conecta una cuenta de Mercado Libre para ver mensajes</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin mensajes aún. Los mensajes de compradores aparecen aquí automáticamente.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-100">
            {messages.map((msg) => (
              <div key={msg.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-ml-blue/10 flex items-center justify-center shrink-0 text-xs font-bold text-ml-blue uppercase">
                    {msg.from_role === 'buyer' ? 'C' : 'V'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">
                        {msg.from_role === 'buyer' ? 'Comprador' : 'Vendedor'} · Pack #{msg.pack_id}
                      </span>
                      {msg.auto_replied && (
                        <span className="text-[10px] bg-ml-blue/10 text-ml-blue font-semibold px-1.5 py-0.5 rounded">Auto</span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                        {msg.created_at ? new Date(msg.created_at).toLocaleString('es-AR') : '—'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{msg.text ?? '(sin texto)'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
