import { createSupabaseAdapter } from './supabaseAdapter';
import { createRestAdapter } from './restAdapter';
import { getDbProviderType } from './env';
import type { DbAdapter } from './types';

export function getDbAdapter(): DbAdapter {
  const provider = getDbProviderType();
  if (provider === 'rest') {
    return createRestAdapter();
  }
  return createSupabaseAdapter();
}

export { getDbProviderType } from './env';
