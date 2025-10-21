import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Signed out',
        description: 'Successfully signed out.',
      });
      navigate('/auth');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SQL Query Manager</h1>
            <p className="text-muted-foreground">Welcome back, {user.email}</p>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Organize your SQL queries</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Total projects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SQL Queries</CardTitle>
              <CardDescription>Store and manage queries</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Total queries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Track query changes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Total changes</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Your SQL query management system is ready</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>You can now:</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>Create projects to organize your queries</li>
              <li>Store SQL queries with titles and descriptions</li>
              <li>Track changes in query history</li>
              <li>Manage everything securely with your @example.com account</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
