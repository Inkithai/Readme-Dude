/** Tiny safe wrapper: works in tests/node (no-op) and never throws on quota. */
const memory = new Map<string, string>();

const backing: Storage | null = (() => {
  try {
    if (typeof globalThis.localStorage !== "undefined") return globalThis.localStorage;
  } catch {
    /* Safari private mode throws on access — fall through */
  }
  return null;
})();

export const storage = {
  get(key: string): string | null {
    try {
      return backing ? backing.getItem(key) : (memory.get(key) ?? null);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      if (backing) backing.setItem(key, value);
      else memory.set(key, value);
    } catch {
      /* quota / disabled storage: autosave is best-effort, never fatal */
    }
  },
  remove(key: string): void {
    try {
      backing?.removeItem(key);
      memory.delete(key);
    } catch {
      /* ignore */
    }
  },
  get available(): boolean {
    return backing !== null;
  },
};
