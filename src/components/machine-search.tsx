
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { allMachines } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

export function MachineSearch() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const router = useRouter();

  const handleGoToMachine = () => {
    if (value) {
      router.push(`/machines/${value}`);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value
              ? allMachines.find((machine) => machine.id === value)?.name
              : "Выберите аппарат..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command
            filter={(itemValue, search) => {
              if (itemValue.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="Поиск по названию или локации..." />
            <CommandList>
              <CommandEmpty>Аппарат не найден.</CommandEmpty>
              <CommandGroup>
                {allMachines.map((machine) => (
                  <CommandItem
                    key={machine.id}
                    value={`${machine.name} ${machine.location} ${machine.id}`}
                    onSelect={() => {
                      setValue(machine.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === machine.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div>
                        <p>{machine.name} (#{machine.id})</p>
                        <p className="text-xs text-muted-foreground">{machine.location}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button onClick={handleGoToMachine} disabled={!value}>
        <Search className="mr-2 h-4 w-4" />
        Перейти
      </Button>
    </div>
  );
}
