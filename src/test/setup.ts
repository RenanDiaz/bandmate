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
