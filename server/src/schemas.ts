import { z } from 'zod';

export type IdParams = { id: string };
export type TeamMemberParams = { id: string; memberId: string };
export type PaginationQuery = { limit?: string; offset?: string };
export type TeamIdQuery = PaginationQuery & { teamId: string; q?: string };
export type ApprovalsQuery = { teamId: string; excludeEmail?: string };
export type FolderPathsQuery = { teamId: string };

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ParsedPaginationQuery = z.infer<typeof PaginationQuerySchema>;

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

const COMMON_PASSWORD_BLOCKLIST = new Set([
  '123456',
  'password',
  '123456789',
  '12345',
  '12345678',
  'qwerty',
  '1234567',
  '111111',
  '123123',
  'abc123',
  'qwerty123',
  '1q2w3e4r',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'iloveyou',
  'master',
  'sunshine',
  'princess',
  'shadow',
  'passw0rd',
  '654321',
  'superman',
  'qazwsx',
  'trustno1',
  'hello',
  'freedom',
  'whatever',
  'starwars',
  'login',
  'secret',
  'flower',
  'jordan',
  'harley',
  'batman',
  'soccer',
  'killer',
  'george',
  'michael',
  'michelle',
  'andrew',
  'thomas',
  'buster',
  'tigger',
  'internet',
  'computer',
  'snoopy',
  'cookie',
  'naruto',
  'pokemon',
  'summer',
  'winter',
  'spring',
  'autumn',
  'test123',
  'changeme',
  'default',
  '11111111',
  '000000',
  '888888',
  '987654321',
  '112233',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  '1qaz2wsx',
  'qwe123',
  'zaq1zaq1',
  'pass1234',
  'welcome1',
  '123321',
  'myspace1',
  'access',
  'administrator',
  'root',
  'solo',
  'q1w2e3r4t5',
  '1q2w3e4r5t',
  '123qwe',
  'qweasdzxc',
  'password1',
  'password123',
  'admin123',
  'user',
  'guest',
  'temp123',
  'football1',
  'baseball1',
  'aaaaaa',
  'lol123',
  '123abc',
  'qazwsxedc',
  '!qaz2wsx',
  'p@ssw0rd',
  '121212',
  '159753',
]);

const RegisterPasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter')
  .regex(/[0-9]/, 'Password must include at least one number')
  .regex(/[^A-Za-z0-9\s]/, 'Password must include at least one special character')
  .refine(password => !COMMON_PASSWORD_BLOCKLIST.has(password.toLowerCase()), {
    message: 'Password is too common. Please choose a stronger password',
  });

export const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: RegisterPasswordSchema,
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
