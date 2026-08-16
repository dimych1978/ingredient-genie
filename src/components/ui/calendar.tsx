'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parse, isValid, format } from 'date-fns';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Расширяем типы DayPicker, добавляя наши кастомные пропсы
export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  onDateSelect?: (date: Date | undefined) => void;
  onClose?: () => void;
  dateStr?: string | null;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  onDateSelect,
  onClose,
  dateStr,
  ...props
}: CalendarProps) {
  const [manualInput, setManualInput] = React.useState(
    dateStr ? format(new Date(dateStr), 'dd.MM.yy') : '',
  );

  // Синхронизируем manualInput при изменении dateStr извне
  React.useEffect(() => {
    if (dateStr) {
      setManualInput(format(new Date(dateStr), 'dd.MM.yy'));
    } else {
      setManualInput('');
    }
  }, [dateStr]);

  const handleManualInput = (val: string) => {
    setManualInput(val);
    const cleaned = val.replace(/\D/g, '').slice(0, 6);

    if (cleaned.length === 6) {
      const parsedDate = parse(cleaned, 'ddMMyy', new Date());
      if (isValid(parsedDate)) {
        if (onDateSelect) onDateSelect(parsedDate);
        if (onClose) onClose();
      }
    } else if (cleaned.length === 0 && onDateSelect) {
      onDateSelect(undefined);
    }
  };

  return (
    <div>
      <div className="p-3 border-b bg-muted/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Введите дату вручную
          </span>
          {dateStr && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-destructive px-2"
              onClick={() => {
                setManualInput('');
                if (onDateSelect) onDateSelect(undefined);
                if (onClose) onClose();
              }}
            >
              Сбросить
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="ДД.ММ.ГГ или ДДММГГ"
            value={manualInput}
            onChange={(e) => handleManualInput(e.target.value)}
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn('p-3', className)}
        classNames={{
          months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
          month: 'space-y-4',
          month_caption: 'flex justify-center pt-1 relative items-center',
          caption_label: 'text-sm font-medium',
          nav: 'space-x-1 flex items-center',
          button_previous: cn(
            buttonVariants({ variant: 'outline' }),
            'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1 z-10'
          ),
          button_next: cn(
            buttonVariants({ variant: 'outline' }),
            'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1 z-10'
          ),
          month_grid: 'w-full border-collapse space-y-1',
          weekdays: 'flex',
          weekday:
            'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex items-center justify-center p-0',
          weeks: 'w-full',
          week: 'flex w-full mt-2',
          day: 'h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center focus-within:relative focus-within:z-20',
          day_button: cn(
            'h-9 w-9 p-0 font-normal rounded-md flex items-center justify-center transition-colors duration-200 hover:bg-accent hover:text-accent-foreground cursor-pointer',
            'aria-selected:opacity-100'
          ),
          selected: cn(
            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
            'rounded-md opacity-100'
          ),
          today: cn(
            'bg-accent/30 text-accent-foreground font-bold border border-accent/50',
            'rounded-md'
          ),
          outside: 'text-muted-foreground opacity-30 pointer-events-none',
          disabled: 'text-muted-foreground opacity-50',
          hidden: 'invisible',
          ...classNames,
        }}
        components={{
          Chevron: ({ orientation }) => {
            const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
            return <Icon className="h-4 w-4" />;
          },
        }}
        {...props}
      />
    </div>
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };