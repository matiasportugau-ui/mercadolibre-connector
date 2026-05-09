'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart2, TrendingUp, Clock, Send, Sparkles, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_URL } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type Summary = {
  period_days: number;
  total_sent: number;
  follow_ups_due: number;
  converted: number;
  conversion_rate: number;
  top_rule: { name: string; count: number } | null;
  daily_volume: { date: string; count: number }[];
};

export default function ReportsPage() {
  const [days, setDays] = useState<7 | 30>(7);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [analysis, setAnalysis] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);

  const getToken = useCallback(async () => {
    const { data: { session } } = await createClient().auth.getSession();
    return session?.access_token ?? '';
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/reports/summary?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setSummary(data);
    }
    setLoadingSummary(false);
  }, [days, getToken]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const generateAnalysis = async () => {
    setLoadingAnalysis(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/reports/ai-analysis?days=30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setAnalysis(data.analysis ?? '');
      setAnalysisGenerated(true);
    }
    setLoadingAnalysis(false);
  };

  const kpis = summary ? [
    {
      label: 'Cotizaciones enviadas',
      value: summary.total_sent,
      icon: <Send className="w-5 h-5 text-ml-blue" />,
      bg: 'bg-blue-50',
    },
    {
      label: 'Convertidos a orden',
      value: summary.converted,
      sub: `${summary.conversion_rate}% conversión`,
      icon: <TrendingUp className="w-5 h-5 text-green-600" />,
      bg: 'bg-green-50',
    },
    {
      label: 'Seguimientos vencidos',
      value: summary.follow_ups_due,
      icon: <Clock className="w-5 h-5 text-orange-500" />,
      bg: 'bg-orange-50',
      alert: summary.follow_ups_due > 0,
    },
    {
      label: 'Regla más activa',
      value: summary.top_rule?.name ?? '—',
      sub: summary.top_rule ? `${summary.top_rule.count} usos` : undefined,
      icon: <BarChart2 className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-50',
    },
  ] : [];

  // Format dates for chart to short form
  const chartData = summary?.daily_volume.map((d) => ({
    ...d,
    date: new Date(d.date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
  })) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes & Análisis</h1>
          <p className="text-gray-500 text-sm mt-1">Métricas de leads, conversión y análisis con IA</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition ${days === d ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={fetchSummary}
            className="text-gray-500 border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={`bg-white rounded-xl border p-5 ${kpi.alert ? 'border-orange-300' : 'border-gray-200'}`}>
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>{kpi.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
              {kpi.sub && <p className="text-[11px] text-gray-400 mt-0.5">{kpi.sub}</p>}
              {kpi.alert && <p className="text-[11px] text-orange-500 font-semibold mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Atención requerida</p>}
            </div>
          ))}
        </div>
      )}

      {/* Volume chart */}
      {summary && chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Cotizaciones enviadas — últimos {days} días</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(v: number) => [v, 'Enviadas']}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Analysis */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-700">Análisis IA de ventas</h2>
          </div>
          {!analysisGenerated && (
            <button
              onClick={generateAnalysis}
              disabled={loadingAnalysis}
              className="flex items-center gap-2 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-4 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              {loadingAnalysis
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando…</>
                : <><Sparkles className="w-4 h-4" /> Generar análisis</>}
            </button>
          )}
          {analysisGenerated && (
            <button
              onClick={() => { setAnalysisGenerated(false); setAnalysis(''); generateAnalysis(); }}
              disabled={loadingAnalysis}
              className="text-xs text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
            >
              {loadingAnalysis ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Regenerar'}
            </button>
          )}
        </div>

        {!analysisGenerated && !loadingAnalysis && (
          <div className="text-center py-10 text-gray-400">
            <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Genera un análisis inteligente de tus últimas 30 días de actividad.</p>
            <p className="text-xs mt-1">Incluye patrones detectados, oportunidades y acciones sugeridas.</p>
          </div>
        )}

        {loadingAnalysis && (
          <div className="flex items-center gap-3 py-8 text-gray-500 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            <span className="text-sm">Analizando patrones de ventas con IA…</span>
          </div>
        )}

        {analysisGenerated && analysis && (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
            {analysis}
          </div>
        )}
      </div>

      {/* Suggested quick actions */}
      {summary && (summary.follow_ups_due > 0 || summary.converted === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Acciones sugeridas</p>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                {summary.follow_ups_due > 0 && (
                  <li>Tienes <strong>{summary.follow_ups_due}</strong> seguimiento{summary.follow_ups_due > 1 ? 's' : ''} pendiente{summary.follow_ups_due > 1 ? 's' : ''}. <a href="/dashboard/questions" className="underline font-semibold">Gestionar en Consultas →</a></li>
                )}
                {summary.total_sent > 0 && summary.converted === 0 && (
                  <li>Ninguna cotización marcada como convertida en los últimos {days} días. Registra las órdenes ganadas para mejorar el análisis.</li>
                )}
                {summary.total_sent === 0 && (
                  <li>Sin cotizaciones enviadas. <a href="/dashboard/questions" className="underline font-semibold">Responder preguntas →</a></li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {summary && summary.total_sent > 0 && summary.converted > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            <strong>{summary.converted}</strong> cotizaci{summary.converted > 1 ? 'ones convertidas' : 'ón convertida'} en los últimos {days} días — tasa de conversión: <strong>{summary.conversion_rate}%</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
