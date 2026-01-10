-- Create projects table for query organization
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sql_queries table for query storage
CREATE TABLE public.sql_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sql_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create query_history table for change tracking
CREATE TABLE public.query_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID NOT NULL REFERENCES public.sql_queries(id) ON DELETE CASCADE,
  sql_content TEXT NOT NULL,
  modified_by_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sql_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects table
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for sql_queries table
CREATE POLICY "Users can view their own queries"
  ON public.sql_queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own queries"
  ON public.sql_queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queries"
  ON public.sql_queries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queries"
  ON public.sql_queries FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for query_history table
CREATE POLICY "Users can view history for their queries"
  ON public.query_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sql_queries
      WHERE sql_queries.id = query_history.query_id
      AND sql_queries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create history for their queries"
  ON public.query_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sql_queries
      WHERE sql_queries.id = query_history.query_id
      AND sql_queries.user_id = auth.uid()
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sql_queries_updated_at
  BEFORE UPDATE ON public.sql_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();