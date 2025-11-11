'use client';

import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

import type { ReactNode } from 'react';

type SoundEffectKey = 'turnNotification';

type SoundEffectConfig = {
    src: string;
    volume?: number;
};

type SoundEffectManifest = Record<SoundEffectKey, SoundEffectConfig>;

const SOUND_EFFECTS: SoundEffectManifest = {
    turnNotification: {
        src: '/audio/ding_strong.wav',
    },
};

type SoundEffectOptions = {
    interrupt?: boolean;
};

type SoundContextValue = {
    play: (key: SoundEffectKey, options?: SoundEffectOptions) => void;
};

const SoundContext = createContext<SoundContextValue | undefined>(undefined);

export function SoundProvider({ children }: { children: ReactNode }) {
    const audioElementsRef = useRef<Partial<Record<SoundEffectKey, HTMLAudioElement>>>({});

    const ensureAudioElement = useCallback((key: SoundEffectKey) => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        let audio = audioElementsRef.current[key];
        if (!audio) {
            const config = SOUND_EFFECTS[key];
            audio = new Audio(config.src);
            audio.preload = 'auto';
            if (typeof config.volume === 'number') {
                audio.volume = config.volume;
            }

            audioElementsRef.current[key] = audio;
        }

        return audio;
    }, []);

    const play = useCallback(
        (key: SoundEffectKey, options?: SoundEffectOptions) => {
            const audio = ensureAudioElement(key);
            if (!audio) {
                return;
            }

            const shouldInterrupt = options?.interrupt ?? true;
            if (shouldInterrupt) {
                audio.currentTime = 0;
            }

            void audio.play().catch(() => {
                // Ignore play rejections (e.g., user gesture requirements).
            });
        },
        [ensureAudioElement],
    );

    const value = useMemo<SoundContextValue>(
        () => ({
            play,
        }),
        [play],
    );

    return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSoundEffects() {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSoundEffects must be used within a SoundProvider');
    }

    return context;
}

export type { SoundEffectKey, SoundEffectOptions };


