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
import { InventoryManager } from '@/components/inventory-manager';
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
  CheckCircle,
  ClipboardList,
  Package,
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
import { useScheduleCache } from '@/components/context/ScheduleCacheContext';
import { useScheduleState } from '@/components/context/ScheduleStateContext';
import { ScrollNavButtons } from './scroll-nav-buttons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const TomorrowsMachines = () => {
  const { selectedDate, setSelectedDate, stockOnHand, setStockOnHand } =
    useScheduleState();

  const [machineIdsForDay, setMachineIdsForDay] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [machineToAdd, setMachineToAdd] = useState<string | null>(null);
  const [machineForCalendar, setMachineForCalendar] = useState<string | null>(
    null,
  );
  const [specialMachineDates, setSpecialMachineDates] = useState<
    Record<string, string>
  >({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [aaMachineIds, setAaMachineIds] = useState<Set<string>>(new Set());
  const [addMachineCalendarOpen, setAddMachineCalendarOpen] = useState(false);
  const [calendarDayPicker, setCalendarDayPicker] = useState(false);
  const [servicedMachines, setServicedMachines] = useState<
    Record<string, boolean>
  >({});

  const { scheduleCache, setScheduleCache } = useScheduleCache();
  const { toast } = useToast();
  const { getMachineOverview, getSalesByProducts } = useTelemetronApi();

  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    machineId: string | null;
    lastDate: Date | null;
  }>({ open: false, machineId: null, lastDate: null });

  // --- DATA FETCHING AND SAVING ---
  const loadScheduleForDate = useCallback(
    async (date: Date) => {
      setIsLoading(true);
      // Сбрасываем AA статусы при смене даты, чтобы не было старых данных при расчете счетчика
      setAaMachineIds(new Set());
      
      try {
        const dateKey = format(date, 'yyyy-MM-dd');

        // Загрузка состояния обслуженных аппаратов
        const servicedKey = `serviced-machines-${dateKey}`;
        const savedServiced = localStorage.getItem(servicedKey);
        setServicedMachines(savedServiced ? JSON.parse(savedServiced) : {});

        let scheduleIds: string[] | null;

        if (dateKey in scheduleCache) {
          scheduleIds = scheduleCache[dateKey];
        } else {
          scheduleIds = await getDailySchedule(dateKey);
          setScheduleCache(prev => ({ ...prev, [dateKey]: scheduleIds }));
        }

        const initialSpecialDates = await getSpecialMachineDates();
        
        // Очищаем ID от дубликатов и несуществующих в справочнике аппаратов
        const rawIds = scheduleIds || [];
        const loadedIds = Array.from(new Set(rawIds)).filter(id => 
          allMachines.some(m => m.id === id)
        );
        
        const finalDates: Record<string, string> = {};
        const newAaMachineIds = new Set<string>();

        const normalMachines: string[] = [];
        const specialMachines: string[] = [];

        loadedIds.forEach(id => {
          const machine = allMachines.find(m => m.id === id);
          if (isSpecialMachine(machine)) {
            specialMachines.push(id);
          } else {
            normalMachines.push(id);
          }
        });

        const checkAAPromises = loadedIds.map(async id => {
          try {
            const dateTo = new Date();
            const dateFrom = new Date();
            dateFrom.setDate(dateTo.getDate() - 7);
            const salesData = await getSalesByProducts(
              id,
              format(dateFrom, 'yyyy-MM-dd HH:mm:ss'),
              format(dateTo, 'yyyy-MM-dd HH:mm:ss'),
            );
            if (
              salesData.data &&
              salesData.data.length > 0 &&
              salesData.data.every(
                (item: TelemetronSaleItem) => item.product_number === 'AA',
              )
            ) {
              return { id, isAA: true };
            }
          } catch (e) {
            console.error(`Ошибка проверки АА статуса для ${id}:`, e);
          }
          return { id, isAA: false };
        });

        const aaResults = await Promise.all(checkAAPromises);
        aaResults.forEach(result => {
          if (result.isAA) {
            newAaMachineIds.add(result.id);
          }
        });

        const normalMachinePromises = normalMachines
          .filter(id => !newAaMachineIds.has(id))
          .map(async id => {
            try {
              const overview = await getMachineOverview(id);
              const lastCollection = overview.data?.cache?.last_collection_at;
              if (lastCollection) {
                return { id, date: lastCollection, source: 'api' };
              } else {
                return { id, date: null, source: 'api' };
              }
            } catch (e) {
              console.error(
                `Не удалось получить overview для обычного аппарата ${id}`,
                e,
              );
              return { id, date: null, source: 'api' };
            }
          });

        const normalResults = await Promise.all(normalMachinePromises);
        normalResults.forEach(result => {
          if (result.date) {
            finalDates[result.id] = result.date;
          }
        });

        const specialMachinePromises = specialMachines
          .filter(id => !newAaMachineIds.has(id))
          .map(async id => {
            const redisDate = initialSpecialDates[id];
            if (redisDate) {
              return { id, date: redisDate, source: 'redis' };
            }

            try {
              const overview = await getMachineOverview(id);
              const lastCollection = overview.data?.cache?.last_collection_at;
              if (lastCollection) {
                return { id, date: lastCollection, source: 'api-fallback' };
              }
            } catch (e) {
              console.warn(
                `Не удалось получить дату из API для специального аппарата ${id}`,
                e,
              );
            }

            return { id, date: null, source: 'none' };
          });

        const specialResults = await Promise.all(specialMachinePromises);
        specialResults.forEach(result => {
          if (result.date) {
            finalDates[result.id] = result.date;
          }
        });

        setSpecialMachineDates(finalDates);
        setAaMachineIds(newAaMachineIds);
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
    [
      toast,
      getMachineOverview,
      getSalesByProducts,
      scheduleCache,
      setScheduleCache,
    ],
  );

  useEffect(() => {
    loadScheduleForDate(selectedDate);
  }, [selectedDate, loadScheduleForDate]);

  useEffect(() => {
    const servicedKey = `serviced-machines-${format(
      selectedDate,
      'yyyy-MM-dd',
    )}`;
    localStorage.setItem(servicedKey, JSON.stringify(servicedMachines));
  }, [servicedMachines, selectedDate]);

  const handleSaveChanges = useCallback(async () => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const result = await saveDailySchedule(dateString, machineIdsForDay);

    setScheduleCache(prev => ({
      ...prev,
      [dateString]: machineIdsForDay,
    }));

    if (result.success) {
      try {
        const nextWeek = new Date(selectedDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekString = format(nextWeek, 'yyyy-MM-dd');

        await saveDailySchedule(nextWeekString, machineIdsForDay);

        setScheduleCache(prev => ({
          ...prev,
          [nextWeekString]: machineIdsForDay,
        }));

        toast({
          title: 'Расписание сохранено',
          description: `Список аппаратов на ${format(
            selectedDate,
            'dd.MM.yyyy',
          )} сохранен. Также сохранено на ${format(nextWeek, 'dd.MM.yyyy')}.`,
        });
      } catch (error) {
        console.error('Ошибка при сохранении на след неделю:', error);
        toast({
          title: 'Расписание частично сохранено',
          description: `Список аппаратов на ${format(
            selectedDate,
            'dd.MM.yyyy',
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
  }, [selectedDate, machineIdsForDay, toast, setScheduleCache]);

  const machinesForDay = useMemo(() => {
    return allMachines
      .filter(machine => machineIdsForDay.includes(machine.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [machineIdsForDay]);

  const unselectedMachines = useMemo(() => {
    return allMachines.filter(m => !machineIdsForDay.includes(m.id));
  }, [machineIdsForDay]);

  const addMachineToDay = useCallback(
    (id: string) => {
      if (id && !machineIdsForDay.includes(id)) {
        setMachineIdsForDay(prev => [...prev, id]);
        setHasUnsavedChanges(true);
      }
      setMachineToAdd(null);
      setComboboxOpen(false);
    },
    [machineIdsForDay],
  );

  const handleAddButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleAddMachineClick();
  };

  const handleAddMachineClick = useCallback(async () => {
    if (!machineToAdd) return;

    setIsLoading(true);

    try {
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateTo.getDate() - 7);
      const salesData = await getSalesByProducts(
        machineToAdd,
        format(dateFrom, 'yyyy-MM-dd HH:mm:ss'),
        format(dateTo, 'yyyy-MM-dd HH:mm:ss'),
      );

      if (
        salesData.data &&
        salesData.data.length > 0 &&
        salesData.data.every(
          (item: TelemetronSaleItem) => item.product_number === 'AA',
        )
      ) {
        setAaMachineIds(prev => new Set(prev).add(machineToAdd!));
        addMachineToDay(machineToAdd!);
        setIsLoading(false);
        return;
      }

      const machine = allMachines.find(m => m.id === machineToAdd);
      const special = isSpecialMachine(machine);

      let dateFound: string | null | undefined = null;

      if (special) {
        const allSpecialDatesFromRedis = await getSpecialMachineDates();
        dateFound = allSpecialDatesFromRedis[machineToAdd];
      } else {
        const overview = await getMachineOverview(machineToAdd);
        dateFound = overview.data?.cache?.last_collection_at;
      }

      if (dateFound) {
        setDialogState({
          open: true,
          machineId: machineToAdd,
          lastDate: new Date(dateFound),
        });
      } else {
        toast({
          title: 'Требуется указать дату',
          description: `Для аппарата #${machineToAdd} не найдена дата. Пожалуйста, выберите дату.`,
        });
        setAddMachineCalendarOpen(true);
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
    if (dialogState.machineId && dialogState.lastDate) {
      setSpecialMachineDates(prev => ({
        ...prev,
        [dialogState.machineId!]: dialogState.lastDate!.toISOString(),
      }));
      addMachineToDay(dialogState.machineId);
    }
    setDialogState({ open: false, machineId: null, lastDate: null });
  };

  const handleDialogCancel = () => {
    if (dialogState.machineId) {
      setMachineForCalendar(dialogState.machineId);
      setAddMachineCalendarOpen(true);
    }
    setDialogState({ open: false, machineId: null, lastDate: null });
  };

  const handleCalendarSelect = async (
    date: Date | undefined,
    machineId: string,
  ) => {
    const currentMachineId = machineId;

    if (date && currentMachineId) {
      const machine = allMachines.find(m => m.id === currentMachineId);

      if (isSpecialMachine(machine)) {
        const result = await setSpecialMachineDate(
          currentMachineId,
          date.toISOString(),
        );
        if (result.success) {
          setSpecialMachineDates(prev => ({
            ...prev,
            [currentMachineId]: date.toISOString(),
          }));
          toast({
            title: 'Дата сохранена',
            description: `Начальная дата для специального аппарата #${currentMachineId} сохранена в Redis.`,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Ошибка',
            description: 'Не удалось сохранить дату в Redis.',
          });
        }
      } else {
        setSpecialMachineDates(prev => ({
          ...prev,
          [currentMachineId]: date.toISOString(),
        }));
        toast({
          title: 'Дата обновлена',
          description: `Дата для обычного аппарата #${currentMachineId} обновлена локально.`,
        });
      }

      if (!machineIdsForDay.includes(currentMachineId)) {
        addMachineToDay(currentMachineId);
      }
    }
    setMachineForCalendar(null);
  };

  const handleToggleServiced = (machineId: string) => {
    setServicedMachines(prev => ({
      ...prev,
      [machineId]: !prev[machineId],
    }));
  };

  const handleResetChanges = () => {
    loadScheduleForDate(selectedDate);
    toast({
      title: 'Изменения сброшены',
      description: 'Восстановлен последний сохраненный список.',
    });
  };

  const handleStockChange = (itemName: string, value: string) => {
    if (/^\d{0,2}$/.test(value)) {
      setStockOnHand(prev => ({ ...prev, [itemName]: value }));
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
    <div className='space-y-6'>
      <Tabs defaultValue='schedule' className='w-full'>
        <TabsList className='grid w-full grid-cols-2 h-12 mb-4'>
          <TabsTrigger value='schedule' className='flex items-center gap-2 text-base'>
            <ClipboardList className='h-5 w-5' />
            <span>Заявка</span>
          </TabsTrigger>
          <TabsTrigger value='inventory' className='flex items-center gap-2 text-base'>
            <Package className='h-5 w-5' />
            <span>Склад / Остатки</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='schedule' className='space-y-6'>
          <Card className='shadow-lg'>
            <CardHeader>
              <CardTitle className='font-headline text-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <CalendarIcon className='h-6 w-6 text-primary' />
                  <span>Аппараты на дату</span>
                </div>
                <Popover
                  open={calendarDayPicker}
                  onOpenChange={setCalendarDayPicker}
                >
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
                  <PopoverContent className='w-auto p-0' align='center'>
                    <Calendar
                      mode='single'
                      selected={selectedDate}
                      onSelect={date => {
                        if (date) {
                          setSelectedDate(date);
                          setCalendarDayPicker(false);
                        }
                      }}
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
                    const isServiced = servicedMachines[machine.id];
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
                        className={cn(
                          'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg',
                          isServiced && 'bg-green-900/20 border-green-700',
                        )}
                      >
                        <div className='flex-1 min-w-0'>
                          <p
                            className={cn(
                              'font-medium truncate',
                              isServiced && 'text-green-300',
                            )}
                          >
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
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-6 w-6 p-0'
                                    title='Изменить дату'
                                  >
                                    <CalendarIcon className='h-3 w-3' />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className='w-auto p-0'
                                  align='start'
                                >
                                  <Calendar
                                    locale={ru}
                                    mode='single'
                                    onSelect={date =>
                                      handleCalendarSelect(date, machine.id)
                                    }
                                    selected={
                                      serviceDate
                                        ? new Date(serviceDate)
                                        : undefined
                                    }
                                    disabled={date =>
                                      date > new Date() ||
                                      date < new Date('2020-01-01')
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                        </div>

                        <div className='flex items-center gap-2 self-end sm:self-center flex-shrink-0'>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => handleToggleServiced(machine.id)}
                            className={cn(
                              isServiced && 'text-green-500 hover:text-green-400',
                            )}
                          >
                            <CheckCircle className='h-4 w-4' />
                            <span className='sr-only'>Отметить обслуженным</span>
                          </Button>
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
                          machine => machine.id === machineToAdd,
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
                                    : 'opacity-0',
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
                  open={addMachineCalendarOpen}
                  onOpenChange={setAddMachineCalendarOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      onClick={handleAddButtonClick}
                      disabled={!machineToAdd || isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      ) : (
                        <PlusCircle className='mr-2 h-4 w-4' />
                      )}
                      Добавить
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0'>
                    <Calendar
                      mode='single'
                      selected={undefined}
                      onSelect={date => {
                        if (date && (machineToAdd || machineForCalendar)) {
                          handleCalendarSelect(
                            date,
                            (machineToAdd || machineForCalendar)!,
                          );
                        }
                        setAddMachineCalendarOpen(false);
                      }}
                      locale={ru}
                      disabled={date =>
                        date > new Date() || date < new Date('2020-01-01')
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {machineIdsForDay.length > 0 && (
                <div className='mt-4'>
                  <GroupedShoppingLists
                    key={`${selectedDate.toISOString()}-${machineIdsForDay.join(
                      '-',
                    )}`}
                    machineIds={machineIdsForDay}
                    specialMachineDates={specialMachineDates}
                    aaMachineIds={aaMachineIds}
                    stockOnHand={stockOnHand}
                    onStockChange={handleStockChange}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='inventory'>
          <InventoryManager />
        </TabsContent>
      </Tabs>

      <ScrollNavButtons />
    </div>
  );
};
