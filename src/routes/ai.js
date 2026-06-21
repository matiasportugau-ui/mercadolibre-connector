import { Router } from 'express';
import { ask } from '../ai/client.js';
import {
  ANSWER_QUESTION,
  AD_OPTIMIZATION,
  LISTING_QUALITY,
  DAILY_BRIEF,
} from '../ai/prompts.js';
import { requestWithRetries, getStoredTokens } from '../mercadoLibreClient.js';

const router = Router();

router.post('/answer-question', async (req, res) => {
  try {
    const { questionId } = req.body;
    if (!questionId) {
      return res.status(400).json({ error: 'Missing required field: questionId' });
    }

    const question = await requestWithRetries({
      method: 'GET',
      path: `/questions/${questionId}`,
    });

    const item = await requestWithRetries({
      method: 'GET',
      path: `/items/${question.item_id}`,
    });

    const suggestion = await ask({
      systemPrompt: ANSWER_QUESTION,
      userMessage: `
Buyer question: "${question.text}"
Item title: ${item.title}
Item price: ${item.price}
Please suggest a professional reply in Spanish.`,
      maxTokens: 256,
    });

    res.json({
      question_id: questionId,
      question_text: question.text,
      item_title: item.title,
      suggested_answer: suggestion,
      requires_confirmation: true,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/optimize-ads', async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ error: 'Missing required field: campaignId' });
    }

    const campaign = await requestWithRetries({
      method: 'GET',
      path: `/advertising/product_ads/campaigns/${campaignId}`,
    });

    const ads = await requestWithRetries({
      method: 'GET',
      path: `/advertising/product_ads/campaigns/${campaignId}/ads`,
      query: { limit: 100 },
    });

    const suggestion = await ask({
      systemPrompt: AD_OPTIMIZATION,
      userMessage: `
Campaign: ${campaign.name}
Budget: ${campaign.budget}
Daily spend: ${campaign.daily_spend || 'N/A'}
Active ads: ${ads.length}
Total impressions: ${campaign.total_impressions || 0}
Total clicks: ${campaign.total_clicks || 0}
Total conversions: ${campaign.total_conversions || 0}
Please suggest optimizations.`,
      maxTokens: 512,
    });

    res.json({
      campaign_id: campaignId,
      campaign_name: campaign.name,
      suggestions: suggestion,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/listing-quality/:id', async (req, res) => {
  try {
    const item = await requestWithRetries({
      method: 'GET',
      path: `/items/${req.params.id}`,
    });

    const suggestion = await ask({
      systemPrompt: LISTING_QUALITY,
      userMessage: `
Title: ${item.title}
Price: ${item.price}
Category: ${item.category_id}
Attributes count: ${item.attributes?.length || 0}
Images count: ${item.pictures?.length || 0}
Has warranty: ${item.warranty ? 'Yes' : 'No'}
Shipping: ${item.shipping?.method || 'Not specified'}
Please provide quality improvement suggestions.`,
      maxTokens: 512,
    });

    res.json({
      item_id: req.params.id,
      item_title: item.title,
      quality_suggestions: suggestion,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/daily-brief', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [reputation, orders, questions, campaigns] = await Promise.all([
      requestWithRetries({
        method: 'GET',
        path: `/users/${tokens.user_id}/seller_reputation`,
      }).catch(() => ({ error: 'Could not fetch reputation' })),
      requestWithRetries({
        method: 'GET',
        path: `/orders/search`,
        query: { seller_id: tokens.user_id, sort: 'date_desc', limit: 5 },
      }).catch(() => ({ results: [] })),
      requestWithRetries({
        method: 'GET',
        path: `/questions/search`,
        query: { seller_id: tokens.user_id, status: 'UNANSWERED', limit: 5 },
      }).catch(() => ({ results: [] })),
      requestWithRetries({
        method: 'GET',
        path: `/advertising/product_ads/campaigns`,
        query: { limit: 10 },
      }).catch(() => ({ results: [] })),
    ]);

    const briefData = {
      rating: reputation.rating || 'N/A',
      negative_pct: reputation.negative_percentage || 'N/A',
      recent_orders: orders.results?.length || 0,
      unanswered_questions: questions.results?.length || 0,
      active_campaigns: campaigns.results?.length || 0,
    };

    const brief = await ask({
      systemPrompt: DAILY_BRIEF,
      userMessage: `
Seller rating: ${briefData.rating}
Negative feedback: ${briefData.negative_pct}%
Recent orders (last 5): ${briefData.recent_orders}
Unanswered questions: ${briefData.unanswered_questions}
Active ad campaigns: ${briefData.active_campaigns}
Please generate today's executive brief.`,
      maxTokens: 512,
    });

    res.json({
      metrics: briefData,
      daily_brief: brief,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
