import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "./oauth-state";

describe("createOAuthState", () => {
  it("generates a fresh, non-trivial token each call", () => {
    const a = createOAuthState();
    const b = createOAuthState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });
});

describe("verifyOAuthState", () => {
  it("accepts a matching cookie and query state", () => {
    const state = createOAuthState();
    expect(verifyOAuthState(state, state)).toBe(true);
  });

  it("rejects a mismatch, a missing cookie, or a missing query value", () => {
    const state = createOAuthState();
    expect(verifyOAuthState(state, "something-else")).toBe(false);
    expect(verifyOAuthState(undefined, state)).toBe(false);
    expect(verifyOAuthState(state, null)).toBe(false);
  });
});
