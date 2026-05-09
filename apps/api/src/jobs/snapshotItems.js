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

const fetchAllItemIds = async (mlUserId, token) => {
  const ids = [];
  let offset = 0;
  const limit = 50;
  while (true) {
    const res = await fetch(
      `https://api.mercadolibre.com/users/${mlUserId}/items/search?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) break;
    const body = await res.json();
    const batch = body.results ?? [];
    ids.push(...batch);
    if (ids.length >= (body.paging?.total ?? 0) || batch.length < limit) break;
    offset += limit;
  }
  return ids;
};

export const runItemsSnapshot = async () => {
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
      const itemIds = await fetchAllItemIds(account.ml_user_id, token);
      if (itemIds.length === 0) {
        results.push({ accountId: account.id, itemCount: 0 });
        continue;
      }

      // Fetch visits in batches of 50
      const visitMap = {};
      for (let i = 0; i < itemIds.length; i += 50) {
        const batch = itemIds.slice(i, i + 50);
        const visitsRes = await fetch(
          `https://api.mercadolibre.com/visits/items?ids=${batch.join(',')}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }
        );
        if (visitsRes.ok) {
          const visitsBody = await visitsRes.json();
          for (const [id, count] of Object.entries(visitsBody)) {
            visitMap[id] = count;
          }
        }
      }

      // Fetch item details in batches of 20
      for (let i = 0; i < itemIds.length; i += 20) {
        const batch = itemIds.slice(i, i + 20);
        const itemsRes = await fetch(
          `https://api.mercadolibre.com/items?ids=${batch.join(',')}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }
        );
        if (!itemsRes.ok) continue;
        const itemsBody = await itemsRes.json();
        for (const entry of itemsBody) {
          if (entry.code !== 200) continue;
          const item = entry.body;
          await supabase.from('ml_item_metrics').upsert({
            ml_account_id: account.id,
            ml_item_id: item.id,
            snapshot_date: today,
            title: item.title ?? null,
            status: item.status ?? null,
            available_quantity: item.available_quantity ?? null,
            visits: visitMap[item.id] ?? null,
            questions_count: null,
            raw: item,
          }, { onConflict: 'ml_account_id,ml_item_id,snapshot_date' });
        }
      }
      results.push({ accountId: account.id, itemCount: itemIds.length, status: 'ok' });
    } catch (err) {
      results.push({ accountId: account.id, status: 'error', error: err.message });
    }
  }
  return results;
};
