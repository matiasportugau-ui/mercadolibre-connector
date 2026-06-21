import config from '../config.js';

export default function apiAuth(req, res, next) {
  if (config.appEnv === 'development' && !config.connectorApiKey) {
    return next();
  }

  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  if (token !== config.connectorApiKey) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}
