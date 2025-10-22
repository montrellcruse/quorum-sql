import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { checkUserTeamMembership, checkPendingInvitations } from '@/utils/teamUtils';

const ALLOWED_DOMAIN = '@azdes.gov';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    const redirectUser = async () => {
      if (user) {
        const hasTeam = await checkUserTeamMembership(user.id);
        if (hasTeam) {
          navigate('/dashboard');
        } else {
          navigate('/create-team');
        }
      }
    };
    redirectUser();
  }, [user, navigate]);

  const validateEmail = (email: string): boolean => {
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      toast({
        title: 'Invalid Email Domain',
        description: `Only ${ALLOWED_DOMAIN} email addresses are allowed.`,
        variant: 'destructive',
      });
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return false;
    }
    
    return true;
  };

  const validatePassword = (password: string): boolean => {
    if (password.length < 6) {
      toast({
        title: 'Invalid Password',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email) || !validatePassword(password)) {
      return;
    }

    setLoading(true);
    
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Account Exists',
          description: 'This email is already registered. Please sign in instead.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Sign Up Failed',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Success!',
        description: 'Account created successfully. Redirecting...',
      });
      
      // Get the newly created user
      const { data: { user: newUser } } = await supabase.auth.getUser();
      
      if (newUser) {
        // Check for pending invitations first
        const hasPendingInvites = await checkPendingInvitations(email);
        
        if (hasPendingInvites) {
          navigate('/accept-invites');
          return;
        }
        
        // Check team membership and redirect accordingly
        const hasTeam = await checkUserTeamMembership(newUser.id);
        if (hasTeam) {
          navigate('/dashboard');
        } else {
          navigate('/create-team');
        }
      }
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email) || !validatePassword(password)) {
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast({
        title: 'Sign In Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'Successfully signed in.',
      });
      
      // Get the signed-in user
      const { data: { user: signedInUser } } = await supabase.auth.getUser();
      
      if (signedInUser) {
        // Check for pending invitations first
        const hasPendingInvites = await checkPendingInvitations(email);
        
        if (hasPendingInvites) {
          navigate('/accept-invites');
          return;
        }
        
        // Check team membership and redirect accordingly
        const hasTeam = await checkUserTeamMembership(signedInUser.id);
        if (hasTeam) {
          navigate('/dashboard');
        } else {
          navigate('/create-team');
        }
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>SQL Query Manager</CardTitle>
          <CardDescription>
            Sign in with your {ALLOWED_DOMAIN} email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="user@azdes.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="user@azdes.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
