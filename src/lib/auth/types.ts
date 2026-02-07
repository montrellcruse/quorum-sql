import type { UserIdentity } from '../provider/types';

export interface PasswordAuthResult {
  hasSession: boolean;
}

export interface AuthAdapter {
  getSessionUser(): Promise<UserIdentity | null>;
  signInWithPassword?(email: string, password: string): Promise<PasswordAuthResult>;
  signUp?(email: string, password: string, fullName?: string): Promise<PasswordAuthResult>;
  signInWithOAuth?(provider: 'google'): Promise<void>;
  signOut(): Promise<void>;
  requiresManualPostAuthRedirect: boolean;
}
