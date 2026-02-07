import { z } from 'zod';

export type IdParams = { id: string };
export type TeamMemberParams = { id: string; memberId: string };
export type TeamIdQuery = { teamId: string; q?: string };
export type ApprovalsQuery = { teamId: string; excludeEmail?: string };
export type FolderPathsQuery = { teamId: string };

export const SetupSupabaseBodySchema = z.object({
  url: z.string().min(1),
  anonKey: z.string().min(1),
});
export type SetupSupabaseBody = z.infer<typeof SetupSupabaseBodySchema>;

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().optional(),
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const CreateTeamBodySchema = z.object({
  name: z.string().min(1).max(100),
  approval_quota: z.number().int().min(1).optional(),
});
export type CreateTeamBody = z.infer<typeof CreateTeamBodySchema>;

export const UpdateTeamBodySchema = z.object({
  approval_quota: z.number().int().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
});
export type UpdateTeamBody = z.infer<typeof UpdateTeamBodySchema>;

export const ConvertPersonalBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
});
export type ConvertPersonalBody = z.infer<typeof ConvertPersonalBodySchema>;

export const TransferOwnershipBodySchema = z.object({ new_owner_user_id: z.string().uuid() });
export type TransferOwnershipBody = z.infer<typeof TransferOwnershipBodySchema>;

export const UpdateMemberRoleBodySchema = z.object({ role: z.enum(['admin', 'member']) });
export type UpdateMemberRoleBody = z.infer<typeof UpdateMemberRoleBodySchema>;

export const CreateInviteBodySchema = z.object({
  invited_email: z.string().email(),
  role: z.enum(['admin', 'member']),
});
export type CreateInviteBody = z.infer<typeof CreateInviteBodySchema>;

export const CreateFolderBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  user_id: z.string().uuid().optional(),
  created_by_email: z.string().email().nullable().optional(),
  parent_folder_id: z.string().uuid().nullable().optional(),
  team_id: z.string().uuid(),
});
export type CreateFolderBody = z.infer<typeof CreateFolderBodySchema>;

export const UpdateFolderBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
});
export type UpdateFolderBody = z.infer<typeof UpdateFolderBodySchema>;

export const CreateQueryBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  sql_content: z.string().min(1).max(100000),
  status: z.enum(['draft', 'pending_approval', 'approved', 'rejected']).optional(),
  team_id: z.string().uuid(),
  folder_id: z.string().uuid().nullable().optional(),
  created_by_email: z.string().email().nullable().optional(),
  last_modified_by_email: z.string().email().nullable().optional(),
});
export type CreateQueryBody = z.infer<typeof CreateQueryBodySchema>;

export const UpdateQueryBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  sql_content: z.string().max(100000).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'rejected']).optional(),
  folder_id: z.string().uuid().nullable().optional(),
  last_modified_by_email: z.string().email().nullable().optional(),
});
export type UpdateQueryBody = z.infer<typeof UpdateQueryBodySchema>;

export const SubmitQueryBodySchema = z.object({
  sql: z.string().max(100000).optional().nullable(),
  modified_by_email: z.string().email().nullable().optional(),
  change_reason: z.string().max(500).nullable().optional(),
  team_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
});
export type SubmitQueryBody = z.infer<typeof SubmitQueryBodySchema>;

export const ApproveQueryBodySchema = z.object({ historyId: z.string().uuid() });
export type ApproveQueryBody = z.infer<typeof ApproveQueryBodySchema>;

export const RejectQueryBodySchema = z.object({
  historyId: z.string().uuid(),
  reason: z.string().max(500).nullable().optional(),
});
export type RejectQueryBody = z.infer<typeof RejectQueryBodySchema>;
