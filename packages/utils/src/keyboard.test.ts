import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isCommandPressed } from './keyboard';

vi.mock('./platform', () => ({
  isMacOS: vi.fn(),
}));

import { isMacOS } from './platform';

describe('keyboard', () => {
  describe('isCommandPressed', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return metaKey value on macOS when metaKey is pressed', () => {
      vi.mocked(isMacOS).mockReturnValue(true);

      const event = { metaKey: true, ctrlKey: false } as KeyboardEvent;
      expect(isCommandPressed(event)).toBe(true);
    });

    it('should return metaKey value on macOS when metaKey is not pressed', () => {
      vi.mocked(isMacOS).mockReturnValue(true);

      const event = { metaKey: false, ctrlKey: true } as KeyboardEvent;
      expect(isCommandPressed(event)).toBe(false);
    });

    it('should return ctrlKey value on Windows/Linux when ctrlKey is pressed', () => {
      vi.mocked(isMacOS).mockReturnValue(false);

      const event = { metaKey: false, ctrlKey: true } as KeyboardEvent;
      expect(isCommandPressed(event)).toBe(true);
    });

    it('should return ctrlKey value on Windows/Linux when ctrlKey is not pressed', () => {
      vi.mocked(isMacOS).mockReturnValue(false);

      const event = { metaKey: true, ctrlKey: false } as KeyboardEvent;
      expect(isCommandPressed(event)).toBe(false);
    });

    it('should return false on macOS when neither metaKey nor ctrlKey is pressed', () => {
      vi.mocked(isMacOS).mockReturnValue(true);

      const event = { metaKey: false, ctrlKey: false } as KeyboardEvent;
      expect(isCommandPressed(event)).toBe(false);
    });

    it('should return false on non-macOS when neither metaKey nor ctrlKey is pressed', () => {
      vi.mocked(isMacOS).mockReturnValue(false);

      const event = { metaKey: false, ctrlKey: false } as KeyboardEvent;
      expect(isCommandPressed(event)).toBe(false);
    });

    it('should use metaKey (not ctrlKey) on macOS even when both keys are pressed', () => {
      vi.mocked(isMacOS).mockReturnValue(true);

      const event = { metaKey: true, ctrlKey: true } as KeyboardEvent;
      // On macOS, metaKey (Command) is used — both are true here, result is true
      expect(isCommandPressed(event)).toBe(true);
    });

    it('should use ctrlKey (not metaKey) on non-macOS even when both keys are pressed', () => {
      vi.mocked(isMacOS).mockReturnValue(false);

      const event = { metaKey: true, ctrlKey: true } as KeyboardEvent;
      // On non-macOS, ctrlKey is used — both are true here, result is true
      expect(isCommandPressed(event)).toBe(true);
    });
  });
});
