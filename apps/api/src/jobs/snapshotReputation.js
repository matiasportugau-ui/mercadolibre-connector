import { supabase } from '../supabase.js';
import crypto from 'node:crypto';
import { config } from '../config.js';

const decryptToken = (encryptedJson) => {
  if (!config.tokenEncryptionKey) return encryptedJson;
  try {
    const { iv, tag, data } = JSON.parse(encryptedJson);
    const key = Buffer.from(config.tokenEncryptionKey, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
  } catch {
    return encryptedJson;
  }
};

export const runReputationSnapshot = async () => {
  const today = new Date().toISOString().slice(0, 10);

  const { data: accounts, error } = await supabase
    .from('ml_accounts')
    .select('id, ml_user_id, access_token_enc')
    .eq('is_active', true);

  if (error) throw error;

  const results = [];
  for (const account of accounts ?? []) {
    try {
      const token = decryptToken(account.access_token_enc);
      const res = await fetch(`https://api.mercadolibre.com/users/${account.ml_user_id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        results.push({ accountId: account.id, status: 'fetch_error', httpStatus: res.status });
        continue;
      }
      const user = await res.json();
      const rep = user.seller_reputation ?? {};
      const metrics = rep.metrics ?? {};
      await supabase.from('ml_seller_metrics').upsert({
        ml_account_id: account.id,
        snapshot_date: today,
        level: rep.level_id ?? null,
        power_seller_status: rep.power_seller_status ?? null,
        total_sales: rep.transactions?.total ?? null,
        completed_sales: rep.transactions?.completed ?? null,
        canceled_sales: rep.transactions?.canceled ?? null,
        delayed_shipments: metrics.delayed_handling_time?.value ?? null,
        claims: metrics.claims?.value ?? null,
        reputation_score: null,
        raw: user,
      }, { onConflict: 'ml_account_id,snapshot_date' });
      results.push({ accountId: account.id, status: 'ok' });
    } catch (err) {
      results.push({ accountId: account.id, status: 'error', error: err.message });
    }
  }
  return results;
};
