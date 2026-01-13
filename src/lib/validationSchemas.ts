import { z } from 'zod';

// Environment variable for allowed email domain
const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || '';

/**
 * Email validation schema with domain restriction
 */
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" })
  .refine(
    (email) => {
      // Only allow test accounts in development mode
      if (import.meta.env.DEV && email.endsWith('@test.dev')) return true;
      if (!ALLOWED_DOMAIN) return true; // No restriction if not configured
      return email.endsWith(`@${ALLOWED_DOMAIN}`);
    },
    {
      message: ALLOWED_DOMAIN
        ? `Email must be from ${ALLOWED_DOMAIN} domain`
        : "Invalid email domain"
    }
  );

/**
 * Team name validation schema
 */
export const teamNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Team name cannot be empty" })
  .max(100, { message: "Team name must be less than 100 characters" })
  .regex(/^[a-zA-Z0-9\s\-_]+$/, { 
    message: "Team name can only contain letters, numbers, spaces, hyphens, and underscores" 
  });

/**
 * Folder validation schema
 */
export const folderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Folder name cannot be empty" })
    .max(100, { message: "Folder name must be less than 100 characters" }),
  description: z
    .string()
    .max(500, { message: "Description must be less than 500 characters" })
    .optional()
    .or(z.literal('')),
});

/**
 * SQL content validation schema
 */
export const sqlContentSchema = z
  .string()
  .trim()
  .min(1, { message: "SQL content cannot be empty" })
  .max(100000, { message: "SQL content exceeds maximum length of 100KB" });

/**
 * Query validation schema
 */
export const querySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Query title cannot be empty" })
    .max(200, { message: "Query title must be less than 200 characters" }),
  description: z
    .string()
    .max(1000, { message: "Description must be less than 1000 characters" })
    .optional()
    .or(z.literal('')),
  sql_content: sqlContentSchema,
});

/**
 * Change reason validation schema (for approvals)
 */
export const changeReasonSchema = z
  .string()
  .max(1000, { message: "Change reason must be less than 1000 characters" })
  .optional()
  .or(z.literal(''));

/**
 * Dangerous SQL patterns that should trigger warnings
 */
export const DANGEROUS_SQL_PATTERNS = [
  { pattern: /\bDROP\s+(DATABASE|SCHEMA|TABLE|INDEX|VIEW)\b/i, message: "DROP operations can permanently delete data" },
  { pattern: /\bTRUNCATE\b/i, message: "TRUNCATE removes all rows from tables" },
  { pattern: /\bALTER\s+DATABASE\b/i, message: "ALTER DATABASE can affect system configuration" },
  { pattern: /\bDELETE\s+FROM\s+\w+\s*;?\s*$/i, message: "DELETE without WHERE clause removes all rows" },
  { pattern: /\bpg_read_file\b/i, message: "pg_read_file() can access server files" },
  { pattern: /\bpg_write_file\b/i, message: "pg_write_file() can modify server files" },
  { pattern: /\bpg_execute_server_program\b/i, message: "pg_execute_server_program() can run system commands" },
  { pattern: /\bCOPY\s+.+\s+FROM\s+PROGRAM\b/i, message: "COPY FROM PROGRAM can execute system commands" },
  { pattern: /\bCOPY\s+.+\s+TO\s+PROGRAM\b/i, message: "COPY TO PROGRAM can execute system commands" },
  { pattern: /\bGRANT\s+ALL\b/i, message: "GRANT ALL gives unrestricted privileges" },
  { pattern: /\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b/i, message: "Function creation can introduce security risks" },
] as const;

/**
 * Validates SQL content for dangerous patterns that could harm the database.
 * Checks for DROP, TRUNCATE, file operations, and privilege escalation commands.
 * @param content - SQL content to validate
 * @returns Object with hasDangerousPatterns flag and array of warning messages
 * @example
 * const { hasDangerousPatterns, warnings } = validateSqlSafety('DROP TABLE users;');
 * // hasDangerousPatterns: true
 * // warnings: ['DROP operations can permanently delete data']
 */
export function validateSqlSafety(content: string): {
  hasDangerousPatterns: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  for (const { pattern, message } of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push(message);
    }
  }
  
  return {
    hasDangerousPatterns: warnings.length > 0,
    warnings,
  };
}

/**
 * Full name validation schema
 */
export const fullNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name cannot be empty" })
  .max(100, { message: "Name must be less than 100 characters" })
  .regex(/^[a-zA-Z\s\-']+$/, { 
    message: "Name can only contain letters, spaces, hyphens, and apostrophes" 
  });

/**
 * Generic text field validation
 */
export const textFieldSchema = (fieldName: string, maxLength: number = 255) =>
  z
    .string()
    .trim()
    .max(maxLength, { message: `${fieldName} must be less than ${maxLength} characters` });
