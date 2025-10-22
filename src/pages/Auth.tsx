import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { checkUserTeamMembership, checkPendingInvitations } from '@/utils/teamUtils';

const ALLOWED_DOMAIN = '@azdes.gov';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    const redirectUser = async () => {
      if (user && user.email) {
        // Validate domain
        if (!user.email.endsWith(ALLOWED_DOMAIN)) {
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
          hd: 'azdes.gov' // Google Workspace domain hint
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>SQL Query Manager</CardTitle>
          <CardDescription>
            Sign in with your {ALLOWED_DOMAIN} Google account
          </CardDescription>
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
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
