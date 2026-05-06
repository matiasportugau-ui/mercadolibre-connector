import { evaluateRules } from './ruleMatcher.js';
import { renderTemplate } from './templateRenderer.js';
import { getPlan, isUnlimited } from './plans.js';

/**
 * Creates the automation engine.
 *
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient }} config
 */
export const createAutomationEngine = ({ supabase }) => {

  // Fetch rules scoped to userId: account-specific rules AND global (null) rules for that account.
  const fetchRulesForAccount = async (mlAccountId, userId) => {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .or(`ml_account_id.eq.${mlAccountId},ml_account_id.is.null`)
      .order('priority', { ascending: true });
    if (error) throw error;
    return data ?? [];
  };

  // Scope template fetch to userId to prevent cross-tenant reads.
  const fetchTemplate = async (templateId, userId) => {
    const { data, error } = await supabase
      .from('reply_templates')
      .select('content')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  };

  const logReply = async ({ ruleId, mlAccountId, questionId, answerText, status, error }) => {
    await supabase.from('auto_reply_log').insert({
      rule_id: ruleId,
      ml_account_id: mlAccountId,
      question_id: questionId,
      answer_text: answerText,
      status,
      error: error ?? null,
    });
  };

  const checkMonthlyLimit = async (userId) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_id, reply_count_month, reply_count_reset')
      .eq('id', userId)
      .single();
    if (!profile) return { allowed: false };

    const plan = getPlan(profile.plan_id);
    if (isUnlimited(plan.questionsPerMonth)) return { allowed: true };

    // Reset counter on new calendar month (compare year + month to handle year rollover).
    const now = new Date();
    const resetDate = new Date(profile.reply_count_reset);
    const isNewMonth =
      now.getFullYear() !== resetDate.getFullYear() ||
      now.getMonth() !== resetDate.getMonth();

    if (isNewMonth) {
      await supabase
        .from('profiles')
        .update({ reply_count_month: 0, reply_count_reset: now.toISOString().slice(0, 10) })
        .eq('id', userId);
      return { allowed: true };
    }

    return { allowed: profile.reply_count_month < plan.questionsPerMonth };
  };

  const incrementReplyCount = async () => {
    // RPC uses auth.uid() server-side; service role impersonation is not needed.
    await supabase.rpc('increment_reply_count');
  };

  /**
   * Full pipeline: match rules → render template → send reply via ML API fetch.
   * mlApiFetch: async (path, options) => Response — injected to avoid circular deps.
   */
  const processQuestion = async ({ question, mlAccountId, userId, mlApiFetch }) => {
    const { allowed } = await checkMonthlyLimit(userId);
    if (!allowed) {
      await logReply({ mlAccountId, questionId: question.id, status: 'skipped', error: 'monthly_limit_reached' });
      return { status: 'skipped', reason: 'monthly_limit_reached' };
    }

    const rules = await fetchRulesForAccount(mlAccountId, userId);
    const matchedRule = evaluateRules(question, rules);

    if (!matchedRule) {
      return { status: 'no_match' };
    }

    const template = await fetchTemplate(matchedRule.action.templateId, userId);

    const variables = {
      buyer_name: question.from?.nickname ?? '',
      item_title: question.item?.title ?? '',
      price: String(question.item?.price ?? ''),
      question_text: question.text ?? '',
    };
    const answerText = renderTemplate(template.content, variables);

    try {
      const res = await mlApiFetch('/answers', {
        method: 'POST',
        body: JSON.stringify({ question_id: question.id, text: answerText }),
      });
      if (!res.ok) throw new Error(`ML API error ${res.status}`);

      await logReply({ ruleId: matchedRule.id, mlAccountId, questionId: question.id, answerText, status: 'sent' });
      await incrementReplyCount();

      await supabase
        .from('automation_rules')
        .update({ total_matched: (matchedRule.total_matched ?? 0) + 1, last_matched_at: new Date().toISOString() })
        .eq('id', matchedRule.id);

      return { status: 'sent', ruleId: matchedRule.id, answerText };
    } catch (err) {
      await logReply({ ruleId: matchedRule.id, mlAccountId, questionId: question.id, answerText, status: 'failed', error: err.message });
      return { status: 'failed', error: err.message };
    }
  };

  /**
   * Entry point called by the API webhook handler.
   * Always marks the event processed (via try/finally) even if processing throws.
   */
  const processWebhookEvent = async ({ eventId, topic, resource, mlAccountId, userId, mlApiFetch }) => {
    const updateProcessed = (errorMsg) =>
      supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          ...(errorMsg ? { raw_body: supabase.raw(`raw_body || '{"_error":"${errorMsg}"}'::jsonb`) } : {}),
        })
        .eq('id', eventId);

    try {
      if (topic !== 'questions') {
        return { status: 'ignored', topic };
      }

      const questionId = resource?.split('/').pop();
      if (!questionId) {
        return { status: 'ignored', reason: 'no_question_id' };
      }

      const questionRes = await mlApiFetch(`/questions/${questionId}`);
      if (!questionRes.ok) {
        return { status: 'failed', reason: 'question_fetch_error' };
      }
      const question = await questionRes.json();

      return await processQuestion({ question, mlAccountId, userId, mlApiFetch });
    } catch (err) {
      return { status: 'failed', error: err.message };
    } finally {
      await updateProcessed().catch(() => {});
    }
  };

  return { processWebhookEvent, processQuestion, evaluateRules, renderTemplate };
};
