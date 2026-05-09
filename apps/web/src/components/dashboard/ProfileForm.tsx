'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check } from 'lucide-react';

export function ProfileForm({ email, initialName }: { email: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ml-blue"
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || name.trim() === initialName}
          className="flex items-center gap-1.5 px-4 py-2 bg-ml-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-40 transition"
        >
          {saved ? <><Check className="w-3.5 h-3.5" /> Guardado</> : saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
