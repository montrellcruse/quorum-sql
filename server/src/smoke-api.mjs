const base = process.env.API_BASE || 'http://localhost:8787';

async function req(path, method = 'GET', body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status} ${await res.text()}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function main() {
  const health = await req('/health');
  if (!health.ok) throw new Error('health not ok');
  const db = await req('/health/db');
  if (!db.ok) throw new Error('db not ok');

  // Create team
  const team = await req('/teams', 'POST', { name: 'ci-team', approval_quota: 1 });
  if (!team.id) throw new Error('team create failed');

  // List teams
  const teams = await req('/teams');
  if (!Array.isArray(teams) || !teams.find((t) => t.id === team.id)) throw new Error('team not listed');

  // Create folder
  const folder = await req('/folders', 'POST', {
    name: 'Root Folder',
    description: 'CI root',
    team_id: team.id,
  });
  if (!folder.id) throw new Error('folder create failed');

  // List children (should be empty)
  const children = await req(`/folders/${folder.id}/children`);
  if (!Array.isArray(children)) throw new Error('children fetch failed');

  // Create query
  const query = await req('/queries', 'POST', {
    title: 'CI Query',
    description: 'desc',
    sql_content: 'select 1 as one',
    status: 'draft',
    team_id: team.id,
    folder_id: folder.id,
  });
  if (!query.id) throw new Error('query create failed');

  // Update query to draft again (no-op)
  await req(`/queries/${query.id}`, 'PATCH', { status: 'draft' });

  // Search queries
  const qs = await req(`/queries?teamId=${encodeURIComponent(team.id)}&q=CI`);
  if (!Array.isArray(qs) || qs.length < 1) throw new Error('query search failed');

  console.log('SMOKE-API OK', { team: team.id, folder: folder.id, query: query.id });
}

main().catch((e) => {
  console.error('SMOKE-API FAILED', e);
  process.exit(1);
});
