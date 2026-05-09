'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { API_URL } from '@/lib/utils';

const CONDITION_TYPES = [
  { value: 'keyword', label: 'Palabra clave' },
  { value: 'regex', label: 'Expresión regular' },
  { value: 'item_id', label: 'ID de artículo' },
  { value: 'category_id', label: 'Categoría' },
  { value: 'any', label: 'Cualquier pregunta' },
];

export default function NewRulePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [priority, setPriority] = useState(100);
  const [conditionMode, setConditionMode] = useState<'any' | 'all'>('any');
  const [conditions, setConditions] = useState([{ type: 'keyword', value: '' }]);
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; ml_nickname: string }[]>([]);
  const [mlAccountId, setMlAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const getToken = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  useEffect(() => {
    getToken().then(async (token) => {
      const [tRes, aRes] = await Promise.all([
        fetch(`${API_URL}/api/templates`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [t, a] = await Promise.all([tRes.json(), aRes.json()]);
      setTemplates(t.templates ?? []);
      setAccounts(a.accounts ?? []);
      if (t.templates?.[0]) setTemplateId(t.templates[0].id);
      if (a.accounts?.[0]) setMlAccountId(a.accounts[0].id);
    });
  }, []);

  const addCondition = () => setConditions([...conditions, { type: 'keyword', value: '' }]);
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, field: string, value: string) =>
    setConditions(conditions.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  const handleSave = async () => {
    if (!name.trim()) return setError('El nombre es requerido');
    if (!templateId) return setError('Selecciona una plantilla de respuesta');
    setSaving(true);
    setError('');
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/rules`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, priority, condition_mode: conditionMode, conditions, action: { templateId }, ml_account_id: mlAccountId || null }),
    });
    const data = await res.json();
    if (data.ok) {
      router.push('/dashboard/rules');
    } else if (data.error === 'plan_limit_reached') {
      setError(`Límite del plan alcanzado (${data.limit} reglas). Actualiza tu plan para crear más.`);
    } else {
      setError(data.error ?? 'Error al guardar');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Nueva automatización</h1>

      {error && <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {/* Name + Priority */}
        <div className="p-5 grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombre de la regla</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Responder preguntas de envío" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ml-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Prioridad</label>
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} min={1} max={999} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ml-blue" />
          </div>
        </div>

        {/* Account */}
        {accounts.length > 0 && (
          <div className="p-5">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cuenta de Mercado Libre</label>
            <select value={mlAccountId} onChange={(e) => setMlAccountId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ml-blue">
              <option value="">Todas las cuentas</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.ml_nickname}</option>)}
            </select>
          </div>
        )}

        {/* Conditions */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-gray-600">Condiciones</label>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Activar si se cumplen</span>
              <select value={conditionMode} onChange={(e) => setConditionMode(e.target.value as 'any' | 'all')} className="border border-gray-300 rounded px-2 py-1 text-xs">
                <option value="any">alguna</option>
                <option value="all">todas</option>
              </select>
              <span>las condiciones</span>
            </div>
          </div>
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={c.type} onChange={(e) => updateCondition(i, 'type', e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                  {CONDITION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {c.type !== 'any' && (
                  <input type="text" value={c.value} onChange={(e) => updateCondition(i, 'value', e.target.value)} placeholder="valor..." className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ml-blue" />
                )}
                {conditions.length > 1 && (
                  <button onClick={() => removeCondition(i)} className="text-gray-400 hover:text-red-500 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addCondition} className="mt-3 text-xs text-ml-blue hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Agregar condición
          </button>
        </div>

        {/* Template */}
        <div className="p-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Plantilla de respuesta</label>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500">Primero <a href="/dashboard/templates" className="text-ml-blue underline">crea una plantilla</a>.</p>
          ) : (
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ml-blue">
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>

        {/* Save */}
        <div className="p-5 flex justify-end">
          <button onClick={handleSave} disabled={saving} className="bg-ml-blue text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-600 transition disabled:opacity-60">
            {saving ? 'Guardando...' : 'Crear regla'}
          </button>
        </div>
      </div>
    </div>
  );
}
