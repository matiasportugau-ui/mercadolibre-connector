# MercadoLibre Connector

A standalone Node.js service that acts as the MercadoLibre connection layer, providing OAuth 2.0 authentication, token management, and a proxy API for MercadoLibre resources.

## Features

- OAuth 2.0 flow (authorization code + token refresh)
- Encrypted token storage with AES-256-GCM
- Proxy endpoints for MercadoLibre items, questions, orders, and users
- Webhook receiver with optional token verification
- Structured JSON logging via [pino](https://github.com/pinojs/pino)

## Requirements

- Node.js 18 or later (uses native `fetch` and `crypto`)

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the server listens on | `3001` |
| `APP_ENV` | Application environment | `development` |
| `LOG_LEVEL` | Pino log level | `info` |
| `PUBLIC_BASE_URL` | Public URL of this service | `http://localhost:3001` |
| `ML_CLIENT_ID` | MercadoLibre app client ID | `742811153438318` |
| `ML_CLIENT_SECRET` | MercadoLibre app client secret | *(required)* |
| `ML_REDIRECT_URI_DEV` | OAuth redirect URI for development | `http://localhost:3001/auth/ml/callback` |
| `ML_REDIRECT_URI_PROD` | OAuth redirect URI for production | *(required if `ML_USE_PROD_REDIRECT=true`)* |
| `ML_USE_PROD_REDIRECT` | Use production redirect URI | `false` |
| `ML_AUTH_BASE` | MercadoLibre auth base URL | `https://auth.mercadolibre.com.uy` |
| `ML_API_BASE` | MercadoLibre API base URL | `https://api.mercadolibre.com` |
| `ML_TOKEN_FILE` | Path to token storage file | `.ml-tokens.enc` |
| `TOKEN_ENCRYPTION_KEY` | 64-char hex AES-256 key for token file encryption | *(optional, plaintext if omitted)* |
| `WEBHOOK_VERIFY_TOKEN` | Shared token for webhook verification | *(optional)* |
| `ML_HTTP_MAX_RETRIES` | Max retries for failed API requests | `3` |
| `ML_HTTP_TIMEOUT_MS` | HTTP request timeout in milliseconds | `15000` |

## Running

### Development (with auto-reload)

```bash
npm run dev
```

### Production

```bash
npm start
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check and config status |
| `GET` | `/auth/ml/start` | Start OAuth flow (redirects to MercadoLibre) |
| `GET` | `/auth/ml/callback` | OAuth callback handler |
| `GET` | `/auth/ml/status` | Check stored token status |
| `GET` | `/ml/users/me` | Get authenticated user info |
| `GET` | `/ml/items/:id` | Get item by ID |
| `GET` | `/ml/questions` | Search questions or get by ID |
| `GET` | `/ml/questions/:id` | Get question by ID |
| `POST` | `/ml/questions/:id/answer` | Answer a question |
| `GET` | `/ml/orders` | Search orders or get by ID |
| `GET` | `/ml/orders/:id` | Get order by ID |
| `POST` | `/webhooks/ml` | Receive MercadoLibre webhook events |
| `GET` | `/webhooks/ml/events` | List last 250 received webhook events |
