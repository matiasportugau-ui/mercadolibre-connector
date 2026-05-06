import { evaluateRules } from './ruleMatcher.js';
import { renderTemplate } from './templateRenderer.js';
import { getPlan, isUnlimited } from './plans.js';

/**
 * Creates the automation engine.
 *
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient }} config
 */
export const createAutomationEngine = ({ supabase }) => {

  const fetchRulesForAccount = async (mlAccountId) => {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*, reply_templates(*)')
      .eq('ml_account_id', mlAccountId)
      .eq('enabled', true)
      .order('priority', { ascending: true });
    if (error) throw error;
    return data ?? [];
  };

  const fetchTemplate = async (templateId) => {
    const { data, error } = await supabase
      .from('reply_templates')
      .select('content')
      .eq('id', templateId)
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

    // reset counter if it's a new month
    const today = new Date().toISOString().slice(0, 10);
    if (profile.reply_count_reset !== today && new Date(profile.reply_count_reset).getMonth() !== new Date().getMonth()) {
      await supabase
        .from('profiles')
        .update({ reply_count_month: 0, reply_count_reset: today })
        .eq('id', userId);
      return { allowed: true };
    }

    return { allowed: profile.reply_count_month < plan.questionsPerMonth };
  };

  const incrementReplyCount = async (userId) => {
    await supabase.rpc('increment_reply_count', { user_id_arg: userId });
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

    const rules = await fetchRulesForAccount(mlAccountId);
    const matchedRule = evaluateRules(question, rules);

    if (!matchedRule) {
      return { status: 'no_match' };
    }

    const template = await fetchTemplate(matchedRule.action.templateId);

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
      await incrementReplyCount(userId);

      // update rule stats
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
   * Persists the event then triggers processQuestion if topic is "questions".
   */
  const processWebhookEvent = async ({ eventId, topic, resource, mlAccountId, userId, mlApiFetch }) => {
    // mark as processed
    const updateProcessed = () =>
      supabase
        .from('webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', eventId);

    if (topic !== 'questions') {
      await updateProcessed();
      return { status: 'ignored', topic };
    }

    // resource is like "/questions/12345"
    const questionId = resource?.split('/').pop();
    if (!questionId) {
      await updateProcessed();
      return { status: 'ignored', reason: 'no_question_id' };
    }

    const questionRes = await mlApiFetch(`/questions/${questionId}`);
    if (!questionRes.ok) {
      await updateProcessed();
      return { status: 'failed', reason: 'question_fetch_error' };
    }
    const question = await questionRes.json();

    const result = await processQuestion({ question, mlAccountId, userId, mlApiFetch });
    await updateProcessed();
    return result;
  };

  return { processWebhookEvent, processQuestion, evaluateRules, renderTemplate };
};
