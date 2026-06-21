import { Router } from 'express';
import { requestWithRetries, getStoredTokens } from '../mercadoLibreClient.js';

const router = Router();

router.get('/reputation', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await requestWithRetries({
      method: 'GET',
      path: `/users/${tokens.user_id}/seller_reputation`,
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await requestWithRetries({
      method: 'GET',
      path: `/orders/search`,
      query: {
        seller_id: tokens.user_id,
        sort: 'date_desc',
        limit: req.query.limit || 50,
        offset: req.query.offset || 0,
      },
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/questions', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await requestWithRetries({
      method: 'GET',
      path: `/questions/search`,
      query: {
        seller_id: tokens.user_id,
        status: 'UNANSWERED',
        limit: req.query.limit || 50,
      },
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/items/quality', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const listingsResult = await requestWithRetries({
      method: 'GET',
      path: `/users/${tokens.user_id}/items/search`,
      query: { limit: 100 },
    });

    const qualityData = [];
    for (const itemId of listingsResult.results || []) {
      try {
        const quality = await requestWithRetries({
          method: 'GET',
          path: `/items/${itemId}/quality`,
        });
        qualityData.push(quality);
      } catch {
        qualityData.push({ item_id: itemId, error: 'Could not fetch quality' });
      }
    }

    res.json({ quality_scores: qualityData });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
