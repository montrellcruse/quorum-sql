import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reducer } from './use-toast';

describe('Toast Reducer', () => {
  describe('ADD_TOAST', () => {
    it('adds a new toast to the beginning of the list', () => {
      const initialState = { toasts: [] };
      const newToast = { id: '1', title: 'Test Toast', open: true };

      const result = reducer(initialState, {
        type: 'ADD_TOAST',
        toast: newToast,
      });

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0]).toEqual(newToast);
    });

    it('prepends new toast to existing toasts', () => {
      const existingToast = { id: '1', title: 'Existing', open: true };
      const initialState = { toasts: [existingToast] };
      const newToast = { id: '2', title: 'New Toast', open: true };

      const result = reducer(initialState, {
        type: 'ADD_TOAST',
        toast: newToast,
      });

      expect(result.toasts).toHaveLength(1); // TOAST_LIMIT is 1
      expect(result.toasts[0]).toEqual(newToast);
    });

    it('limits toasts to TOAST_LIMIT', () => {
      const initialState = { toasts: [] };

      let state = initialState;
      for (let i = 0; i < 5; i++) {
        state = reducer(state, {
          type: 'ADD_TOAST',
          toast: { id: String(i), title: `Toast ${i}`, open: true },
        });
      }

      // TOAST_LIMIT is 1, so only the last toast should remain
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBe('4');
    });
  });

  describe('UPDATE_TOAST', () => {
    it('updates an existing toast', () => {
      const existingToast = { id: '1', title: 'Original', open: true };
      const initialState = { toasts: [existingToast] };

      const result = reducer(initialState, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated' },
      });

      expect(result.toasts[0].title).toBe('Updated');
      expect(result.toasts[0].open).toBe(true); // Should preserve other properties
    });

    it('does not modify other toasts', () => {
      const toast1 = { id: '1', title: 'Toast 1', open: true };
      const toast2 = { id: '2', title: 'Toast 2', open: true };
      const initialState = { toasts: [toast1, toast2] };

      const result = reducer(initialState, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated' },
      });

      expect(result.toasts.find((t) => t.id === '2')?.title).toBe('Toast 2');
    });

    it('handles updating non-existent toast', () => {
      const existingToast = { id: '1', title: 'Existing', open: true };
      const initialState = { toasts: [existingToast] };

      const result = reducer(initialState, {
        type: 'UPDATE_TOAST',
        toast: { id: 'non-existent', title: 'Updated' },
      });

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].title).toBe('Existing');
    });
  });

  describe('DISMISS_TOAST', () => {
    it('sets open to false for specific toast', () => {
      const toast = { id: '1', title: 'Toast', open: true };
      const initialState = { toasts: [toast] };

      const result = reducer(initialState, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      });

      expect(result.toasts[0].open).toBe(false);
    });

    it('dismisses all toasts when no toastId provided', () => {
      const toast1 = { id: '1', title: 'Toast 1', open: true };
      const toast2 = { id: '2', title: 'Toast 2', open: true };
      const initialState = { toasts: [toast1, toast2] };

      const result = reducer(initialState, {
        type: 'DISMISS_TOAST',
        toastId: undefined,
      });

      expect(result.toasts.every((t) => t.open === false)).toBe(true);
    });

    it('preserves other toast properties', () => {
      const toast = {
        id: '1',
        title: 'Toast',
        description: 'Description',
        open: true,
      };
      const initialState = { toasts: [toast] };

      const result = reducer(initialState, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      });

      expect(result.toasts[0].title).toBe('Toast');
      expect(result.toasts[0].description).toBe('Description');
    });
  });

  describe('REMOVE_TOAST', () => {
    it('removes specific toast', () => {
      const toast1 = { id: '1', title: 'Toast 1', open: true };
      const toast2 = { id: '2', title: 'Toast 2', open: true };
      const initialState = { toasts: [toast1, toast2] };

      const result = reducer(initialState, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      });

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2');
    });

    it('removes all toasts when no toastId provided', () => {
      const toast1 = { id: '1', title: 'Toast 1', open: true };
      const toast2 = { id: '2', title: 'Toast 2', open: true };
      const initialState = { toasts: [toast1, toast2] };

      const result = reducer(initialState, {
        type: 'REMOVE_TOAST',
        toastId: undefined,
      });

      expect(result.toasts).toHaveLength(0);
    });

    it('handles removing non-existent toast', () => {
      const toast = { id: '1', title: 'Toast', open: true };
      const initialState = { toasts: [toast] };

      const result = reducer(initialState, {
        type: 'REMOVE_TOAST',
        toastId: 'non-existent',
      });

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('1');
    });
  });

  describe('state immutability', () => {
    it('does not mutate original state on ADD_TOAST', () => {
      const initialState = { toasts: [] };
      const originalToasts = initialState.toasts;

      reducer(initialState, {
        type: 'ADD_TOAST',
        toast: { id: '1', title: 'Test', open: true },
      });

      expect(initialState.toasts).toBe(originalToasts);
      expect(initialState.toasts).toHaveLength(0);
    });

    it('does not mutate original state on UPDATE_TOAST', () => {
      const toast = { id: '1', title: 'Original', open: true };
      const initialState = { toasts: [toast] };

      reducer(initialState, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated' },
      });

      expect(initialState.toasts[0].title).toBe('Original');
    });

    it('does not mutate original state on DISMISS_TOAST', () => {
      const toast = { id: '1', title: 'Toast', open: true };
      const initialState = { toasts: [toast] };

      reducer(initialState, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      });

      expect(initialState.toasts[0].open).toBe(true);
    });

    it('does not mutate original state on REMOVE_TOAST', () => {
      const toast = { id: '1', title: 'Toast', open: true };
      const initialState = { toasts: [toast] };
      const originalToasts = initialState.toasts;

      reducer(initialState, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      });

      expect(initialState.toasts).toBe(originalToasts);
      expect(initialState.toasts).toHaveLength(1);
    });
  });
});
