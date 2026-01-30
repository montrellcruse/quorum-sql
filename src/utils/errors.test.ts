import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';

describe('Error Utilities', () => {
  describe('getErrorMessage', () => {
    it('returns message from Error instance', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('returns string error directly', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('returns message from object with message property', () => {
      const errorObj = { message: 'Object error message' };
      expect(getErrorMessage(errorObj)).toBe('Object error message');
    });

    it('returns fallback for null', () => {
      expect(getErrorMessage(null)).toBe('Something went wrong');
    });

    it('returns fallback for undefined', () => {
      expect(getErrorMessage(undefined)).toBe('Something went wrong');
    });

    it('returns fallback for empty string', () => {
      expect(getErrorMessage('')).toBe('Something went wrong');
    });

    it('returns fallback for whitespace-only string', () => {
      expect(getErrorMessage('   ')).toBe('Something went wrong');
    });

    it('returns fallback for Error with empty message', () => {
      const error = new Error('');
      expect(getErrorMessage(error)).toBe('Something went wrong');
    });

    it('returns fallback for object with empty message', () => {
      const errorObj = { message: '' };
      expect(getErrorMessage(errorObj)).toBe('Something went wrong');
    });

    it('returns fallback for object with whitespace message', () => {
      const errorObj = { message: '   ' };
      expect(getErrorMessage(errorObj)).toBe('Something went wrong');
    });

    it('returns fallback for object without message property', () => {
      const errorObj = { error: 'something', code: 500 };
      expect(getErrorMessage(errorObj)).toBe('Something went wrong');
    });

    it('returns fallback for number', () => {
      expect(getErrorMessage(123)).toBe('Something went wrong');
    });

    it('returns fallback for boolean', () => {
      expect(getErrorMessage(true)).toBe('Something went wrong');
      expect(getErrorMessage(false)).toBe('Something went wrong');
    });

    it('returns fallback for array', () => {
      expect(getErrorMessage(['error'])).toBe('Something went wrong');
    });

    it('uses custom fallback when provided', () => {
      expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
      expect(getErrorMessage(undefined, 'Another fallback')).toBe('Another fallback');
    });

    it('handles nested Error objects', () => {
      const nestedError = {
        message: 'Outer error',
        cause: new Error('Inner error'),
      };
      expect(getErrorMessage(nestedError)).toBe('Outer error');
    });

    it('handles object with non-string message property', () => {
      const errorObj = { message: 123 };
      expect(getErrorMessage(errorObj)).toBe('Something went wrong');
    });

    it('handles TypeError', () => {
      const error = new TypeError('Type mismatch');
      expect(getErrorMessage(error)).toBe('Type mismatch');
    });

    it('handles RangeError', () => {
      const error = new RangeError('Out of range');
      expect(getErrorMessage(error)).toBe('Out of range');
    });

    it('handles SyntaxError', () => {
      const error = new SyntaxError('Invalid syntax');
      expect(getErrorMessage(error)).toBe('Invalid syntax');
    });
  });
});
