import { toast } from 'sonner';
import superjson from 'superjson';

import { isCancelledError, MutationCache, QueryCache } from '@tanstack/react-query';
/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import { httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';

import type { AppRouter } from "~/server/api/root";

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

/** A set of type-safe react-query hooks for your tRPC API. */
export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      queryClientConfig: {
        queryCache: new QueryCache({
          onError: (error) => {
            showErrorToast(error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            showErrorToast(error);
          },
        }),
      },
      /**
       * Links used to determine request flow from client to server.
       *
       * @see https://trpc.io/docs/links
       */
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          /**
           * Transformer used for data de-serialization from the server.
           *
           * @see https://trpc.io/docs/data-transformers
           */
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    };
  },
  /**
   * Whether tRPC should await queries when server rendering pages.
   *
   * @see https://trpc.io/docs/nextjs#ssr-boolean-default-false
   */
  ssr: false,
  transformer: superjson,
});

// --- Error toast utilities ---
const recentToastMessageToTimestampMs = new Map<string, number>();
const TOAST_DEDUP_WINDOW_MS = 2500;

function showErrorToast(error: unknown): void {
  if (isCancelledError(error)) return;

  let message = "An unexpected error occurred";
  if (error instanceof Error) {
    message = error.message || message;
  } else if (typeof error === "string") {
    message = error;
  }

  if (!shouldToast(message)) return;
  toast.error(message);
}

function shouldToast(message: string): boolean {
  const now = Date.now();
  const lastAt = recentToastMessageToTimestampMs.get(message) ?? 0;
  if (now - lastAt < TOAST_DEDUP_WINDOW_MS) return false;
  recentToastMessageToTimestampMs.set(message, now);

  // Periodically clean up old entries to avoid unbounded growth
  for (const [msg, ts] of Array.from(
    recentToastMessageToTimestampMs.entries(),
  )) {
    if (now - ts > TOAST_DEDUP_WINDOW_MS * 4) {
      recentToastMessageToTimestampMs.delete(msg);
    }
  }
  return true;
}

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
