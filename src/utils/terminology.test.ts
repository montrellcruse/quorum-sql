import { describe, it, expect } from 'vitest';
import { getWorkspaceLabel, getMembersLabel, getSettingsLabel } from './terminology';

describe('Terminology Utilities', () => {
  describe('getWorkspaceLabel', () => {
    it('returns "Workspace" for solo users', () => {
      expect(getWorkspaceLabel(true)).toBe('Workspace');
    });

    it('returns "Team" for team users', () => {
      expect(getWorkspaceLabel(false)).toBe('Team');
    });
  });

  describe('getMembersLabel', () => {
    it('returns "Collaborators" for solo users', () => {
      expect(getMembersLabel(true)).toBe('Collaborators');
    });

    it('returns "Team Members" for team users', () => {
      expect(getMembersLabel(false)).toBe('Team Members');
    });
  });

  describe('getSettingsLabel', () => {
    it('returns "Workspace Settings" for solo users', () => {
      expect(getSettingsLabel(true)).toBe('Workspace Settings');
    });

    it('returns "Team Administration" for team users', () => {
      expect(getSettingsLabel(false)).toBe('Team Administration');
    });
  });
});
