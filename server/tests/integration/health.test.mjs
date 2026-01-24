import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.INTEGRATION_BASE_URL;

test('health endpoint responds', async (t) => {
  if (!baseUrl) {
    t.skip('INTEGRATION_BASE_URL not set');
    return;
  }
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
});
