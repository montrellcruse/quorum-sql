// Simple smoke test for server endpoints
const base = process.env.API_BASE || 'http://localhost:8787';

async function get(path) {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const health = await get('/health');
  if (!health.ok) throw new Error('health not ok');
  const db = await get('/health/db');
  if (!db.ok || !db.now) throw new Error('db not ok');
  console.log('SMOKE OK', { now: db.now });
}

main().catch((e) => {
  console.error('SMOKE FAILED', e);
  process.exit(1);
});
