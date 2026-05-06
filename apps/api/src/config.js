import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  appEnv: process.env.APP_ENV ?? 'development',

  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',

  connectorUrl: process.env.CONNECTOR_URL ?? 'http://localhost:3001',

  mpAccessToken: process.env.MP_ACCESS_TOKEN ?? '',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET ?? '',

  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',

  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',
};
