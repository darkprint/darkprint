// Browser stand-in for `next/navigation`, aliased in .design-sync/tsconfig.sync.json.
// These hooks read the App Router context. Outside a Next app that context is
// absent and the real hooks throw, which would blank every card that uses one.
// Components only consume `usePathname` and `useRouter` here, but the whole
// surface is stubbed so a component added later fails loudly at the import site
// rather than silently at render.

/**
 * "/" by default, because a preview card is not on any route.
 *
 * A component that branches on the route (LearnShell picks its rail from the
 * pathname) has no visible behaviour at "/", so a preview may set
 * `window.__dsPathname` at module scope to put itself on a real route. The
 * global is read per render rather than captured, so setting it before the
 * first paint is enough.
 */
declare global {
  interface Window {
    __dsPathname?: string;
  }
}

export function usePathname(): string {
  return (typeof window !== "undefined" && window.__dsPathname) || "/";
}

const noop = () => {};

export function useRouter() {
  return {
    push: noop,
    replace: noop,
    refresh: noop,
    back: noop,
    forward: noop,
    prefetch: noop,
  };
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams<T extends Record<string, string | string[]>>(): T {
  return {} as T;
}

export function useSelectedLayoutSegment(): string | null {
  return null;
}

export function useSelectedLayoutSegments(): string[] {
  return [];
}

export function redirect(_url: string): never {
  throw new Error("[ds-preview] redirect() is inert in a design-system preview");
}

export function permanentRedirect(_url: string): never {
  throw new Error("[ds-preview] permanentRedirect() is inert in a design-system preview");
}

export function notFound(): never {
  throw new Error("[ds-preview] notFound() is inert in a design-system preview");
}

export const RedirectType = { push: "push", replace: "replace" } as const;
