'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, RefreshCw, Sparkles, Send, Loader2, ChevronDown, CheckCircle2, Clock, TrendingUp, SkipForward } from 'lucide-react';
import { cn, API_URL } from '@/lib/utils';

type MLQuestion = {
  id: number;
  text: string;
  status: string;
  date_created: string;
  item_id: string;
  from?: { id: number; answered_questions: number };
  _item_title?: string;
};

type SentLead = {
  id: string;
  question_id: number;
  question_text: string | null;
  item_id: string | null;
  item_title: string | null;
  quote_text: string | null;
  sent_at: string;
  source: string;
  rule_name: string | null;
  follow_up_status: string;
  follow_up_at: string | null;
};

type Account = { id: string; ml_nickname: string; ml_user_id: string };
type Tab = 'pending' | 'sent' | 'followups';

const FOLLOW_UP_LABEL: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Seguimiento pendiente', cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  sent:      { label: 'Seguimiento enviado',   cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  skipped:   { label: 'Omitido',               cls: 'bg-gray-100 text-gray-500' },
  converted: { label: '✓ Convertido',          cls: 'bg-green-50 text-green-700 border border-green-200' },
};

export default function QuestionsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [questions, setQuestions] = useState<MLQuestion[]>([]);
  const [sentLeads, setSentLeads] = useState<SentLead[]>([]);
  const [followUpsDue, setFollowUpsDue] = useState<SentLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({});
  const [suggesting, setSuggesting] = useState<Record<number, boolean>>({});
  const [sending, setSending] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [updatingFollowUp, setUpdatingFollowUp] = useState<Record<string, boolean>>({});
  const sentCountRef = useRef(0);

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
      // Newest first — API already returns DESC, but enforce just in case
      const sorted = (data.questions ?? []).sort(
        (a: MLQuestion, b: MLQuestion) =>
          new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
      );
      setQuestions(sorted);
    }
    setLoading(false);
  }, [selectedAccount, getToken]);

  const fetchSentLeads = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('sent_leads')
      .select('id, question_id, question_text, item_id, item_title, quote_text, sent_at, source, rule_name, follow_up_status, follow_up_at')
      .order('sent_at', { ascending: false })
      .limit(50);
    setSentLeads(data ?? []);
    sentCountRef.current = data?.length ?? 0;
  }, []);

  const fetchFollowUpsDue = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/reports/follow-ups?status=pending&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setFollowUpsDue(data.follow_ups ?? []);
    }
  }, [getToken]);

  useEffect(() => {
    if (tab === 'pending') fetchQuestions();
    else if (tab === 'sent') fetchSentLeads();
    else if (tab === 'followups') fetchFollowUpsDue();
  }, [tab, selectedAccount, fetchQuestions, fetchSentLeads, fetchFollowUpsDue]);

  // Realtime: new sent_leads appear at top of Enviados
  useEffect(() => {
    fetchSentLeads();
    const supabase = createClient();
    const ch = supabase
      .channel('sent_leads_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sent_leads' }, (payload) => {
        setSentLeads((prev) => [payload.new as SentLead, ...prev.slice(0, 49)]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sent_leads' }, (payload) => {
        setSentLeads((prev) => prev.map((l) => l.id === payload.new.id ? { ...l, ...payload.new as SentLead } : l));
        setFollowUpsDue((prev) => prev.filter((l) => l.id !== payload.new.id || payload.new.follow_up_status === 'pending'));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchSentLeads]);

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

  const handleSend = async (q: MLQuestion) => {
    const text = replyTexts[q.id]?.trim();
    if (!text) return;
    setSending((p) => ({ ...p, [q.id]: true }));
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/questions/${q.id}/answer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: selectedAccount,
        text,
        question_text: q.text,
        item_id: q.item_id ?? null,
        item_title: q._item_title ?? null,
        buyer_id: q.from?.id ?? null,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
      setReplyTexts((p) => { const n = { ...p }; delete n[q.id]; return n; });
      setTab('sent');
    }
    setSending((p) => ({ ...p, [q.id]: false }));
  };

  const handleFollowUpAction = async (leadId: string, status: 'sent' | 'skipped' | 'converted') => {
    setUpdatingFollowUp((p) => ({ ...p, [leadId]: true }));
    const token = await getToken();
    await fetch(`${API_URL}/api/reports/follow-ups/${leadId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ follow_up_status: status }),
    });
    setUpdatingFollowUp((p) => ({ ...p, [leadId]: false }));
  };

  const toggleExpand = (id: number) =>
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sentCount = sentLeads.length;
  const dueCount = followUpsDue.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consultas & Leads</h1>
          <p className="text-gray-500 text-sm mt-1">Pipeline de preguntas, cotizaciones y seguimientos</p>
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
            onClick={() => { if (tab === 'pending') fetchQuestions(); else if (tab === 'sent') fetchSentLeads(); else fetchFollowUpsDue(); }}
            className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {([
          { key: 'pending',   label: `Pendientes${questions.length > 0 ? ` (${questions.length})` : ''}` },
          { key: 'sent',      label: `Enviados${sentCount > 0 ? ` (${sentCount})` : ''}` },
          { key: 'followups', label: `Seguimientos${dueCount > 0 ? ` (${dueCount})` : ''}` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition relative',
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {label}
            {key === 'followups' && dueCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── PENDIENTES ── */}
      {tab === 'pending' && (
        <>
          {accounts.length === 0 ? (
            <EmptyState icon={<MessageSquare className="w-12 h-12 opacity-30" />} title="Sin cuentas conectadas" sub="Conecta una cuenta de Mercado Libre para ver consultas" />
          ) : loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-24" />)}</div>
          ) : questions.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="w-12 h-12 opacity-30 text-green-500" />} title="¡Todo respondido!" sub="Las nuevas preguntas aparecerán aquí en orden de llegada." />
          ) : (
            <div className="space-y-3">
              {questions.map((q) => {
                const isExpanded = expanded.has(q.id);
                const replyText = replyTexts[q.id] ?? '';
                return (
                  <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-ml-blue/10 flex items-center justify-center shrink-0 text-xs font-bold text-ml-blue">C</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {q.item_id && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{q.item_id}</span>}
                            <span className="text-[10px] text-gray-400">{new Date(q.date_created).toLocaleString('es-AR')}</span>
                          </div>
                          <p className="text-sm text-gray-800 font-medium">{q.text}</p>
                        </div>
                        <button onClick={() => toggleExpand(q.id)} className="shrink-0 p-1 text-gray-400 hover:text-gray-600 transition">
                          <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyTexts((p) => ({ ...p, [q.id]: e.target.value }))}
                          placeholder="Escribe una cotización o respuesta para el comprador…"
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
                              : <><Sparkles className="w-3.5 h-3.5" /> {replyText ? 'Regenerar cotización' : 'Cotizar con IA'}</>}
                          </button>
                          <button
                            onClick={() => handleSend(q)}
                            disabled={!replyText.trim() || sending[q.id]}
                            className="flex items-center gap-1.5 bg-ml-blue text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-40 transition"
                          >
                            {sending[q.id]
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
                              : <><Send className="w-3.5 h-3.5" /> Enviar</>}
                          </button>
                        </div>
                      </div>
                    )}

                    {!isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-2.5 flex items-center gap-2 bg-gray-50">
                        <button
                          onClick={() => { toggleExpand(q.id); handleSuggest(q); }}
                          disabled={suggesting[q.id]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 transition disabled:opacity-50"
                        >
                          {suggesting[q.id] ? <><Loader2 className="w-3 h-3 animate-spin" /> Generando…</> : <><Sparkles className="w-3 h-3" /> Cotizar con IA</>}
                        </button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => toggleExpand(q.id)} className="text-xs text-gray-400 hover:text-gray-600 transition">Responder manualmente</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── ENVIADOS ── */}
      {tab === 'sent' && (
        <>
          {sentLeads.length === 0 ? (
            <EmptyState icon={<Send className="w-12 h-12 opacity-30" />} title="Sin cotizaciones enviadas" sub="Las cotizaciones manuales y automáticas aparecerán aquí." />
          ) : (
            <div className="space-y-3">
              {sentLeads.map((lead) => {
                const fu = FOLLOW_UP_LABEL[lead.follow_up_status] ?? FOLLOW_UP_LABEL.pending;
                const overdue = lead.follow_up_status === 'pending' && lead.follow_up_at && new Date(lead.follow_up_at) < new Date();
                return (
                  <div key={lead.id} className={cn('bg-white rounded-xl border overflow-hidden', overdue ? 'border-orange-200' : 'border-gray-200')}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-1">
                          {lead.question_text && (
                            <p className="text-xs text-gray-500 italic line-clamp-1">"{lead.question_text}"</p>
                          )}
                          <p className="text-sm text-gray-800 line-clamp-2">{lead.quote_text}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            {lead.item_id && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{lead.item_id}</span>}
                            <span className="text-[10px] text-gray-400">{new Date(lead.sent_at).toLocaleString('es-AR')}</span>
                            <span className="text-[10px] text-gray-400">{lead.source === 'auto' ? `Auto · ${lead.rule_name ?? ''}` : 'Manual'}</span>
                          </div>
                        </div>
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', fu.cls)}>
                          {overdue && lead.follow_up_status === 'pending' ? '⚠ Vence hoy' : fu.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── SEGUIMIENTOS ── */}
      {tab === 'followups' && (
        <>
          {followUpsDue.length === 0 ? (
            <EmptyState icon={<Clock className="w-12 h-12 opacity-30 text-green-500" />} title="Sin seguimientos pendientes" sub="Cuando envíes cotizaciones, los seguimientos programados aparecerán aquí." />
          ) : (
            <div className="space-y-3">
              {followUpsDue.map((lead) => {
                const overdue = lead.follow_up_at && new Date(lead.follow_up_at) < new Date();
                const busy = updatingFollowUp[lead.id];
                return (
                  <div key={lead.id} className={cn('bg-white rounded-xl border p-4', overdue ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200')}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        {lead.question_text && <p className="text-xs text-gray-500 italic line-clamp-1">"{lead.question_text}"</p>}
                        {lead.item_title && <p className="text-xs font-medium text-gray-700">{lead.item_title}</p>}
                        <p className="text-sm text-gray-800 line-clamp-2">{lead.quote_text}</p>
                        <p className="text-[10px] text-gray-400">
                          Enviado: {new Date(lead.sent_at).toLocaleString('es-AR')}
                          {lead.follow_up_at && ` · Seguimiento: ${new Date(lead.follow_up_at).toLocaleString('es-AR')}`}
                        </p>
                      </div>
                      {overdue && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full shrink-0">⚠ Vencido</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFollowUpAction(lead.id, 'converted')}
                        disabled={busy}
                        className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                      >
                        <TrendingUp className="w-3 h-3" /> Convertido
                      </button>
                      <button
                        onClick={() => handleFollowUpAction(lead.id, 'sent')}
                        disabled={busy}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                      >
                        <Send className="w-3 h-3" /> Seguimiento enviado
                      </button>
                      <button
                        onClick={() => handleFollowUpAction(lead.id, 'skipped')}
                        disabled={busy}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 transition disabled:opacity-40"
                      >
                        <SkipForward className="w-3 h-3" /> Omitir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-3">
      {icon}
      <div>
        <p className="font-medium text-gray-600">{title}</p>
        <p className="text-sm">{sub}</p>
      </div>
    </div>
  );
}
