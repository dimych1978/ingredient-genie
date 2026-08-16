import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parse, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const handleDateInput = (
  val: string,
  onDateSelect: (date: Date | undefined) => void,
  setLocalManualInput: (value: string) => void,
  setOpen?: (open: boolean) => void,
) => {
  setLocalManualInput(val);
  const cleaned = val.replace(/\D/g, '').slice(0, 6);

  if (cleaned.length === 6) {
    const parsedDate = parse(cleaned, 'ddMMyy', new Date());
    if (isValid(parsedDate)) {
      onDateSelect(parsedDate);
      if(setOpen) setOpen(false);
    }
  } else if (cleaned.length === 0) {
    onDateSelect(undefined);
  }
};
