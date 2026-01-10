import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { restAuthAdapter } from '@/lib/auth/restAuthAdapter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { checkUserTeamMembership, checkPendingInvitations } from '@/utils/teamUtils';

const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || '';
const GOOGLE_WORKSPACE_DOMAIN = import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || '';
const APP_NAME = import.meta.env.VITE_APP_NAME || 'Quorum';

// Parse auth providers from env
const AUTH_PROVIDERS = (import.meta.env.VITE_AUTH_PROVIDERS || 'google')
  .split(',')
  .map((p: string) => p.trim().toLowerCase());

const hasGoogleAuth = AUTH_PROVIDERS.includes('google');
const hasEmailAuth = AUTH_PROVIDERS.includes('email');

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();

  // Redirect if already logged in
  useEffect(() => {
    const redirectUser = async () => {
      if (user && user.email) {
        // Validate domain if restriction is set
        if (ALLOWED_DOMAIN && !user.email.endsWith(ALLOWED_DOMAIN)) {
          if (provider === 'rest') {
            await restAuthAdapter.signOut();
          } else {
            await supabase.auth.signOut();
          }
          toast({
            title: 'Access Denied',
            description: `Only ${ALLOWED_DOMAIN} email addresses are allowed.`,
            variant: 'destructive',
          });
          return;
        }

        // Check for pending invitations first
        const hasPendingInvites = await checkPendingInvitations(user.email);

        if (hasPendingInvites) {
          navigate('/accept-invites');
          return;
        }

        // If no pending invitations, check team membership
        const hasTeam = await checkUserTeamMembership(user.id);
        if (hasTeam) {
          navigate('/dashboard');
        } else {
          navigate('/create-team');
        }
      }
    };
    redirectUser();
  }, [user, navigate, toast, provider]);

  const validateEmailDomain = (emailToCheck: string): boolean => {
    if (!ALLOWED_DOMAIN) return true;
    return emailToCheck.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase());
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    if (provider === 'rest') {
      toast({ title: 'Not available', description: 'Google sign-in requires Supabase.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          ...(GOOGLE_WORKSPACE_DOMAIN && { hd: GOOGLE_WORKSPACE_DOMAIN })
        }
      }
    });

    if (error) {
      toast({
        title: 'Sign In Failed',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    // Validate domain
    if (!validateEmailDomain(trimmedEmail)) {
      toast({
        title: 'Invalid Email Domain',
        description: `Only ${ALLOWED_DOMAIN} email addresses are allowed.`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (provider === 'rest') {
        await restAuthAdapter.signInWithPassword!(trimmedEmail, password);
        window.location.href = '/dashboard';
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({ title: 'Sign In Failed', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    // Validate domain
    if (!validateEmailDomain(trimmedEmail)) {
      toast({
        title: 'Invalid Email Domain',
        description: `Only ${ALLOWED_DOMAIN} email addresses are allowed.`,
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (provider === 'rest') {
        toast({ title: 'Not available', description: 'Sign up requires Supabase.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim() || undefined,
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;

      // If we got a session, user is logged in (email confirmation disabled)
      // The useEffect will handle redirect. If no session, show confirmation message.
      if (!data.session) {
        toast({
          title: 'Check Your Email',
          description: 'We sent you a confirmation link. Please check your email to complete sign up.',
        });
      }
      setLoading(false);
    } catch (error: any) {
      toast({ title: 'Sign Up Failed', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const showBothMethods = hasGoogleAuth && hasEmailAuth && provider !== 'rest';
  const showGoogleOnly = hasGoogleAuth && !hasEmailAuth && provider !== 'rest';
  const showEmailOnly = hasEmailAuth && !hasGoogleAuth || provider === 'rest';

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{APP_NAME}</CardTitle>
          {ALLOWED_DOMAIN && (
            <CardDescription>
              Only {ALLOWED_DOMAIN} email addresses are allowed
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Google OAuth Button */}
            {hasGoogleAuth && provider !== 'rest' && (
              <Button
                onClick={handleGoogleSignIn}
                className="w-full"
                disabled={loading}
                size="lg"
                variant="outline"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Signing in...' : 'Continue with Google'}
              </Button>
            )}

            {/* Separator when both methods available */}
            {showBothMethods && (
              <div className="relative">
                <Separator />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2">
                  <span className="text-xs text-muted-foreground">OR</span>
                </div>
              </div>
            )}

            {/* Email/Password Form */}
            {(hasEmailAuth || provider === 'rest') && (
              <div className="space-y-4">
                <form onSubmit={isSignUp ? handleEmailSignUp : handleEmailSignIn} className="space-y-3">
                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Your name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={ALLOWED_DOMAIN ? `you${ALLOWED_DOMAIN}` : 'you@example.com'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={isSignUp ? 'Create a password (min 6 chars)' : 'Enter password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      minLength={isSignUp ? 6 : undefined}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading
                      ? (isSignUp ? 'Creating account...' : 'Signing in...')
                      : (isSignUp ? 'Create Account' : 'Sign In')
                    }
                  </Button>
                </form>

                {/* Toggle between Sign In and Sign Up (only for Supabase) */}
                {provider !== 'rest' && (
                  <p className="text-sm text-center text-muted-foreground">
                    {isSignUp ? (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(false)}
                          className="text-primary hover:underline font-medium"
                        >
                          Sign in
                        </button>
                      </>
                    ) : (
                      <>
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(true)}
                          className="text-primary hover:underline font-medium"
                        >
                          Create one
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* No auth methods configured */}
            {!hasGoogleAuth && !hasEmailAuth && provider !== 'rest' && (
              <p className="text-sm text-center text-muted-foreground">
                No authentication methods configured. Please check your environment settings.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
