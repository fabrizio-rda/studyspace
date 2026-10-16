import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(() => cleanup());
Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  value: function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  },
  writable: true,
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  value: function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  },
  writable: true,
});
Object.defineProperty(URL, "createObjectURL", {
  value: vi.fn(() => "blob:studyspace-test"),
  writable: true,
});
Object.defineProperty(URL, "revokeObjectURL", {
  value: vi.fn(),
  writable: true,
});
Object.defineProperty(window, "matchMedia", {
  value: () => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
});

const heldLocks = new Set<string>();
Object.defineProperty(navigator, "locks", {
  configurable: true,
  value: {
    request: async (
      name: string,
      _options: unknown,
      callback: (lock: object | null) => Promise<void>,
    ) => {
      await Promise.resolve();
      if (heldLocks.has(name)) return callback(null);
      heldLocks.add(name);
      try {
        await callback({ name });
      } finally {
        heldLocks.delete(name);
      }
    },
  },
});
