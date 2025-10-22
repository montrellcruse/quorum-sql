-- Create team_invitations table
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, invited_email)
);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_invitations

-- Team admins can view invitations for their teams
CREATE POLICY "Team admins can view invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (team_id IN (SELECT user_admin_teams(auth.uid())));

-- Team admins can create invitations for their teams
CREATE POLICY "Team admins can create invitations"
ON public.team_invitations
FOR INSERT
TO authenticated
WITH CHECK (team_id IN (SELECT user_admin_teams(auth.uid())));

-- Team admins can update invitations for their teams
CREATE POLICY "Team admins can update invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (team_id IN (SELECT user_admin_teams(auth.uid())));

-- Team admins can delete invitations for their teams
CREATE POLICY "Team admins can delete invitations"
ON public.team_invitations
FOR DELETE
TO authenticated
USING (team_id IN (SELECT user_admin_teams(auth.uid())));

-- Users can view pending invitations for their email
CREATE POLICY "Users can view their own pending invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (invited_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()) AND status = 'pending');

-- Users can update their own pending invitations (to accept them)
CREATE POLICY "Users can update their own pending invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (invited_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()) AND status = 'pending');

-- Add trigger for updated_at
CREATE TRIGGER update_team_invitations_updated_at
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to process pending invitations for a user
CREATE OR REPLACE FUNCTION public.process_pending_invitations(_user_id UUID)
RETURNS TABLE (
  processed_count INTEGER,
  team_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_email TEXT;
  _invitation RECORD;
  _processed_count INTEGER := 0;
  _team_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Get user email
  SELECT email INTO _user_email
  FROM profiles
  WHERE user_id = _user_id;
  
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Process all pending invitations for this email
  FOR _invitation IN
    SELECT id, team_id, role
    FROM team_invitations
    WHERE invited_email = _user_email
      AND status = 'pending'
  LOOP
    -- Add user to team (ignore if already exists)
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (_invitation.team_id, _user_id, _invitation.role)
    ON CONFLICT (team_id, user_id) DO NOTHING;
    
    -- Update invitation status
    UPDATE team_invitations
    SET status = 'accepted', updated_at = now()
    WHERE id = _invitation.id;
    
    _processed_count := _processed_count + 1;
    _team_ids := array_append(_team_ids, _invitation.team_id);
  END LOOP;
  
  RETURN QUERY SELECT _processed_count, _team_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pending_invitations TO authenticated;