import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useDbProvider } from '@/hooks/useDbProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { teamNameSchema } from '@/lib/validationSchemas';
import { getErrorMessage } from '@/utils/errors';

const CreateTeam = () => {
  const { user, loading: authLoading } = useAuth();
  const { refreshTeams } = useTeam();
  const { adapter } = useDbProvider();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = teamNameSchema.safeParse(teamName);
    if (!validation.success) {
      toast({
        title: 'Invalid Team Name',
        description: validation.error.issues[0].message,
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    try {
      await adapter.teams.create(validation.data, 1);

      toast({
        title: 'Success',
        description: 'Team created successfully!',
      });

      await refreshTeams();
      navigate('/dashboard');
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to create team');
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
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
                maxLength={100}
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
    </main>
  );
};

export default CreateTeam;
