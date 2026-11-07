/**
 * "How to sign in" email for a band member (docs/specs/member-sign-in-help.md),
 * shared by the `send-sign-in-help` Edge Function (Deno).
 *
 * Keep this file dependency-free and runtime-neutral: no imports, no Deno or
 * DOM APIs. It is unit-tested from `src/lib/__tests__/signInHelp.test.ts`.
 */

export type SignInHelpLocale = "en" | "es";

/** Sign-in methods we can name. Anything else reads as "unknown". */
export type SignInMethod = "google" | "github" | "email";

/** Minimum time between two emails to the same person (any band). */
export const SIGN_IN_HELP_COOLDOWN_MS = 10 * 60 * 1000;
/** At most this many emails to the same person in 24 h (any band). */
export const SIGN_IN_HELP_DAILY_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeSignInHelpLocale(value: unknown): SignInHelpLocale {
  return typeof value === "string" && value.toLowerCase().startsWith("es") ? "es" : "en";
}

/**
 * The methods the account can sign in with, from `auth.users.app_metadata`
 * (`providers` array, else the single `provider`). Known ones only, in a
 * stable order, without duplicates.
 */
export function signInMethods(appMetadata: unknown): SignInMethod[] {
  const meta = (appMetadata && typeof appMetadata === "object" ? appMetadata : {}) as Record<
    string,
    unknown
  >;
  const raw: unknown[] = Array.isArray(meta.providers)
    ? meta.providers
    : typeof meta.provider === "string"
      ? [meta.provider]
      : [];
  const known: SignInMethod[] = ["google", "github", "email"];
  return known.filter((method) => raw.includes(method));
}

export type QuotaResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Whether another email may go to this person now. `sentAt` holds the ISO
 * timestamps of earlier emails to them (any order; older than a day ignored).
 */
export function checkSignInHelpQuota(sentAt: string[], now: number): QuotaResult {
  const times = sentAt
    .map((value) => Date.parse(value))
    .filter((time) => Number.isFinite(time) && time > now - DAY_MS && time <= now)
    .sort((a, b) => a - b);

  const last = times[times.length - 1];
  if (last !== undefined && now - last < SIGN_IN_HELP_COOLDOWN_MS) {
    return { ok: false, retryAfterSeconds: Math.ceil((last + SIGN_IN_HELP_COOLDOWN_MS - now) / 1000) };
  }
  if (times.length >= SIGN_IN_HELP_DAILY_LIMIT) {
    // The oldest email of the window has to leave it first.
    const oldest = times[times.length - SIGN_IN_HELP_DAILY_LIMIT];
    return { ok: false, retryAfterSeconds: Math.ceil((oldest + DAY_MS - now) / 1000) };
  }
  return { ok: true };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MAX_NAME = 80;

function clip(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > MAX_NAME ? `${trimmed.slice(0, MAX_NAME - 1)}…` : trimmed;
}

export interface SignInHelpInput {
  locale: SignInHelpLocale;
  bandName: string;
  /** Display name (or email) of the owner who sent it; "" falls back. */
  senderName: string;
  recipientEmail: string;
  methods: SignInMethod[];
  /** Origin of the app, without a trailing slash (APP_URL). */
  appUrl: string;
}

export interface SignInHelpEmail {
  subject: string;
  html: string;
  text: string;
  /** The link the button opens. */
  loginUrl: string;
}

const TEXTS = {
  en: {
    subject: (band: string) => `How to sign in to Bandmate — ${band}`,
    heading: "How to sign in to Bandmate",
    intro: (sender: string, band: string) =>
      `${sender} sent you this so you can get back into ${band} on Bandmate.`,
    someone: "A bandmate",
    account: "Your account",
    method: {
      google: (email: string) => `Tap “Continue with Google” and pick the Google account ${email}.`,
      github: (email: string) => `Sign in with GitHub, using the GitHub account with the email ${email}.`,
      email: (email: string) => `Sign in with your email, ${email}, and your Bandmate password.`,
    },
    howTitle: "How you sign in",
    unknown: (email: string) =>
      `Use the same option you used the first time (for example “Continue with Google”) with ${email}.`,
    several: "Any of these works:",
    button: "Open Bandmate",
    linkHint: "Or copy this link into your browser:",
    homeScreen:
      "Tip: on your phone, open the link and add Bandmate to your home screen to have it one tap away.",
    footer: (band: string) => `You got this email because you are a member of ${band} on Bandmate.`,
  },
  es: {
    subject: (band: string) => `Cómo entrar a Bandmate — ${band}`,
    heading: "Cómo entrar a Bandmate",
    intro: (sender: string, band: string) =>
      `${sender} te envió este correo para que puedas entrar a ${band} en Bandmate.`,
    someone: "Alguien de tu banda",
    account: "Tu cuenta",
    method: {
      google: (email: string) => `Toca «Continuar con Google» y elige la cuenta de Google ${email}.`,
      github: (email: string) => `Entra con GitHub, con la cuenta de GitHub del correo ${email}.`,
      email: (email: string) => `Entra con tu correo, ${email}, y tu contraseña de Bandmate.`,
    },
    howTitle: "Cómo entras",
    unknown: (email: string) =>
      `Usa la misma opción que usaste la primera vez (por ejemplo «Continuar con Google») con ${email}.`,
    several: "Cualquiera de estas opciones funciona:",
    button: "Abrir Bandmate",
    linkHint: "O copia este enlace en tu navegador:",
    homeScreen:
      "Consejo: en el teléfono, abre el enlace y agrega Bandmate a tu pantalla de inicio para tenerlo a un toque.",
    footer: (band: string) => `Recibiste este correo porque eres miembro de ${band} en Bandmate.`,
  },
} as const;

/** Subject, HTML and plain-text bodies. Every interpolated value is escaped. */
export function buildSignInHelpEmail(input: SignInHelpInput): SignInHelpEmail {
  const t = TEXTS[input.locale];
  const band = clip(input.bandName) || "Bandmate";
  const sender = clip(input.senderName) || t.someone;
  const email = input.recipientEmail.trim();
  const loginUrl = `${input.appUrl.replace(/\/+$/, "")}/login`;

  const steps =
    input.methods.length === 0
      ? [t.unknown(email)]
      : input.methods.map((method) => t.method[method](email));

  const subject = t.subject(band);

  const text = [
    t.heading,
    "",
    t.intro(sender, band),
    "",
    `${t.account}: ${email}`,
    "",
    `${t.howTitle}:`,
    ...(steps.length > 1 ? [t.several] : []),
    ...steps.map((step) => `- ${step}`),
    "",
    `${t.button}: ${loginUrl}`,
    "",
    t.homeScreen,
    "",
    t.footer(band),
  ].join("\n");

  const e = escapeHtml;
  const stepsHtml =
    steps.length === 1
      ? `<p style="margin:0">${e(steps[0])}</p>`
      : `<p style="margin:0 0 8px">${e(t.several)}</p><ul style="margin:0;padding-left:20px">${steps
          .map((step) => `<li style="margin:4px 0">${e(step)}</li>`)
          .join("")}</ul>`;

  const html = `<!DOCTYPE html>
<html lang="${input.locale}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(subject)}</title></head>
  <body style="margin:0;padding:20px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333">
    <div style="max-width:600px;margin:0 auto">
      <div style="background:#8b5cf6;background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);color:#ffffff;padding:28px;border-radius:8px;text-align:center;margin-bottom:24px">
        <h1 style="margin:0;font-size:24px">${e(t.heading)}</h1>
      </div>
      <div style="background:#f9fafb;padding:28px;border-radius:8px">
        <p style="margin:0 0 20px">${e(t.intro(sender, band))}</p>
        <div style="background:#ffffff;padding:16px 20px;border-radius:8px;border-left:4px solid #8b5cf6;margin-bottom:16px">
          <div style="font-weight:600;color:#6b7280;font-size:14px">${e(t.account)}</div>
          <div style="font-size:16px;word-break:break-all">${e(email)}</div>
        </div>
        <div style="background:#ffffff;padding:16px 20px;border-radius:8px;border-left:4px solid #8b5cf6">
          <div style="font-weight:600;color:#6b7280;font-size:14px;margin-bottom:4px">${e(t.howTitle)}</div>
          ${stepsHtml}
        </div>
        <div style="text-align:center;margin:28px 0 8px">
          <a href="${e(loginUrl)}" style="display:inline-block;background:#8b5cf6;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600">${e(t.button)}</a>
        </div>
        <p style="margin:20px 0 0;font-size:14px;color:#6b7280">${e(t.linkHint)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#8b5cf6;word-break:break-all">${e(loginUrl)}</p>
        <p style="margin:20px 0 0;font-size:14px;color:#6b7280">${e(t.homeScreen)}</p>
      </div>
      <p style="text-align:center;color:#6b7280;font-size:13px;margin-top:24px">${e(t.footer(band))}</p>
    </div>
  </body>
</html>`;

  return { subject, html, text, loginUrl };
}
