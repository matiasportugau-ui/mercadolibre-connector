import { Router } from 'express';
import { requestWithRetries } from '../mercadoLibreClient.js';

const router = Router();

router.get('/:id', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'GET',
      path: `/shipments/${req.params.id}`,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'GET',
      path: `/shipments/${req.params.id}/history`,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/order/:orderId', async (req, res) => {
  try {
    const result = await requestWithRetries({
      method: 'GET',
      path: `/orders/${req.params.orderId}/shipments`,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
