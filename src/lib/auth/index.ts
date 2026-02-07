import { getDbProviderType } from '@/lib/provider/env';
import { restAuthAdapter } from './restAuthAdapter';
import { supabaseAuthAdapter } from './supabaseAuthAdapter';
import type { AuthAdapter } from './types';

export function getAuthAdapter(): AuthAdapter {
  if (getDbProviderType() === 'rest') {
    return restAuthAdapter;
  }
  return supabaseAuthAdapter;
}

export type { AuthAdapter, PasswordAuthResult } from './types';
