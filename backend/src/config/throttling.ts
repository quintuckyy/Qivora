import { seconds, minutes } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Baseline ceiling applied to every route. Deliberately generous — normal app
 * usage (dashboard fan-out, the browser extension, list paging) never comes
 * close; it only catches runaway scripted abuse. Per client IP.
 */
export const GLOBAL_LIMIT = { limit: 300, ttl: seconds(60) };

/**
 * Credential endpoints — login, register, Google sign-in, reset-password
 * confirmation. Tight enough to blunt online brute force / credential
 * stuffing, loose enough for a real person mistyping a password a few times.
 */
export const AUTH_LIMIT = { limit: 10, ttl: seconds(60) };

/**
 * Password-reset *request*. It sends an email, so it's the endpoint abused for
 * mail-bombing and account enumeration — tighter, over a longer window.
 */
export const PASSWORD_RESET_LIMIT = { limit: 5, ttl: minutes(15) };

/**
 * Throttling is on by default (production included). `THROTTLE_ENABLED=false`
 * turns it off for the test suites, which exercise these endpoints far faster
 * than any human and would otherwise rate-limit themselves.
 */
export function throttlingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.THROTTLE_ENABLED !== 'false';
}

export function buildThrottlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [{ name: 'default', ...GLOBAL_LIMIT }],
    // In-memory storage (the default). Fine for a single backend instance;
    // a multi-instance deploy needs a shared store (e.g. Redis) so the limit
    // is global rather than per-instance — see DEPLOYMENT.md.
    skipIf: () => !throttlingEnabled(),
  };
}
