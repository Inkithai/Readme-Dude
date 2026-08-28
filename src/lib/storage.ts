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
  /**
   * False means the bytes never landed (quota, private mode, disabled storage).
   * The caller has to be able to tell — an autosave that reports "saved" after a
   * failed write is worse than one that admits it, because the user closes the
   * tab believing there is something to come back to.
   */
  set(key: string, value: string): boolean {
    try {
      if (backing) backing.setItem(key, value);
      else memory.set(key, value);
      return true;
    } catch {
      /* quota / disabled storage: autosave is best-effort, never fatal */
      return false;
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
