'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScrollNavButtons() {
  const [visibility, setVisibility] = useState({ top: false, bottom: false });

  const updateVisibility = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const scrollY = window.scrollY;
    const clientHeight = window.innerHeight;
    const scrollHeight = document.documentElement.scrollHeight;

    setVisibility({
      top: scrollY > 300,
      bottom: scrollY < scrollHeight - clientHeight - 300,
    });
  }, []);

  useEffect(() => {
    updateVisibility();
    
    window.addEventListener('scroll', updateVisibility);
    window.addEventListener('resize', updateVisibility);
    
    return () => {
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, [updateVisibility]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  return (
    <>
      {visibility.top && (
        <button
          onClick={scrollToTop}
          className={cn(
            'fixed bottom-6 right-6 p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-300',
            'flex items-center justify-center z-50 md:hidden',
          )}
          aria-label='Наверх'
        >
          <ChevronUp className='h-6 w-6' />
        </button>
      )}

      {visibility.bottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'fixed top-20 right-6 p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-300',
            'flex items-center justify-center z-50 md:hidden',
          )}
          aria-label='Вниз'
        >
          <ChevronDown className='h-6 w-6' />
        </button>
      )}
    </>
  );
}