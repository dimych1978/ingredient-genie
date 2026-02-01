//tomorrows-machines.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { allMachines, isSpecialMachine } from '@/lib/data';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  Save,
  RotateCcw,
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
import { useTelemetronApi } from '@/hooks/useTelemetronApi';
import { TelemetronSaleItem } from '@/types/telemetron';

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [aaMachineIds, setAaMachineIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const { getMachineOverview, getSalesByProducts } = useTelemetronApi();

  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    machineId: string | null;
    lastDate: Date | null;
  }>({ open: false, machineId: null, lastDate: null });
  const [calendarState, setCalendarState] = useState<{
    open: boolean;
    machineId: string | null;
  }>({ open: false, machineId: null });

  // --- DATA FETCHING AND SAVING ---
  const loadScheduleForDate = useCallback(
    async (date: Date) => {
      setIsLoading(true);
      try {
        const dateKey = format(date, 'yyyy-MM-dd');
        const [initialSpecialDates, scheduleIds] = await Promise.all([
          getSpecialMachineDates(),
          getDailySchedule(dateKey),
        ]);

        const loadedIds = scheduleIds || [];
        const finalDates = { ...initialSpecialDates };

        // Проверяем аппараты на статус "AA" (без планограммы)
        const checkAAPromises = loadedIds.map(async id => {
          try {
            const dateTo = new Date();
            const dateFrom = new Date();
            dateFrom.setDate(dateTo.getDate() - 7); // Проверяем продажи за последнюю неделю
            const salesData = await getSalesByProducts(
              id,
              format(dateFrom, 'yyyy-MM-dd HH:mm:ss'),
              format(dateTo, 'yyyy-MM-dd HH:mm:ss')
            );
            if (
              salesData.data &&
              salesData.data.length > 0 &&
              salesData.data.every(
                (item: TelemetronSaleItem) => item.product_number === 'AA'
              )
            ) {
              return id;
            }
          } catch (e) {
            console.error(`Ошибка проверки АА статуса для ${id}:`, e);
          }
          return null;
        });

        const aaResults = await Promise.all(checkAAPromises);
        const newAaMachineIds = new Set(
          aaResults.filter((id): id is string => id !== null)
        );
        setAaMachineIds(newAaMachineIds);

        // Запрашиваем даты только для тех аппаратов, у которых их нет и которые не "AA"
        const overviewPromises = loadedIds
          .filter(id => !finalDates[id] && !newAaMachineIds.has(id))
          .map(async id => {
            try {
              const overview = await getMachineOverview(id);
              const lastCollection = overview.data?.cache?.last_collection_at;
              if (lastCollection) {
                finalDates[id] = lastCollection;
              }
            } catch (e) {
              console.error(
                `Не удалось получить overview для аппарата ${id} при загрузке`,
                e
              );
            }
          });

        await Promise.all(overviewPromises);

        setSpecialMachineDates(finalDates);
        setMachineIdsForDay(loadedIds);
        setHasUnsavedChanges(false);
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
    [toast, getMachineOverview, getSalesByProducts]
  );

  useEffect(() => {
    loadScheduleForDate(selectedDate);
  }, [selectedDate, loadScheduleForDate]);

  const handleSaveChanges = useCallback(async () => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const result = await saveDailySchedule(dateString, machineIdsForDay);

    if (result.success) {
      try {
        const nextWeek = new Date(selectedDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekString = format(nextWeek, 'yyyy-MM-dd');

        await saveDailySchedule(nextWeekString, machineIdsForDay);

        toast({
          title: 'Расписание сохранено',
          description: `Список аппаратов на ${format(
            selectedDate,
            'dd.MM.yyyy'
          )} сохранен. Также сохранено на ${format(nextWeek, 'dd.MM.yyyy')}.`,
        });
      } catch (error) {
        console.error('Ошибка при сохранении на след неделю:', error);
        toast({
          title: 'Расписание частично сохранено',
          description: `Список аппаратов на ${format(
            selectedDate,
            'dd.MM.yyyy'
          )} сохранен. На следующую неделю не удалось сохранить.`,
        });
      }

      setHasUnsavedChanges(false);
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
        setHasUnsavedChanges(true);
      }
      setMachineToAdd(null);
      setComboboxOpen(false);
    },
    [machineIdsForDay]
  );

  const handleAddMachineClick = useCallback(async () => {
    if (!machineToAdd) return;
    setIsLoading(true);

    try {
      // Сначала проверяем на статус "AA"
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateTo.getDate() - 7);
      const salesData = await getSalesByProducts(
        machineToAdd,
        format(dateFrom, 'yyyy-MM-dd HH:mm:ss'),
        format(dateTo, 'yyyy-MM-dd HH:mm:ss')
      );

      if (
        salesData.data &&
        salesData.data.length > 0 &&
        salesData.data.every(
          (item: TelemetronSaleItem) => item.product_number === 'AA'
        )
      ) {
        setAaMachineIds(prev => new Set(prev).add(machineToAdd));
        addMachineToDay(machineToAdd);
        return; // Выходим, так как аппарат AA добавлен
      }

      // Если не AA, продолжаем обычную логику
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
        return;
      }

      const overview = await getMachineOverview(machineToAdd);
      const lastCollection = overview.data?.cache?.last_collection_at;

      if (lastCollection) {
        setSpecialMachineDates(prev => ({
          ...prev,
          [machineToAdd]: lastCollection,
        }));
        addMachineToDay(machineToAdd);
      } else {
        toast({
          title: 'Требуется указать дату',
          description: `Для аппарата #${machineToAdd} не найдена дата последней инкассации. Пожалуйста, выберите дату.`,
        });
        setCalendarState({ open: true, machineId: machineToAdd });
      }
    } catch (error) {
      console.error('Error fetching machine overview on add:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка API',
        description: `Не удалось получить данные для аппарата #${machineToAdd}.`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    machineToAdd,
    specialMachineDates,
    addMachineToDay,
    getMachineOverview,
    getSalesByProducts,
    toast,
  ]);

  const handleRemoveMachine = (idToRemove: string) => {
    setMachineIdsForDay(prev => prev.filter(id => id !== idToRemove));
    setHasUnsavedChanges(true);
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
        setCalendarState({ open: true, machineId });
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
          [machineId]: date.toISOString(),
        }));
        if (!machineIdsForDay.includes(machineId)) {
          addMachineToDay(machineId);
        }
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

  const handleResetChanges = () => {
    loadScheduleForDate(selectedDate);
    toast({
      title: 'Изменения сброшены',
      description: 'Восстановлен последний сохраненный список.',
    });
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
          <CardTitle className='font-headline text-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <CalendarIcon className='h-6 w-6 text-primary' />
              <span>Аппараты на дату</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  disabled={isLoading}
                  className='w-full sm:w-auto'
                >
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
            Добавляйте и удаляйте аппараты из списка. Не забудьте сохранить
            изменения.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col sm:flex-row gap-2'>
            <Button
              onClick={handleSaveChanges}
              disabled={isLoading || !hasUnsavedChanges}
              className='flex-1'
            >
              <Save className='mr-2 h-4 w-4' />
              Сохранить изменения
              {hasUnsavedChanges && (
                <span className='ml-2 text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded-full'>
                  есть изменения
                </span>
              )}
            </Button>
            <Button
              onClick={handleResetChanges}
              variant='outline'
              disabled={isLoading || !hasUnsavedChanges}
            >
              <RotateCcw className='h-4 w-4' />
            </Button>
          </div>

          {isLoading ? (
            <div className='flex items-center justify-center py-10'>
              <Loader2 className='h-8 w-8 animate-spin text-primary' />
              <p className='ml-4 text-muted-foreground'>
                Загрузка расписания...
              </p>
            </div>
          ) : machinesForDay.length > 0 ? (
            <div className='space-y-3'>
              {machinesForDay.map(machine => {
                const isAaMachine = aaMachineIds.has(machine.id);
                const serviceDate = specialMachineDates[machine.id];
                const dateDisplay = serviceDate ? (
                  format(new Date(serviceDate), 'dd.MM.yyyy HH:mm')
                ) : (
                  <span className='text-yellow-500'>Нет данных...</span>
                );

                return (
                  <div
                    key={machine.id}
                    className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg'
                  >
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium truncate'>
                        {machine.name} (#{machine.id})
                      </p>
                      <p className='text-sm text-muted-foreground whitespace-pre-line break-words'>
                        {machine.location}
                      </p>
                      {isAaMachine ? (
                        <div className='flex items-center gap-2 mt-2'>
                          <span className='text-sm font-medium text-purple-400'>
                            Аппарат без планограммы (AA)
                          </span>
                        </div>
                      ) : (
                        <div className='flex items-center gap-2 mt-2'>
                          <span className='text-sm font-medium'>
                            {dateDisplay}
                          </span>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 w-6 p-0'
                            onClick={() => {
                              setCalendarState({
                                open: true,
                                machineId: machine.id,
                              });
                            }}
                            title='Изменить дату'
                          >
                            <CalendarIcon className='h-3 w-3' />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className='flex items-center gap-2 self-end sm:self-center flex-shrink-0'>
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
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className='text-muted-foreground text-center py-4'>
              На {format(selectedDate, 'dd.MM.yyyy')} аппаратов не
              запланировано. Добавьте первый аппарат.
            </p>
          )}

          <div className='flex flex-col sm:flex-row gap-2 items-center p-2 border rounded-lg'>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  role='combobox'
                  aria-expanded={comboboxOpen}
                  className='w-full justify-between'
                  disabled={isLoading}
                >
                  {isLoading && machineIdsForDay.length === 0 ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : machineToAdd ? (
                    unselectedMachines.find(
                      machine => machine.id === machineToAdd
                    )?.name
                  ) : (
                    'Выберите аппарат для добавления...'
                  )}
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
            <Button
              onClick={handleAddMachineClick}
              disabled={!machineToAdd || isLoading}
            >
              {isLoading ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <PlusCircle className='mr-2 h-4 w-4' />
              )}
              Добавить
            </Button>
          </div>

          <Popover
            open={calendarState.open}
            onOpenChange={open => setCalendarState(prev => ({ ...prev, open }))}
          >
            <PopoverTrigger asChild>
              <span />
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0'>
              <Calendar
                locale={ru}
                mode='single'
                onSelect={handleCalendarSelect}
                selected={calendarSelectedDate}
                disabled={date =>
                  date > new Date() || date < new Date('2020-01-01')
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {machineIdsForDay.length > 0 && (
            <div className='mt-4'>
              <GroupedShoppingLists
                machineIds={machineIdsForDay}
                specialMachineDates={specialMachineDates}
                onSaveChanges={handleSaveChanges}
                aaMachineIds={aaMachineIds}
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
