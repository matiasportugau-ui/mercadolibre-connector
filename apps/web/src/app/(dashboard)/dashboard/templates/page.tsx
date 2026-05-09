'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import { API_URL } from '@/lib/utils';

const VARIABLE_HINT = '{{buyer_name}} · {{item_title}} · {{price}} · {{question_text}}';

type Template = { id: string; name: string; content: string; created_at: string };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const getToken = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const fetchTemplates = async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/templates`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.ok) setTemplates(data.templates);
    setLoading(false);
  };

  const createTemplate = async () => {
    if (!newName.trim() || !newContent.trim()) return;
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, content: newContent }),
    });
    const data = await res.json();
    if (data.ok) {
      setTemplates([data.template, ...templates]);
      setNewName(''); setNewContent(''); setCreating(false);
    }
    setSaving(false);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/templates/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
    const data = await res.json();
    if (data.ok) {
      setTemplates((prev) => prev.map((t) => t.id === id ? data.template : t));
      setEditingId(null);
    }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    const token = await getToken();
    await fetch(`${API_URL}/api/templates/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => { fetchTemplates(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas</h1>
          <p className="text-gray-500 text-sm mt-1">Textos de respuesta reutilizables con variables dinámicas</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-ml-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-600 transition">
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-6">Variables disponibles: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{VARIABLE_HINT}</code></p>

      {/* Create form */}
      {creating && (
        <div className="bg-white rounded-xl border border-ml-blue/30 p-5 mb-4">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la plantilla" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ml-blue" />
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={4} placeholder="Hola {{buyer_name}}, gracias por tu pregunta sobre {{item_title}}..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ml-blue" />
          <div className="flex gap-2 mt-3 justify-end">
            <button onClick={() => setCreating(false)} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition">Cancelar</button>
            <button onClick={createTemplate} disabled={saving} className="text-sm bg-ml-blue text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-60">Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-200 h-24 animate-pulse" />)}</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin plantillas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 mb-1">{t.name}</p>
                  {editingId === t.id ? (
                    <>
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ml-blue" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => saveEdit(t.id)} disabled={saving} className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition"><Check className="w-3 h-3" /> Guardar</button>
                        <button onClick={() => setEditingId(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition"><X className="w-3 h-3" /> Cancelar</button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600 line-clamp-2">{t.content}</p>
                  )}
                </div>
                {editingId !== t.id && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { setEditingId(t.id); setEditContent(t.content); }} className="p-1.5 text-gray-400 hover:text-ml-blue hover:bg-blue-50 rounded-lg transition"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => deleteTemplate(t.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
