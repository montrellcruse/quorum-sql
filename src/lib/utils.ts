import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize error messages to avoid exposing internal details to users.
 * Filters out SQL errors, connection errors, and stack traces.
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    // Don't expose internal database or connection errors
    if (
      message.includes('SQL') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('connection') ||
      message.includes('database') ||
      message.includes('query failed')
    ) {
      return 'An unexpected error occurred. Please try again.';
    }
    // Return the message if it's user-safe
    return message;
  }
  return 'An unexpected error occurred.';
}

/**
 * Format a date string or Date object consistently across the app.
 * Uses the browser's locale for localization.
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return new Date(date).toLocaleDateString(navigator.language, {
    ...defaultOptions,
    ...options,
  });
}

/**
 * Format a date with time.
 */
export function formatDateTime(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(date).toLocaleString(navigator.language, {
    ...defaultOptions,
    ...options,
  });
}
