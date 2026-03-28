// components/ui/sound-button.tsx
import { forwardRef } from 'react';
import { Button, ButtonProps } from './button';
import { useClickSound } from '@/hooks/useClickSound';

interface SoundButtonProps extends ButtonProps {
  soundType?: 'increment' | 'decrement';
}

export const SoundButton = forwardRef<HTMLButtonElement, SoundButtonProps>(
  ({ onClick, children, soundType = 'increment', ...props }, ref) => {
    const { playIncrement, playDecrement } = useClickSound();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (soundType === 'increment') {
        playIncrement();
      } else {
        playDecrement();
      }
      onClick?.(e);
    };

    return (
      <Button ref={ref} onClick={handleClick} {...props}>
        {children}
      </Button>
    );
  }
);

SoundButton.displayName = 'SoundButton';