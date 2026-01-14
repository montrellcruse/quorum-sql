import type { UserIdentity } from '../provider/types';

export interface AuthAdapter {
  getSessionUser(): Promise<UserIdentity | null>;
  signInWithPassword?(email: string, password: string): Promise<void>;
  signUp?(email: string, password: string, fullName?: string): Promise<void>;
  signInWithOAuth?(provider: 'google'): Promise<void>;
  signOut(): Promise<void>;
}
