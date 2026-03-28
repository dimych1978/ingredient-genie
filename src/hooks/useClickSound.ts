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
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
        initializedRef.current = true;
      }
    } catch (error) {
      console.warn('Web Audio API not supported');
    }
  }, []);

  const playSound = useCallback((type: ClickType) => {
    // Вибрация
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'increment') {
          navigator.vibrate(8);
        } else {
          navigator.vibrate([5, 5]);
        }
      } catch (e) {}
    }

    // Звук
    try {
      if (!audioCtxRef.current) {
        initAudio();
      }

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Шум (как в твоей версии)
      const bufferSize = ctx.sampleRate * 0.01;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Фильтр с разной частотой для плюса и минуса
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = type === 'increment' ? 2200 : 800;
      filter.Q.value = 1.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.01);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start();
    } catch (error) {}
  }, [initAudio]);

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