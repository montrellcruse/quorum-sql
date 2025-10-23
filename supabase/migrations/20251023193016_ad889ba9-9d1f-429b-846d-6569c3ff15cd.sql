-- Add invited_by_user_id column to team_invitations
ALTER TABLE public.team_invitations 
ADD COLUMN invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_team_invitations_invited_by 
ON public.team_invitations(invited_by_user_id);

-- Add comment
COMMENT ON COLUMN public.team_invitations.invited_by_user_id 
IS 'User who sent the invitation';