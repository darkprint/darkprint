import { ButtonLink } from "@/components/ui/Button";

/* ============================================================
   The providers a reader may sign in with, in one place.

   Three surfaces offer sign-in — `/welcome`, `/settings` and the
   header — and before this file each named GitHub directly. Adding
   Google to three call sites is how one of them keeps saying
   "Sign in with GitHub" a year from now, so the list is declared
   once and rendered from.

   ── the order is not cosmetic ──
   GitHub first because every account that exists today arrived
   through it, and because this is a registry of agent workflows
   whose readers mostly have one. Google second because it is the
   address most people's email actually is, which is what makes it
   worth having: `lib/server/accounts/identities.ts` links a Google
   identity to an existing account when the address is VERIFIED and
   already known.
   ============================================================ */

export const SIGN_IN_PROVIDERS = [
  { href: "/api/auth/github/login", label: "Continue with GitHub" },
  { href: "/api/auth/google/login", label: "Continue with Google" },
] as const;

/**
 * The sign-in choice, as buttons.
 *
 * `variant` is the FIRST provider's; the rest are outlined, so one option reads as the
 * ordinary path rather than the page offering two equally-weighted decisions.
 */
export function SignInButtons() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {SIGN_IN_PROVIDERS.map((provider, index) => (
        <ButtonLink
          key={provider.href}
          href={provider.href}
          variant={index === 0 ? "primary" : "outline"}
        >
          {provider.label}
        </ButtonLink>
      ))}
    </div>
  );
}
