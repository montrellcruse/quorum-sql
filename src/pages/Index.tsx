import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to setup wizard if Supabase is not configured
    if (!isSupabaseConfigured()) {
      navigate('/setup');
      return;
    }

    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Quorum</h1>
        <p className="text-xl text-muted-foreground">
          Organize and manage your SQL queries securely
        </p>
        <Button size="lg" onClick={() => navigate('/auth')}>
          Get Started
        </Button>
      </div>
    </main>
  );
};

export default Index;
