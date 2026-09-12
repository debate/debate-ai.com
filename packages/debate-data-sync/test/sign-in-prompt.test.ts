/**
 * @fileoverview Pins the guest sign-in prompt bus.
 *
 * The property worth protecting is the one that is easiest to "tidy up" into a
 * bug: `requireSignIn` returning false must **not** mean the caller skipped
 * the save. Every store in this repo writes `localStorage` first and treats
 * the account as a mirror, so a guest's favourite is real work that has to
 * survive a dismissed dialog — the prompt is an offer to keep it, not a gate
 * in front of it. A future refactor that made the guard block the local write
 * would still pass any test that only checked "did it prompt".
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isSignedIn,
  promptSignIn,
  requireSignIn,
  resetSignInPrompts,
  setSignedIn,
  subscribeToSignInPrompts,
  type SignInPrompt,
} from "../src/state/sign-in-prompt";

const PROMPT: SignInPrompt = {
  feature: "video favorites",
  message: "Sign in to keep them on your account.",
};

beforeEach(() => {
  resetSignInPrompts();
});

describe("sign-in prompt bus", () => {
  it("starts signed out, so nothing syncs or prompts before the app says so", () => {
    expect(isSignedIn()).toBe(false);
  });

  it("delivers a prompt to every subscriber", () => {
    const seen: SignInPrompt[] = [];
    const other: SignInPrompt[] = [];
    subscribeToSignInPrompts((prompt) => seen.push(prompt));
    subscribeToSignInPrompts((prompt) => other.push(prompt));

    promptSignIn(PROMPT);

    expect(seen).toEqual([PROMPT]);
    expect(other).toEqual([PROMPT]);
  });

  it("stops delivering after unsubscribe", () => {
    const seen: SignInPrompt[] = [];
    const unsubscribe = subscribeToSignInPrompts((prompt) => seen.push(prompt));

    unsubscribe();
    promptSignIn(PROMPT);

    expect(seen).toEqual([]);
  });

  it("prompts a guest and reports that there is no account", () => {
    const seen: SignInPrompt[] = [];
    subscribeToSignInPrompts((prompt) => seen.push(prompt));

    expect(requireSignIn(PROMPT)).toBe(false);
    expect(seen).toEqual([PROMPT]);
  });

  it("stays silent for a signed-in user", () => {
    const seen: SignInPrompt[] = [];
    subscribeToSignInPrompts((prompt) => seen.push(prompt));
    setSignedIn(true);

    expect(requireSignIn(PROMPT)).toBe(true);
    expect(seen).toEqual([]);
  });

  it("goes back to prompting after a sign-out", () => {
    const seen: SignInPrompt[] = [];
    subscribeToSignInPrompts((prompt) => seen.push(prompt));

    setSignedIn(true);
    requireSignIn(PROMPT);
    setSignedIn(false);
    requireSignIn(PROMPT);

    expect(seen).toEqual([PROMPT]);
  });

  it("does not let a throwing subscriber take down the click that prompted", () => {
    const seen: SignInPrompt[] = [];
    subscribeToSignInPrompts(() => {
      throw new Error("dialog host exploded");
    });
    subscribeToSignInPrompts((prompt) => seen.push(prompt));

    expect(() => requireSignIn(PROMPT)).not.toThrow();
    // And a broken host costs only its own prompt, not everyone else's.
    expect(seen).toEqual([PROMPT]);
  });

  it("raises a prompt even with nobody listening", () => {
    // A tool package must not have to know whether the app has mounted its
    // dialog host yet — a server render and a unit test have no host at all.
    expect(() => promptSignIn(PROMPT)).not.toThrow();
    expect(requireSignIn(PROMPT)).toBe(false);
  });
});
