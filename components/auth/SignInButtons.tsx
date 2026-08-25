/* ============================================================
   The providers a reader may sign in with, in one place.

   Three surfaces offer sign-in — `/welcome`, `/settings` and the
   landing hero — and before this file each named GitHub directly.
   Adding a provider to three call sites is how one of them keeps
   offering one provider a year from now, so the list is declared
   once and rendered from.

   ── why these are not `ButtonLink`s ──
   A sign-in button is a convention before it is a control: readers
   identify it by the mark, and both providers publish rules about
   how their mark may be drawn. `ButtonLink`'s three variants are
   the site's own register (a cyan primary, an outlined secondary)
   and neither is what either brand asks for, so forcing these
   through it would either break the convention or bend the
   variants into a shape nothing else uses.

   ── the marks are inline SVG, and that is not a preference ──
   Artifacts and this app run under a strict CSP with no external
   hosts, so a logo from a CDN is a broken image and a logo from an
   icon package is a dependency this repository does not carry.
   Both paths below are the official marks, drawn once.

   ── contrast, which `--color-dim`'s own comment says is measured ──
   Both buttons put dark text on a light face (`#ffffff` and
   GitHub's `#f6f8fa`), which is far past 4.5:1 for the 14px label
   and is the direction both brands specify on a dark page. Nothing
   here reaches for `--color-dim` or any token whose contrast the
   sheet documents, so no existing assertion is touched.
   ============================================================ */

/** The GitHub mark. One path, `currentColor`, so the button's own text colour drives it. */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** Google's four-colour G. Fixed fills, because the mark's colours ARE the mark. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export interface SignInProvider {
  href: string;
  label: string;
  Mark: () => React.ReactElement;
  /** The face and label, per the provider's own guidance for a dark page. */
  className: string;
}

/**
 * The providers, in order.
 *
 * GitHub first because every account that exists today arrived through it, and because a
 * registry of agent workflows is a place its readers mostly reach with one. Google second
 * because it is the address most people's email actually is — which is what makes it worth
 * having, since `lib/server/accounts/identities.ts` links a Google identity to an existing
 * account when the address is verified and already known.
 */
export const SIGN_IN_PROVIDERS: readonly SignInProvider[] = [
  {
    href: "/api/auth/github/login",
    label: "Sign in with GitHub",
    Mark: GitHubMark,
    className: "bg-[#f6f8fa] text-[#1f2328] hoverable:hover:bg-white",
  },
  {
    href: "/api/auth/google/login",
    label: "Sign in with Google",
    Mark: GoogleMark,
    className: "bg-white text-[#1f1f1f] hoverable:hover:bg-[#f2f2f2]",
  },
];

/**
 * The sign-in choice, as the buttons readers expect.
 *
 * `size` widens the pair for the landing hero, where they stand alone above the fold,
 * without giving the hero its own copy of the markup.
 */
export function SignInButtons({
  size = "md",
  align = "start",
  /** Full-width buttons, stacked. What a centred auth card wants: two equal doors. */
  block = false,
}: {
  size?: "md" | "lg";
  align?: "start" | "center";
  block?: boolean;
}) {
  const padding = size === "lg" ? "px-5 py-3 text-[15px]" : "px-4 py-2.5 text-sm";
  const row = block
    ? "flex w-full flex-col gap-3"
    : `flex flex-wrap items-center gap-3 ${align === "center" ? "justify-center" : ""}`;
  const shape = block ? "w-full justify-center" : "";
  return (
    <div className={row}>
      {SIGN_IN_PROVIDERS.map((provider) => (
        <a
          key={provider.href}
          href={provider.href}
          className={`inline-flex items-center gap-2.5 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan ${padding} ${shape} ${provider.className}`}
        >
          <provider.Mark />
          {provider.label}
        </a>
      ))}
    </div>
  );
}
