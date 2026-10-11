'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { env } from '~/env';

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile failed to load'));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export const isTurnstileEnabled = Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export type TurnstileWidgetHandle = { reset: () => void };

type TurnstileWidgetProps = {
  /** Must match the action the backend verifies (see `TURNSTILE_ACTIONS`). */
  action: string;
  onTokenChange: (token: string | null) => void;
  className?: string;
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ action, onTokenChange, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenChangeRef = useRef(onTokenChange);
    onTokenChangeRef.current = onTokenChange;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
        onTokenChangeRef.current(null);
      },
    }));

    useEffect(() => {
      const sitekey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      if (!sitekey) return;
      let cancelled = false;

      loadTurnstile()
        .then((turnstile) => {
          if (cancelled || !containerRef.current) return;
          widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey,
            action,
            theme: 'dark',
            callback: (token) => onTokenChangeRef.current(token),
            'expired-callback': () => onTokenChangeRef.current(null),
            'error-callback': () => onTokenChangeRef.current(null),
          });
        })
        .catch((err) => console.error(err));

      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
        }
        widgetIdRef.current = null;
      };
    }, [action]);

    if (!isTurnstileEnabled) return null;
    return <div ref={containerRef} className={className} />;
  },
);
