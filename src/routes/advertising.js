import { Router } from 'express';
import { requestWithRetries } from '../mercadoLibreClient.js';

const router = Router();

router.get('/campaigns', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'GET',
      path: `/advertising/product_ads/campaigns`,
      query: { limit: req.query.limit || 50, offset: req.query.offset || 0 },
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    if (!req.body.name || !req.body.budget) {
      return res.status(400).json({
        error: 'Missing required fields: name, budget',
      });
    }

    const result = await requestWithRetries({
      method: 'POST',
      path: `/advertising/product_ads/campaigns`,
      body: req.body,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/campaigns/:id', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'PUT',
      path: `/advertising/product_ads/campaigns/${req.params.id}`,
      body: req.body,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/campaigns/:id/ads', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'GET',
      path: `/advertising/product_ads/campaigns/${req.params.id}/ads`,
      query: { limit: req.query.limit || 50, offset: req.query.offset || 0 },
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/campaigns/:id/ads', async (req, res) => {
  try {
    if (!req.body.item_id) {
      return res.status(400).json({ error: 'Missing required field: item_id' });
    }

    const result = await requestWithRetries({
      method: 'POST',
      path: `/advertising/product_ads/campaigns/${req.params.id}/ads`,
      body: { item_id: req.body.item_id },
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/campaigns/:id/ads/:adId', async (req, res) => {
  try {
    await requestWithRetries({
      method: 'DELETE',
      path: `/advertising/product_ads/campaigns/${req.params.id}/ads/${req.params.adId}`,
    });
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/reports/summary', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'GET',
      path: `/advertising/product_ads/reports/summary`,
      query: {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
      },
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
