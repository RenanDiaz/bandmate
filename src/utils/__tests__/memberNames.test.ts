import { describe, expect, it } from "vitest";
import { accountName, avatarUrl, initialsOf, isGoogleAccount, memberDisplayName, normalizeNickname } from "../memberNames";

describe("memberDisplayName", () => {
  it("nickname, then name, then email", () => {
    const meta = { full_name: "Carlos Pérez", name: "Carlos" };
    expect(memberDisplayName({ nickname: "Chino", user_metadata: meta, email: "c@x.com" })).toBe("Chino");
    expect(memberDisplayName({ nickname: null, user_metadata: meta, email: "c@x.com" })).toBe("Carlos Pérez");
    expect(memberDisplayName({ user_metadata: { name: "Carlos" }, email: "c@x.com" })).toBe("Carlos");
    expect(memberDisplayName({ user_metadata: {}, email: "c@x.com" })).toBe("c@x.com");
    expect(memberDisplayName({})).toBeNull();
  });

  it("ignores blank and non-string values", () => {
    expect(memberDisplayName({ nickname: "  ", user_metadata: { full_name: 3, name: " " }, email: "e@x.com" })).toBe(
      "e@x.com"
    );
  });
});

describe("accountName and avatarUrl", () => {
  it("reads Google's fields", () => {
    expect(accountName({ full_name: " Ana López " })).toBe("Ana López");
    expect(accountName({ name: "Ana" })).toBe("Ana");
    expect(accountName(null)).toBeNull();
    expect(avatarUrl({ avatar_url: "https://lh3.googleusercontent.com/a/x" })).toBe("https://lh3.googleusercontent.com/a/x");
    expect(avatarUrl({ avatar_url: "javascript:alert(1)" })).toBeNull();
    expect(avatarUrl({})).toBeNull();
  });
});

describe("initialsOf", () => {
  it("first and last word, one letter for one word or an email", () => {
    expect(initialsOf("Ana María López")).toBe("AL");
    expect(initialsOf("chino")).toBe("C");
    expect(initialsOf("ana@example.com")).toBe("A");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("normalizeNickname", () => {
  it("trims, clears on empty and enforces the limit", () => {
    expect(normalizeNickname("  Chino ")).toBe("Chino");
    expect(normalizeNickname("   ")).toBeNull();
    expect(normalizeNickname("x".repeat(40))).toHaveLength(40);
    expect(() => normalizeNickname("x".repeat(41))).toThrow("nickname-too-long");
  });
});

describe("isGoogleAccount", () => {
  it("reads providers, else provider", () => {
    expect(isGoogleAccount({ providers: ["email", "google"] })).toBe(true);
    expect(isGoogleAccount({ provider: "google" })).toBe(true);
    expect(isGoogleAccount({ providers: ["email"], provider: "google" })).toBe(false);
    expect(isGoogleAccount({ provider: "email" })).toBe(false);
    expect(isGoogleAccount(undefined)).toBe(false);
  });
});

