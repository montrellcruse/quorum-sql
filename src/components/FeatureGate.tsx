import { ReactNode } from 'react';
import { useSoloUser, type SoloUserContext } from '@/hooks/useSoloUser';

interface FeatureGateProps {
  /** Show only for solo users */
  soloOnly?: boolean;
  /** Show only for team users (2+ members) */
  teamOnly?: boolean;
  /** Optional team id override */
  teamId?: string;
  /** Optional personal team flag override */
  isPersonalTeam?: boolean;
  /** Optional precomputed solo user context */
  soloContext?: SoloUserContext;
  /** Children to render when condition met */
  children: ReactNode;
  /** Fallback to render when condition not met */
  fallback?: ReactNode;
}

export function FeatureGate({
  soloOnly,
  teamOnly,
  teamId,
  isPersonalTeam,
  soloContext,
  children,
  fallback = null,
}: FeatureGateProps) {
  const fallbackContext = useSoloUser(
    soloContext ? { teamId: null } : { teamId, isPersonalTeam }
  );
  const { isSoloUser, loading } = soloContext ?? fallbackContext;

  if (loading) return null;

  if (soloOnly && !isSoloUser) return <>{fallback}</>;
  if (teamOnly && isSoloUser) return <>{fallback}</>;

  return <>{children}</>;
}
