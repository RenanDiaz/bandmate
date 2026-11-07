import { describe, expect, it } from "vitest";
import {
  SIGN_IN_HELP_COOLDOWN_MS,
  buildSignInHelpEmail,
  checkSignInHelpQuota,
  escapeHtml,
  normalizeSignInHelpLocale,
  signInMethods,
} from "../../../supabase/functions/_shared/signInHelp";
import type { SignInHelpInput } from "../../../supabase/functions/_shared/signInHelp";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function input(overrides: Partial<SignInHelpInput> = {}): SignInHelpInput {
  return {
    locale: "es",
    bandName: "Los Tigres",
    senderName: "Renán",
    recipientEmail: "ana@gmail.com",
    methods: ["google"],
    appUrl: "https://www.bandmate.space",
    ...overrides,
  };
}

describe("sign-in help email", () => {
  it("normalises locales", () => {
    expect(normalizeSignInHelpLocale("es-PA")).toBe("es");
    expect(normalizeSignInHelpLocale("en-US")).toBe("en");
    expect(normalizeSignInHelpLocale(undefined)).toBe("en");
  });

  it("reads known sign-in methods from app_metadata", () => {
    expect(signInMethods({ provider: "email", providers: ["email", "google"] })).toEqual([
      "google",
      "email",
    ]);
    expect(signInMethods({ provider: "google" })).toEqual(["google"]);
    expect(signInMethods({ providers: ["apple"] })).toEqual([]);
    expect(signInMethods(null)).toEqual([]);
  });

  it("names the Google account and links to /login", () => {
    const email = buildSignInHelpEmail(input({ appUrl: "https://www.bandmate.space/" }));
    expect(email.subject).toBe("Cómo entrar a Bandmate — Los Tigres");
    expect(email.loginUrl).toBe("https://www.bandmate.space/login");
    expect(email.text).toContain("«Continuar con Google»");
    expect(email.text).toContain("ana@gmail.com");
    expect(email.text).toContain("Renán te envió este correo");
    expect(email.html).toContain('href="https://www.bandmate.space/login"');
    expect(email.html).toContain('lang="es"');
  });

  it("lists every method when the account has several, and a fallback for none", () => {
    const several = buildSignInHelpEmail(input({ locale: "en", methods: ["google", "email"] }));
    expect(several.text).toContain("Any of these works:");
    expect(several.text).toContain("Continue with Google");
    expect(several.text).toContain("Bandmate password");

    const none = buildSignInHelpEmail(input({ locale: "en", methods: [] }));
    expect(none.text).toContain("same option you used the first time");
  });

  it("escapes names in the HTML and falls back for an empty sender", () => {
    const email = buildSignInHelpEmail(
      input({ locale: "en", bandName: "<script>x</script>", senderName: "  " })
    );
    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(email.text).toContain("A bandmate sent you this");
    expect(escapeHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
  });
});

describe("sign-in help quota", () => {
  it("allows the first email", () => {
    expect(checkSignInHelpQuota([], NOW)).toEqual({ ok: true });
  });

  it("waits 10 minutes between two emails", () => {
    expect(checkSignInHelpQuota([ago(4 * MIN)], NOW)).toEqual({
      ok: false,
      retryAfterSeconds: (SIGN_IN_HELP_COOLDOWN_MS - 4 * MIN) / 1000,
    });
    expect(checkSignInHelpQuota([ago(10 * MIN)], NOW)).toEqual({ ok: true });
  });

  it("allows three per 24 h, then waits for the oldest to leave the window", () => {
    const three = [ago(20 * HOUR), ago(2 * HOUR), ago(1 * HOUR)];
    expect(checkSignInHelpQuota(three, NOW)).toEqual({ ok: false, retryAfterSeconds: 4 * 3600 });
    expect(checkSignInHelpQuota([ago(25 * HOUR), ago(2 * HOUR), ago(1 * HOUR)], NOW)).toEqual({
      ok: true,
    });
  });

  it("ignores unreadable timestamps", () => {
    expect(checkSignInHelpQuota(["nope"], NOW)).toEqual({ ok: true });
  });
});
