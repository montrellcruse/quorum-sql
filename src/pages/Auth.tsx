import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { checkUserTeamMembership, checkPendingInvitations } from '@/utils/teamUtils';

const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || '@example.com';
const GOOGLE_WORKSPACE_DOMAIN = import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || '';
const IS_DEV = import.meta.env.DEV;
const DEV_TEST_EMAILS = ['admin@test.local', 'member@test.local'];

const isDevTestAccount = (email: string) => {
  return IS_DEV && DEV_TEST_EMAILS.includes(email.toLowerCase());
};

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    const redirectUser = async () => {
      if (user && user.email) {
        // Validate domain (allow dev test accounts in development)
        if (!isDevTestAccount(user.email) && !user.email.endsWith(ALLOWED_DOMAIN)) {
          await supabase.auth.signOut();
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
  }, [user, navigate, toast]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    
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
    // Don't set loading to false on success - the redirect will happen
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      toast({
        title: 'Sign In Failed',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
    }
    // Don't set loading to false on success - the redirect will happen
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">SQL Query Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={handleGoogleSignIn} 
              className="w-full" 
              disabled={loading}
              size="lg"
            >
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Only {ALLOWED_DOMAIN} email addresses are allowed
            </p>

            {IS_DEV && (
              <>
                <div className="relative">
                  <Separator />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2">
                    <span className="text-xs text-muted-foreground">OR</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
                      DEV MODE ONLY
                    </Badge>
                  </div>

                  <form onSubmit={handleEmailSignIn} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@test.local"
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
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Signing in...' : 'Sign in with Email'}
                    </Button>
                  </form>

                  <p className="text-xs text-muted-foreground text-center">
                    Test accounts only. Not available in production.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
