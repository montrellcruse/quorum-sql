import { describe, it, expect } from 'vitest';
import { normalizeAllowedDomain, isEmailAllowed } from './email';

describe('Email Utilities', () => {
  describe('normalizeAllowedDomain', () => {
    it('adds @ prefix if missing', () => {
      expect(normalizeAllowedDomain('example.com')).toBe('@example.com');
    });

    it('keeps @ prefix if present', () => {
      expect(normalizeAllowedDomain('@example.com')).toBe('@example.com');
    });

    it('converts to lowercase', () => {
      expect(normalizeAllowedDomain('EXAMPLE.COM')).toBe('@example.com');
      expect(normalizeAllowedDomain('@EXAMPLE.COM')).toBe('@example.com');
    });

    it('trims whitespace', () => {
      expect(normalizeAllowedDomain('  example.com  ')).toBe('@example.com');
      expect(normalizeAllowedDomain('  @example.com  ')).toBe('@example.com');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeAllowedDomain('')).toBe('');
      expect(normalizeAllowedDomain('   ')).toBe('');
    });

    it('handles complex domain names', () => {
      expect(normalizeAllowedDomain('sub.example.co.uk')).toBe('@sub.example.co.uk');
    });
  });

  describe('isEmailAllowed', () => {
    it('returns true when email ends with allowed domain', () => {
      expect(isEmailAllowed('user@example.com', '@example.com')).toBe(true);
      expect(isEmailAllowed('user@example.com', 'example.com')).toBe(true);
    });

    it('returns false when email does not end with allowed domain', () => {
      expect(isEmailAllowed('user@other.com', '@example.com')).toBe(false);
      expect(isEmailAllowed('user@other.com', 'example.com')).toBe(false);
    });

    it('returns true when allowed domain is empty (no restriction)', () => {
      expect(isEmailAllowed('user@any.com', '')).toBe(true);
      expect(isEmailAllowed('user@example.com', '')).toBe(true);
    });

    it('is case-insensitive for email', () => {
      expect(isEmailAllowed('USER@EXAMPLE.COM', '@example.com')).toBe(true);
      expect(isEmailAllowed('User@Example.Com', 'example.com')).toBe(true);
    });

    it('handles subdomains correctly', () => {
      // User with subdomain should not match base domain
      expect(isEmailAllowed('user@sub.example.com', '@example.com')).toBe(false);

      // But should match the subdomain
      expect(isEmailAllowed('user@sub.example.com', '@sub.example.com')).toBe(true);
    });

    it('handles edge cases', () => {
      // Email that contains the domain but doesn't end with it
      expect(isEmailAllowed('example.com@other.com', '@example.com')).toBe(false);
    });
  });
});
