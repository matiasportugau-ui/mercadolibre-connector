'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, RefreshCw, Sparkles, Send, Loader2, ChevronDown } from 'lucide-react';
import { cn, API_URL } from '@/lib/utils';

type MLQuestion = {
  id: number;
  text: string;
  status: string;
  date_created: string;
  item_id: string;
  from?: { id: number; answered_questions: number };
  answer?: { text: string; date_created: string } | null;
  _item_title?: string;
};

type ReplyLog = {
  id: string;
  question_id: number;
  answer_text: string;
  status: string;
  created_at: string;
  automation_rules?: { name: string } | null;
};

type Account = { id: string; ml_nickname: string; ml_user_id: string };

export default function QuestionsPage() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [questions, setQuestions] = useState<MLQuestion[]>([]);
  const [replyLog, setReplyLog] = useState<ReplyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});
  const [suggesting, setSuggesting] = useState<Record<number, boolean>>({});
  const [sending, setSending] = useState<Record<number, boolean>>({});
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const getToken = useCallback(async () => {
    const { data: { session } } = await createClient().auth.getSession();
    return session?.access_token ?? '';
  }, []);

  // Load accounts on mount
  useEffect(() => {
    getToken().then(async (token) => {
      const res = await fetch(`${API_URL}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const accs: Account[] = data.accounts ?? [];
      setAccounts(accs);
      if (accs[0]) setSelectedAccount(accs[0].id);
    });
  }, [getToken]);

  // Fetch pending questions from ML API
  const fetchQuestions = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    const token = await getToken();
    const res = await fetch(
      `${API_URL}/api/questions?account_id=${selectedAccount}&status=UNANSWERED&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      setQuestions(data.questions ?? []);
    }
    setLoading(false);
  }, [selectedAccount, getToken]);

  // Fetch auto-reply history from Supabase
  const fetchHistory = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('auto_reply_log')
      .select('*, automation_rules(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    setReplyLog(data ?? []);
  }, []);

  useEffect(() => {
    if (tab === 'pending') fetchQuestions();
    else fetchHistory();
  }, [tab, selectedAccount, fetchQuestions, fetchHistory]);

  // Realtime updates for history tab
  useEffect(() => {
    fetchHistory();
    const supabase = createClient();
    const channel = supabase
      .channel('auto_reply_log_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auto_reply_log' }, (payload) => {
        setReplyLog((prev) => [payload.new as ReplyLog, ...prev.slice(0, 49)]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchHistory]);

  const handleSuggest = async (q: MLQuestion) => {
    setSuggesting((p) => ({ ...p, [q.id]: true }));
    const token = await getToken();
    const res = await fetch(
      `${API_URL}/api/questions/${q.id}/suggest?account_id=${selectedAccount}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (data.suggestion) {
      setReplyTexts((p) => ({ ...p, [q.id]: data.suggestion }));
      setExpanded((p) => new Set([...p, q.id]));
    } else if (data.upgrade) {
      alert('Las sugerencias de IA están disponibles desde el plan Pro. Actualiza tu plan en Facturación.');
    }
    setSuggesting((p) => ({ ...p, [q.id]: false }));
  };

  const handleSend = async (questionId: number) => {
    const text = replyTexts[questionId]?.trim();
    if (!text) return;
    setSending((p) => ({ ...p, [questionId]: true }));
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/questions/${questionId}/answer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: selectedAccount, text }),
    });
    const data = await res.json();
    if (data.ok) {
      setSentIds((p) => new Set([...p, questionId]));
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setReplyTexts((p) => { const next = { ...p }; delete next[questionId]; return next; });
    }
    setSending((p) => ({ ...p, [questionId]: false }));
  };

  const toggleExpand = (id: number) =>
    setExpanded((p) => { const next = new Set(p); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consultas</h1>
          <p className="text-gray-500 text-sm mt-1">Preguntas de compradores y respuestas automáticas</p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ml-blue"
            >
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.ml_nickname}</option>)}
            </select>
          )}
          <button
            onClick={() => tab === 'pending' ? fetchQuestions() : fetchHistory()}
            className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {[
          { key: 'pending', label: `Sin responder${questions.length > 0 ? ` (${questions.length})` : ''}` },
          { key: 'history', label: 'Historial automático' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'pending' | 'history')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition',
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pending questions */}
      {tab === 'pending' && (
        <>
          {accounts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Conecta una cuenta de Mercado Libre para ver consultas</p>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-24" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin consultas pendientes</p>
              <p className="text-sm">¡Todo respondido! Las nuevas preguntas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => {
                const isExpanded = expanded.has(q.id);
                const replyText = replyTexts[q.id] ?? '';
                return (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Question header */}
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-ml-blue/10 flex items-center justify-center shrink-0 text-xs font-bold text-ml-blue">
                          C
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {q.item_id && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                                {q.item_id}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {new Date(q.date_created).toLocaleString('es-AR')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 font-medium">{q.text}</p>
                        </div>
                        <button
                          onClick={() => toggleExpand(q.id)}
                          className="shrink-0 p-1 text-gray-400 hover:text-gray-600 transition"
                        >
                          <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                        </button>
                      </div>
                    </div>

                    {/* Reply area (expanded) */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyTexts((p) => ({ ...p, [q.id]: e.target.value }))}
                          placeholder="Escribe una respuesta para el comprador…"
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ml-blue resize-none bg-white"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <button
                            onClick={() => handleSuggest(q)}
                            disabled={suggesting[q.id]}
                            className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            {suggesting[q.id]
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando…</>
                              : <><Sparkles className="w-3.5 h-3.5" /> {replyText ? 'Regenerar cotización' : 'Sugerir cotización con IA'}</>
                            }
                          </button>
                          <button
                            onClick={() => handleSend(q.id)}
                            disabled={!replyText.trim() || sending[q.id]}
                            className="flex items-center gap-1.5 bg-ml-blue text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-40 transition"
                          >
                            {sending[q.id]
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
                              : <><Send className="w-3.5 h-3.5" /> Enviar</>
                            }
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quick reply bar (collapsed) */}
                    {!isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-2 bg-gray-50">
                        <button
                          onClick={() => { toggleExpand(q.id); handleSuggest(q); }}
                          disabled={suggesting[q.id]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 transition disabled:opacity-50"
                        >
                          {suggesting[q.id]
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Generando…</>
                            : <><Sparkles className="w-3 h-3" /> Cotizar con IA</>
                          }
                        </button>
                        <span className="text-gray-300">·</span>
                        <button
                          onClick={() => toggleExpand(q.id)}
                          className="text-xs text-gray-400 hover:text-gray-600 transition"
                        >
                          Responder manualmente
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <>
          {replyLog.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin respuestas aún</p>
              <p className="text-sm">Las respuestas automáticas y manuales aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {replyLog.map((entry) => (
                <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          entry.status === 'sent' ? 'bg-green-100 text-green-700' :
                          entry.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        )}>
                          {entry.status === 'sent' ? 'Enviada' : entry.status === 'failed' ? 'Error' : 'Omitida'}
                        </span>
                        {entry.automation_rules?.name ? (
                          <span className="text-xs text-gray-400">Regla: {entry.automation_rules.name}</span>
                        ) : (
                          <span className="text-xs text-gray-400">Manual</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 line-clamp-2">{entry.answer_text}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">#{entry.question_id}</p>
                      <p className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
