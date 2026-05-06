'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Zap, Plus, Trash2, Power } from 'lucide-react';
import { API_URL } from '@/lib/utils';

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: Array<{ type: string; value: string }>;
  condition_mode: string;
  action: { templateId: string };
  total_matched: number;
  last_matched_at: string | null;
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getToken = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const fetchRules = async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/rules`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.ok) setRules(data.rules);
    setLoading(false);
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/rules/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (data.ok) setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled } : r));
  };

  const deleteRule = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/rules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.ok) setRules((prev) => prev.filter((r) => r.id !== id));
  };

  useEffect(() => { fetchRules(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automatizaciones</h1>
          <p className="text-gray-500 text-sm mt-1">Reglas para responder preguntas automáticamente</p>
        </div>
        <a
          href="/dashboard/rules/new"
          className="flex items-center gap-2 bg-ml-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          <Plus className="w-4 h-4" /> Nueva regla
        </a>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin automatizaciones</p>
          <p className="text-sm">Crea tu primera regla para empezar a responder automáticamente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm">{rule.name}</h3>
                  <span className="text-xs text-gray-400">Prioridad {rule.priority}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rule.conditions.map((c, i) => (
                    <span key={i} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {c.type}: {c.value}
                    </span>
                  ))}
                  {rule.conditions.length === 0 && (
                    <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Todas las preguntas</span>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-gray-400 shrink-0">
                <p>{rule.total_matched} coincidencias</p>
                {rule.last_matched_at && <p>{new Date(rule.last_matched_at).toLocaleDateString('es-AR')}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleRule(rule.id, !rule.enabled)}
                  className={`p-1.5 rounded-lg transition ${rule.enabled ? 'bg-green-100 text-green-600 hover:bg-red-50 hover:text-red-500' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                  title={rule.enabled ? 'Desactivar' : 'Activar'}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
