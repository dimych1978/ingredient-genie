
'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { allMachines, Machine } from '@/lib/data';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { GroupedShoppingLists } from '@/components/grouped-shopping-lists';
import {
  Calendar as CalendarIcon,
  X,
  PlusCircle,
  Eye,
  Check,
  ChevronsUpDown,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getSpecialMachineDates,
  setSpecialMachineDate,
  getDailySchedule,
  saveDailySchedule,
} from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const isSpecialMachine = (machine: Machine | undefined): boolean => {
  if (!machine || !machine.model) return false;
  const model = machine.model.toLowerCase();
  return model.includes('krea') || model.includes('tcn');
};

export const TomorrowsMachines = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });

  const [machineIdsForDay, setMachineIdsForDay] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [machineToAdd, setMachineToAdd] = useState<string | null>(null);
  const [specialMachineDates, setSpecialMachineDates] = useState<
    Record<string, string>
  >({});

  const { toast } = useToast();

  const [comboboxOpen, setComboboxOpen] = useState(false);

  // State for date confirmation dialog
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    machineId: string | null;
    lastDate: Date | null;
  }>({ open: false, machineId: null, lastDate: null });

  const [calendarState, setCalendarState] = useState<{
    open: boolean;
    machineId: string | null;
  }>({ open: false, machineId: null });

  const addMachineButtonRef = useRef<HTMLButtonElement>(null);

  // --- DATA FETCHING AND SAVING ---

  const loadScheduleForDate = useCallback(
    async (date: Date) => {
      setIsLoading(true);
      try {
        const dateKey = format(date, 'yyyy-MM-dd');
        console.log(`Загрузка расписания для ключа: ${dateKey}`);
        const [dates, schedule] = await Promise.all([
          getSpecialMachineDates(),
          getDailySchedule(dateKey),
        ]);
        setSpecialMachineDates(dates);
        if (schedule) {
          setMachineIdsForDay(schedule);
        } else {
          setMachineIdsForDay([]);
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Ошибка загрузки данных',
          description: 'Не удалось загрузить расписание или даты аппаратов.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadScheduleForDate(selectedDate);
  }, [selectedDate, loadScheduleForDate]);


  const handleSaveChanges = useCallback(async () => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const result = await saveDailySchedule(dateString, machineIdsForDay);
    if (result.success) {
      toast({
        title: 'Расписание сохранено',
        description: `Список аппаратов на ${format(selectedDate, 'dd.MM.yyyy')} успешно сохранен.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
        description: 'Не удалось сохранить расписание.',
      });
    }
  }, [selectedDate, machineIdsForDay, toast]);

  // --- COMPUTED VALUES ---

  const machinesForDay = useMemo(() => {
    return allMachines
      .filter(machine => machineIdsForDay.includes(machine.id))
      .sort(
        (a, b) =>
          machineIdsForDay.indexOf(a.id) - machineIdsForDay.indexOf(b.id)
      );
  }, [machineIdsForDay]);

  const unselectedMachines = useMemo(() => {
    return allMachines.filter(m => !machineIdsForDay.includes(m.id));
  }, [machineIdsForDay]);
  
  const calendarSelectedDate = useMemo(() => {
    if (!calendarState.machineId) return undefined;
    const machineDate = specialMachineDates[calendarState.machineId];
    return machineDate ? new Date(machineDate) : undefined;
  }, [calendarState.machineId, specialMachineDates]);


  // --- HANDLERS ---

  const addMachineToDay = useCallback(
    (id: string) => {
      if (id && !machineIdsForDay.includes(id)) {
        setMachineIdsForDay(prev => [...prev, id]);
      }
      setMachineToAdd(null);
      setComboboxOpen(false);
    },
    [machineIdsForDay]
  );

  const handleAddMachineClick = () => {
    if (!machineToAdd) return;

    const machine = allMachines.find(m => m.id === machineToAdd);
    const special = isSpecialMachine(machine);

    if (special) {
      const lastDateString = specialMachineDates[machineToAdd];
      const lastDate = lastDateString ? new Date(lastDateString) : null;

      if (lastDate) {
        setDialogState({ open: true, machineId: machineToAdd, lastDate });
      } else {
        setCalendarState({ open: true, machineId: machineToAdd });
      }
    } else {
      addMachineToDay(machineToAdd);
    }
  };

  const handleRemoveMachine = (idToRemove: string) => {
    setMachineIdsForDay(prev => prev.filter(id => id !== idToRemove));
  };

  const handleDialogConfirm = () => {
    if (dialogState.machineId) {
      addMachineToDay(dialogState.machineId);
    }
    setDialogState({ open: false, machineId: null, lastDate: null });
  };

  const handleDialogCancel = () => {
    const machineId = dialogState.machineId;
    setDialogState({ open: false, machineId: null, lastDate: null });
    setTimeout(() => {
      if (machineId) {
        setCalendarState({ open: true, machineId: machineId });
      }
    }, 100);
  };

  const handleCalendarSelect = async (date: Date | undefined) => {
    const machineId = calendarState.machineId;
    
    setCalendarState({ open: false, machineId: null });
    
    if (date && machineId) {
      const result = await setSpecialMachineDate(machineId, date.toISOString());
      
      if (result.success) {
        setSpecialMachineDates(prev => ({
            ...prev,
            [machineId!]: date.toISOString(),
        }));
        addMachineToDay(machineId);
        toast({
          title: 'Дата сохранена',
          description: `Начальная дата для аппарата #${machineId} установлена.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'Не удалось сохранить дату.',
        });
      }
    }
  };

  const getFormattedDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <>
      <Card className='shadow-lg'>
        <CardHeader>
          <CardTitle className='font-headline text-2xl flex items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <CalendarIcon className='h-6 w-6 text-primary' />
              <span>Аппараты на дату</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant='outline' disabled={isLoading}>
                  <CalendarIcon className='mr-2 h-4 w-4' />
                  {getFormattedDate(selectedDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0'>
                <Calendar
                  mode='single'
                  selected={selectedDate}
                  onSelect={date => date && setSelectedDate(date)}
                  initialFocus
                  locale={ru}
                />
              </PopoverContent>
            </Popover>
          </CardTitle>
          <CardDescription>
            Список аппаратов на основе заявки. Нажмите кнопку ниже, чтобы сохранить изменения.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {isLoading ? (
            <div className='flex items-center justify-center py-10'>
              <Loader2 className='h-8 w-8 animate-spin text-primary' />
              <p className='ml-4 text-muted-foreground'>
                Загрузка расписания...
              </p>
            </div>
          ) : machinesForDay.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Местоположение</TableHead>
                  <TableHead className='text-right'>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machinesForDay.map(machine => (
                  <TableRow key={machine.id}>
                    <TableCell className='font-mono'>#{machine.id}</TableCell>
                    <TableCell className='font-medium'>
                      {machine.name}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {machine.location}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button asChild variant='ghost' size='icon'>
                        <Link href={`/machines/${machine.id}`}>
                          <Eye className='h-4 w-4' />
                          <span className='sr-only'>Посмотреть</span>
                        </Link>
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => handleRemoveMachine(machine.id)}
                      >
                        <X className='h-4 w-4 text-destructive' />
                        <span className='sr-only'>Удалить</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className='text-muted-foreground text-center py-4'>
              На {format(selectedDate, 'dd.MM.yyyy')} аппаратов не
              запланировано. Добавьте первый аппарат.
            </p>
          )}

          <div className='flex gap-2 items-center p-2 border rounded-lg'>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  role='combobox'
                  aria-expanded={comboboxOpen}
                  className='w-full justify-between'
                  ref={addMachineButtonRef}
                >
                  {machineToAdd
                    ? unselectedMachines.find(
                        machine => machine.id === machineToAdd
                      )?.name
                    : 'Выберите аппарат для добавления...'}
                  <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
                <Command
                  filter={(value, search) => {
                    if (value.toLowerCase().includes(search.toLowerCase()))
                      return 1;
                    return 0;
                  }}
                >
                  <CommandInput placeholder='Поиск по названию или локации...' />
                  <CommandList>
                    <CommandEmpty>Аппарат не найден.</CommandEmpty>
                    <CommandGroup>
                      {unselectedMachines.map(machine => (
                        <CommandItem
                          key={machine.id}
                          value={`${machine.name} ${machine.location} ${machine.id}`}
                          onSelect={() => {
                            setMachineToAdd(machine.id);
                            setComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              machineToAdd === machine.id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <div>
                            <p>
                              {machine.name} (#{machine.id})
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              {machine.location}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Popover
              open={calendarState.open}
              onOpenChange={(open) =>
                setCalendarState((prev) => ({ ...prev, open }))
              }
            >
              <PopoverTrigger asChild>
                 <Button onClick={handleAddMachineClick} disabled={!machineToAdd}>
                    <PlusCircle className='mr-2 h-4 w-4' />
                    Добавить
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                 <Calendar
                    locale={ru}
                    mode="single"
                    onSelect={handleCalendarSelect}
                    selected={calendarSelectedDate}
                    disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                    initialFocus
                  />
              </PopoverContent>
            </Popover>
          </div>

          {machineIdsForDay.length > 0 && (
            <div className='mt-4'>
              <GroupedShoppingLists
                machineIds={machineIdsForDay}
                specialMachineDates={specialMachineDates}
                onSaveChanges={handleSaveChanges}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={dialogState.open}
        onOpenChange={open =>
          !open &&
          setDialogState({ open: false, machineId: null, lastDate: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение даты</AlertDialogTitle>
            <AlertDialogDescription>
              Последний заказ для этого аппарата был создан{' '}
              {dialogState.lastDate
                ? format(dialogState.lastDate, 'dd MMMM yyyy г.', {
                    locale: ru,
                  })
                : ''}
              . Использовать эту дату как начальную?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDialogCancel}>
              Нет, выбрать другую
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDialogConfirm}>
              Да, использовать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
};
