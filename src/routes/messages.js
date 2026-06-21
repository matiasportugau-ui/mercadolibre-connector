import { Router } from 'express';
import { requestWithRetries, getStoredTokens } from '../mercadoLibreClient.js';

const router = Router();

router.get('/packs', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await requestWithRetries({
      method: 'GET',
      path: `/messages/packs`,
      query: { limit: req.query.limit || 50, offset: req.query.offset || 0 },
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/packs/:packId', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await requestWithRetries({
      method: 'GET',
      path: `/messages/packs/${req.params.packId}/sellers/${tokens.user_id}`,
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/packs/:packId/reply', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.body.text) {
      return res.status(400).json({ error: 'Missing required field: text' });
    }

    const result = await requestWithRetries({
      method: 'POST',
      path: `/messages/packs/${req.params.packId}/sellers/${tokens.user_id}`,
      body: { text: req.body.text },
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/unread', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await requestWithRetries({
      method: 'GET',
      path: `/messages/packs`,
      query: { unread_messages: 'true', limit: 100 },
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
