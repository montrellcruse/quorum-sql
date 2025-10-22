import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const CreateTeam = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user) {
      checkTeamMembership();
    }
  }, [user, authLoading, navigate]);

  const checkTeamMembership = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', user?.id)
        .limit(1);

      if (error) throw error;

      // If user is already a member of a team, redirect to dashboard
      if (data && data.length > 0) {
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Error checking team membership:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teamName.trim()) {
      toast({
        title: 'Error',
        description: 'Team name is required',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        throw new Error('No valid session. Please sign in again.');
      }

      // Verify authentication
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !currentUser) {
        console.error('Auth error:', authError);
        throw new Error('Authentication required. Please sign in again.');
      }

      // Debug logging
      console.log('Creating team with user ID:', currentUser.id);
      console.log('Session expires at:', new Date(session.expires_at! * 1000));
      console.log('Current time:', new Date());
      console.log('Session token present:', !!session.access_token);

      // Verify user exists in profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', currentUser.id)
        .single();

      if (profileError || !profileData) {
        console.error('Profile error:', profileError);
        console.error('User ID:', currentUser.id);
        throw new Error('User profile not found. Please sign out and sign in again.');
      }

      console.log('Profile data:', profileData);

      // Create team with verified user ID
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamName.trim(),
          admin_id: currentUser.id,
          approval_quota: 1,
        })
        .select()
        .single();

      if (teamError) {
        console.error('Team creation error:', teamError);
        console.error('Attempted admin_id:', currentUser.id);
        throw teamError;
      }

      // Add user as admin member
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamData.id,
          user_id: currentUser.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      toast({
        title: 'Success',
        description: 'Team created successfully!',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your Team</CardTitle>
          <CardDescription>
            Welcome! Let's get started by creating your first team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                type="text"
                placeholder="My Awesome Team"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                disabled={creating}
              />
              <p className="text-sm text-muted-foreground">
                This will be the name of your workspace. You can change it later.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Team...
                </>
              ) : (
                'Create Team'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTeam;
