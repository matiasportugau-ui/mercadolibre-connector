'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, RefreshCw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReplyLog = {
  id: string;
  question_id: number;
  answer_text: string;
  status: string;
  created_at: string;
  automation_rules?: { name: string };
};

export default function QuestionsPage() {
  const [replyLog, setReplyLog] = useState<ReplyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLog = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('auto_reply_log')
      .select('*, automation_rules(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    setReplyLog(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLog();

    // Subscribe to realtime new replies
    const supabase = createClient();
    const channel = supabase
      .channel('auto_reply_log_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auto_reply_log' }, (payload) => {
        setReplyLog((prev) => [payload.new as ReplyLog, ...prev.slice(0, 49)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Preguntas respondidas</h1>
          <p className="text-gray-500 text-sm mt-1">Historial de respuestas automáticas en tiempo real</p>
        </div>
        <button onClick={fetchLog} className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : replyLog.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin respuestas aún</p>
          <p className="text-sm">Las respuestas automáticas aparecerán aquí en tiempo real</p>
        </div>
      ) : (
        <div className="space-y-3">
          {replyLog.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      entry.status === 'sent' ? 'bg-green-100 text-green-700' :
                      entry.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {entry.status === 'sent' ? 'Enviada' : entry.status === 'failed' ? 'Error' : 'Omitida'}
                    </span>
                    {entry.automation_rules?.name && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Send className="w-3 h-3" /> {entry.automation_rules.name}
                      </span>
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
    </div>
  );
}
