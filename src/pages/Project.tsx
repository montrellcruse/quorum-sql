import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, FileText } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Query {
  id: string;
  title: string;
  status: string;
  description: string | null;
  created_at: string;
}

const Project = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchProject();
      fetchQueries();
    }
  }, [user, id]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: 'Error',
          description: 'Project not found',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      setProject(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoadingProject(false);
    }
  };

  const fetchQueries = async () => {
    try {
      const { data, error } = await supabase
        .from('sql_queries')
        .select('id, title, status, description, created_at')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQueries(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingQueries(false);
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'default';
      case 'pending_approval':
        return 'secondary';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (loading || loadingProject || loadingQueries) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{project.name}</CardTitle>
            {project.description && (
              <CardDescription>{project.description}</CardDescription>
            )}
          </CardHeader>
        </Card>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">SQL Queries</h2>
          <Button onClick={() => navigate('/query/new', { state: { projectId: id } })}>
            <Plus className="mr-2 h-4 w-4" />
            New Query
          </Button>
        </div>

        {queries.length > 0 ? (
          <div className="space-y-4">
            {queries.map((query) => (
              <Card key={query.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{query.title}</CardTitle>
                        <Badge variant={getStatusVariant(query.status)}>
                          {query.status === 'pending_approval' ? 'Pending Approval' : query.status.charAt(0).toUpperCase() + query.status.slice(1)}
                        </Badge>
                      </div>
                      {query.description && (
                        <CardDescription className="mt-2">
                          {query.description}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      onClick={() => navigate(`/query/${query.id}`)}
                      variant="outline"
                    >
                      View/Edit
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Queries Yet</CardTitle>
              <CardDescription>
                Create your first SQL query to get started
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Project;
