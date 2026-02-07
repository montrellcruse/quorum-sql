import { createSupabaseAdapter } from './supabaseAdapter';
import { createRestAdapter } from './restAdapter';
import { getDbProviderType } from './env';
import type { DbAdapter } from './types';

let dbAdapter: DbAdapter | undefined;

export function getDbAdapter(): DbAdapter {
  if (dbAdapter) {
    return dbAdapter;
  }

  const provider = getDbProviderType();
  if (provider === 'rest') {
    dbAdapter = createRestAdapter();
    return dbAdapter;
  }

  dbAdapter = createSupabaseAdapter();
  return dbAdapter;
}

export { getDbProviderType } from './env';
