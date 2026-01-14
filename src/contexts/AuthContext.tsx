import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { restAuthAdapter } from '@/lib/auth/restAuthAdapter';
import { getDbProviderType } from '@/lib/provider/env';
import { isEmailAllowed, normalizeAllowedDomain } from '@/utils/email';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

// Dev-only test accounts that bypass domain validation
const DEV_TEST_EMAILS = ['admin@test.local', 'member@test.local'];
const ALLOW_DEV_TEST_ACCOUNTS = import.meta.env.VITE_ALLOW_DEV_TEST_ACCOUNTS === 'true';
const isDevTestAccount = (email: string) => {
  return import.meta.env.DEV && ALLOW_DEV_TEST_ACCOUNTS && DEV_TEST_EMAILS.includes(email.toLowerCase());
};

// Get allowed email domain from environment variable (empty = no restriction)
const ALLOWED_EMAIL_DOMAIN = normalizeAllowedDomain(import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || '');

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const provider = getDbProviderType();
    if (provider === 'rest') {
      // REST mode: fetch session user once
      restAuthAdapter
        .getSessionUser()
        .then((u) => {
          if (!u) {
            setUser(null);
            setSession(null);
            setLoading(false);
            return;
          }
          const fakeUser = { id: u.id, email: u.email } as unknown as User;
          // Domain validation
          const userEmail = u.email;
          if (userEmail && !isDevTestAccount(userEmail) && !isEmailAllowed(userEmail, ALLOWED_EMAIL_DOMAIN)) {
            setUser(null);
            setSession(null);
          } else {
            setUser(fakeUser);
            setSession(null);
          }
          setLoading(false);
        })
        .catch(() => {
          setUser(null);
          setSession(null);
          setLoading(false);
        });
      return;
    }

    // Supabase mode: subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const userEmail = session.user.email;
          if (userEmail && !isDevTestAccount(userEmail) && !isEmailAllowed(userEmail, ALLOWED_EMAIL_DOMAIN)) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const userEmail = session.user.email;
        if (userEmail && !isDevTestAccount(userEmail) && !isEmailAllowed(userEmail, ALLOWED_EMAIL_DOMAIN)) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
