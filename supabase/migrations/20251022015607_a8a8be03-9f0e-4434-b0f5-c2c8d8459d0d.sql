-- Create a security definer function to verify user can create team
CREATE OR REPLACE FUNCTION public.can_create_team(_admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _admin_id = auth.uid() AND auth.uid() IS NOT NULL;
$$;

-- Drop and recreate the team creation policy using the function
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;

CREATE POLICY "Authenticated users can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (public.can_create_team(admin_id));
