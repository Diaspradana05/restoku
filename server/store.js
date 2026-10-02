// Lapisan penyimpanan: Upstash Redis (REST) untuk production/Vercel, file JSON untuk pengembangan lokal.
import fs from 'fs';
import { fileURLToPath } from 'url';

const URL_ = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const PREFIX = process.env.DB_PREFIX || 'restoku:';
const DIR = process.env.DATA_DIR ? process.env.DATA_DIR.replace(/\/?$/, '/') : fileURLToPath(new URL('./', import.meta.url));

const mode = URL_ && TOKEN ? 'redis' : process.env.VERCEL ? 'none' : 'file';

async function call(path, body) {
  let res;
  try {
    res = await fetch(URL_ + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) { throw new Error('Database tidak dapat dihubungi: ' + e.message); }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error('Database menolak permintaan: ' + (data?.error || res.status));
  return data;
}

export const store = {
  mode,
  async getAll(keys) {
    if (mode === 'redis') {
      const { result } = await call('', ['MGET', ...keys.map((k) => PREFIX + k)]);
      return Object.fromEntries(keys.map((k, i) => [k, result?.[i] ?? null]));
    }
    return Object.fromEntries(keys.map((k) => {
      try { return [k, fs.readFileSync(`${DIR}${k}.json`, 'utf8')]; } catch { return [k, null]; }
    }));
  },
  async setMany(obj) {
    const entries = Object.entries(obj);
    if (!entries.length) return;
    if (mode === 'redis') {
      const out = await call('/pipeline', entries.map(([k, v]) => ['SET', PREFIX + k, v]));
      const bad = Array.isArray(out) && out.find((r) => r?.error);
      if (bad) throw new Error('Gagal menyimpan: ' + bad.error);
      return;
    }
    for (const [k, v] of entries) { fs.writeFileSync(`${DIR}${k}.json.tmp`, v); fs.renameSync(`${DIR}${k}.json.tmp`, `${DIR}${k}.json`); }
  },
};
