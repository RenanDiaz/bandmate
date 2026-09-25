import "fake-indexeddb/auto";
import { vi } from "vitest";

// Tests never reach Supabase (and CI has no VITE_SUPABASE_URL): the offline
// service imports the data services, which import the client. A test that needs
// behaviour mocks the service functions, or this module, itself.
vi.mock("../lib/supabaseClient", () => ({ supabase: { auth: {} } }));

/** Minimal in-memory localStorage: Node has none, and the offline wipe clears keys from it. */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true });

/**
 * Minimal Web Locks fake (exclusive locks, FIFO queue, `ifAvailable`), always
 * installed so the download engine's cross-tab lock (race rule 4) behaves the
 * same on every Node version: Node 22 has no `navigator.locks`, Node 24's
 * native one would otherwise be used there only.
 */
class FakeLockManager {
  private held = new Set<string>();
  private queues = new Map<string, Array<() => void>>();

  async request<T>(
    name: string,
    optionsOrCallback: { ifAvailable?: boolean } | ((lock: { name: string } | null) => Promise<T> | T),
    maybeCallback?: (lock: { name: string } | null) => Promise<T> | T
  ): Promise<T> {
    const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
    const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback)!;
    if (this.held.has(name)) {
      if (options.ifAvailable) return callback(null);
      await new Promise<void>((resolve) => {
        const queue = this.queues.get(name) ?? [];
        queue.push(resolve);
        this.queues.set(name, queue);
      });
    }
    this.held.add(name);
    try {
      return await callback({ name });
    } finally {
      const next = this.queues.get(name)?.shift();
      if (next) next();
      else this.held.delete(name);
    }
  }
}

Object.defineProperty(globalThis.navigator, "locks", { value: new FakeLockManager(), configurable: true });
