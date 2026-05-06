import { createClient } from '@/lib/supabase/server';
import { CopyButton } from '@/components/dashboard/CopyButton';

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const webhookUrl = `${apiUrl}/webhooks/ml`;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Ajustes de tu cuenta</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Perfil</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" defaultValue={user?.email ?? ''} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
              <input type="text" defaultValue={profile?.full_name ?? ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ml-blue" />
            </div>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-1">URL de Webhook</h2>
          <p className="text-xs text-gray-400 mb-4">Configura esta URL en tu aplicación de Mercado Libre para recibir notificaciones</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={webhookUrl}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 font-mono"
            />
            <CopyButton text={webhookUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
