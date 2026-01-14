export function getWorkspaceLabel(isSoloUser: boolean): string {
  return isSoloUser ? 'Workspace' : 'Team';
}

export function getMembersLabel(isSoloUser: boolean): string {
  return isSoloUser ? 'Collaborators' : 'Team Members';
}

export function getSettingsLabel(isSoloUser: boolean): string {
  return isSoloUser ? 'Workspace Settings' : 'Team Administration';
}
