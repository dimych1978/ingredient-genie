'use client';

import { useCallback, useRef, useEffect } from 'react';

type ClickType = 'increment' | 'decrement';

export const useClickSound = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const initializedRef = useRef(false);

  const initAudio = useCallback(() => {
    if (initializedRef.current) return;

    if (typeof window === 'undefined') return;

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
        initializedRef.current = true;
      }
    } catch (error) {
      console.warn('Web Audio API not supported');
    }
  }, []);

  const playSound = useCallback(
    (type: ClickType) => {
      // Вибрация (разная для плюса и минуса)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          if (type === 'increment') {
            navigator.vibrate(50);
          } else {
            navigator.vibrate(50);
          }
        } catch (e) {
          // тихо падаем
        }
      }

      // Звук
      try {
        if (!audioCtxRef.current) {
          initAudio();
        }

        const ctx = audioCtxRef.current;
        if (!ctx) return;

        if (ctx.state === 'suspended') {
          ctx
            .resume()
            .then(() => {
              // Создаём все узлы заново внутри колбэка
              const bufferSize = ctx.sampleRate * 0.008;
              const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
              const data = buffer.getChannelData(0);
              for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
              }

              const source = ctx.createBufferSource();
              source.buffer = buffer;

              const filter = ctx.createBiquadFilter();
              filter.type = 'bandpass';
              filter.frequency.value = type === 'increment' ? 2000 : 700;
              filter.Q.value = 1.0;

              const gain = ctx.createGain();
              gain.gain.setValueAtTime(0.2, ctx.currentTime);

              source.connect(filter);
              filter.connect(gain);
              gain.connect(ctx.destination);
              source.start();
            })
            .catch(() => {});
          return;
        }

        // Шум
        const bufferSize = ctx.sampleRate * 0.008; // чуть короче
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Фильтр
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = type === 'increment' ? 2000 : 700;
        filter.Q.value = 1.0;

        const gain = ctx.createGain();
        const volume = 0.2;
        gain.gain.setValueAtTime(volume, ctx.currentTime);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start();
      } catch (error) {
        // тихо падаем
      }
    },
    [initAudio],
  );

  const playIncrement = useCallback(() => playSound('increment'), [playSound]);
  const playDecrement = useCallback(() => playSound('decrement'), [playSound]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return { playIncrement, playDecrement };
};
