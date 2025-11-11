"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useStreamingConfigStore } from '~/stores/streaming-config-store';

import { supportsBackgroundProcessors } from '@livekit/track-processors';

export function useBackgroundBlur() {
  const hasCheckedSupport = useRef(false);

  const {
    enabled,
    supported,
    setBackgroundBlurEnabled,
    setBackgroundBlurSupported,
  } = useStreamingConfigStore((state) => ({
    enabled: state.backgroundBlurEnabled,
    supported: state.backgroundBlurSupported,
    setBackgroundBlurEnabled: state.setBackgroundBlurEnabled,
    setBackgroundBlurSupported: state.setBackgroundBlurSupported,
  }));

  useEffect(() => {
    if (hasCheckedSupport.current) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const isSupported = supportsBackgroundProcessors();
    setBackgroundBlurSupported(isSupported);
    if (!isSupported) {
      setBackgroundBlurEnabled(false);
    }
    hasCheckedSupport.current = true;
  }, [setBackgroundBlurEnabled, setBackgroundBlurSupported]);

  const toggle = useCallback(() => {
    if (!supported) {
      return;
    }
    setBackgroundBlurEnabled((prev) => !prev);
  }, [setBackgroundBlurEnabled, supported]);

  const setEnabled = useCallback(
    (value: boolean) => {
      if (value && !supported) {
        return;
      }
      setBackgroundBlurEnabled(value);
    },
    [setBackgroundBlurEnabled, supported],
  );

  return {
    enabled,
    supported,
    toggle,
    setEnabled,
  };
}
