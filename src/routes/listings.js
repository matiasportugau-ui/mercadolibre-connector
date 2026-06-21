import { Router } from 'express';
import { requestWithRetries, getStoredTokens } from '../mercadoLibreClient.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await requestWithRetries({
      method: 'GET',
      path: `/users/${tokens.user_id}/items/search`,
      query: { limit: req.query.limit || 50, offset: req.query.offset || 0 },
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'GET',
      path: `/items/${req.params.id}`,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const tokens = getStoredTokens();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!req.body.title || !req.body.category_id || !req.body.price) {
      return res.status(400).json({
        error: 'Missing required fields: title, category_id, price',
      });
    }

    const result = await requestWithRetries({
      method: 'POST',
      path: '/items',
      body: req.body,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'PUT',
      path: `/items/${req.params.id}`,
      body: req.body,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: active, paused, closed',
      });
    }

    const result = await requestWithRetries({
      method: 'PUT',
      path: `/items/${req.params.id}`,
      body: { status },
    });

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id/visits', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'GET',
      path: `/items/${req.params.id}/visits/time_window`,
      query: { last: req.query.last || '7d' },
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
