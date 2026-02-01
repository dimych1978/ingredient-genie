// app/machines/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Icons } from '@/components/icons';
import { ShoppingList } from '@/components/shopping-list';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Loader2,
  MapPin,
  Calendar as CalendarIcon,
  Package,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { useTelemetronApi } from '@/hooks/useTelemetronApi';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getSpecialMachineDates, setSpecialMachineDate } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { allMachines, isSpecialMachine, Machine } from '@/lib/data';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface MachineOverview {
  machine: {
    id: number;
    name: string;
  };
  location?: {
    name: string;
    address: string;
  };
  cache?: {
    last_collection_at: string | null;
  };
}

export default function MachineStatusPage() {
  const params = useParams();
  const id = params.id as string;
  const [machineOverview, setMachineOverview] =
    useState<MachineOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [effectiveStartDate, setEffectiveStartDate] = useState<string | null>(
    null
  );
  const [isServiced, setIsServiced] = useState(false);
  const [isManualDate, setIsManualDate] = useState(false);
  const [isCalendarOpen, setCalendarOpen] = useState(false);
  const [hasUnsavedDate, setHasUnsavedDate] = useState(false);

  const { getMachineOverview } = useTelemetronApi();
  const { toast } = useToast();

  const machineData = useMemo(() => allMachines.find(m => m.id === id), [id]);

  const fetchMachineAndDateData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);
    setHasUnsavedDate(false);

    try {
      const overviewResult = await getMachineOverview(id);

      setMachineOverview(overviewResult.data);

      const lastCollectionDate = overviewResult.data?.cache?.last_collection_at;

      const special = isSpecialMachine(machineData);

      let finalStartDate: Date;

      if (special) {
        const dates = await getSpecialMachineDates();
        const savedDateStr = dates[id];

        if (savedDateStr) {
          finalStartDate = new Date(savedDateStr);
          setIsManualDate(true);
        } else {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          finalStartDate = yesterday;
          setIsManualDate(true);
          setHasUnsavedDate(true);
        }
      } else {
        if (lastCollectionDate) {
          finalStartDate = new Date(lastCollectionDate);
          setIsManualDate(false);
        } else {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          finalStartDate = yesterday;
          setIsManualDate(true);
        }
      }

      setEffectiveStartDate(finalStartDate.toISOString());
    } catch (e) {
      console.error('Ошибка в fetchMachineAndDateData:', e);
      const err =
        e instanceof Error ? e.message : 'Ошибка при загрузке данных аппарата';
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [id, getMachineOverview, machineData]);

  useEffect(() => {
    fetchMachineAndDateData();
  }, [fetchMachineAndDateData]);

  const handleManualDateChange = useCallback(
    async (date: Date) => {
      const isoDate = date.toISOString();
      setEffectiveStartDate(isoDate);
      setHasUnsavedDate(true);
    },
    [id, machineData, toast]
  );

  const refreshTimestamp = useCallback(async (newTimestamp: string) => {
    setEffectiveStartDate(newTimestamp);
  }, []);

  if (isLoading) {
    return (
      <main className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center gap-4 text-muted-foreground'>
          <Loader2 className='h-12 w-12 animate-spin text-primary' />
          <p className='font-semibold font-headline text-lg'>
            Загрузка данных аппарата...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className='min-h-screen flex items-center justify-center'>
        <Card className='w-full max-w-md bg-destructive/10 border-destructive'>
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-destructive'>{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!machineOverview || !effectiveStartDate) {
    return (
      <main className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center gap-4 text-muted-foreground'>
          <Loader2 className='h-12 w-12 animate-spin text-primary' />
          <p>Инициализация...</p>
        </div>
      </main>
    );
  }

  const startDateForDisplay = new Date(effectiveStartDate);

  return (
    <main className='min-h-screen bg-muted/20'>
      <div className='container mx-auto px-4 py-8 md:py-12'>
        <header className='mb-8 md:mb-12'>
          <div className='flex items-center gap-4 mb-2'>
            <div>
              <Link href='/' className='flex items-center gap-2 mb-4 w-fit'>
                <Icons.logo className='h-8 w-8 text-primary' />
                <h1 className='font-headline text-3xl md:text-4xl font-bold text-primary'>
                  Аппарат #{id}
                </h1>
              </Link>
              {machineOverview.machine?.name && (
                <div className='flex items-center gap-2 mt-1'>
                  <Package className='h-5 w-5 text-muted-foreground' />
                  <div className='text-lg font-medium text-foreground'>
                    {machineOverview.machine.name}
                  </div>
                </div>
              )}
              {machineOverview.location && (
                <div className='flex items-start gap-2 mt-2 text-muted-foreground'>
                  <MapPin className='h-4 w-4 mt-0.5 flex-shrink-0' />
                  <div className='text-sm'>
                    <div className='font-medium'>
                      {machineOverview.location.name}
                    </div>
                    <div>{machineOverview.location.address}</div>
                  </div>
                </div>
              )}
              <div className='flex items-start gap-2 mt-2 text-muted-foreground'>
                <Clock className='h-4 w-4 mt-0.5 flex-shrink-0' />
                <div className='text-sm'>
                  <div className='font-medium'>Последняя инкассация:</div>
                  <div>
                    {format(startDateForDisplay, 'dd MMMM yyyy, HH:mm', {
                      locale: ru,
                    })}
                    {isManualDate && (
                      <span className='text-xs'> (ручной ввод)</span>
                    )}
                  </div>
                </div>
              </div>
              <div className='flex items-start gap-2 mt-4 text-sm'>
                <CalendarIcon className='h-4 w-4 mt-0.5 flex-shrink-0 text-primary' />
                <div>
                  <div className='font-medium text-foreground'>
                    Изменить дату начала периода:
                    {hasUnsavedDate && (
                      <span className='ml-2 text-xs bg-yellow-500 text-white px-2 py-0.5 rounded'>
                        не сохранено
                      </span>
                    )}
                  </div>
                  <Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <div className='text-muted-foreground cursor-pointer hover:underline'>
                        {format(startDateForDisplay, 'dd MMMM yyyy г.', {
                          locale: ru,
                        })}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className='w-auto p-0'>
                      <Calendar
                        mode='single'
                        selected={startDateForDisplay}
                        onSelect={date => {
                          if (date) {
                            const newDate = new Date(date);
                            handleManualDateChange(newDate);
                          }
                          setCalendarOpen(false);
                        }}
                        disabled={date =>
                          date > new Date() || date < new Date('2020-01-01')
                        }
                        initialFocus
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>{' '}
            </div>
          </div>
        </header>

        <div className='space-y-6'>
          <div className='mb-6'>
            {/* <div className='flex items-center space-x-2'>
              <input
                type='checkbox'
                id='serviced'
                checked={isServiced}
                onChange={e => setIsServiced(e.target.checked)}
                className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
              />
              <label htmlFor='serviced' className='text-sm font-medium'>
                Аппарат обслужен (нажата кнопка Telemetron)
              </label>
            </div> */}
            {/* {isServiced && (
              <p className='text-sm text-green-600 mt-1'>
                ✅ Следующее обслуживание будет рассчитываться от текущей даты
              </p>
            )} */}
          </div>
          {isSpecialMachine(machineData) && !effectiveStartDate && (
            <div className='mb-6 p-4 bg-yellow-900/20 border border-yellow-600 rounded-lg'>
              <div className='flex items-center gap-2 text-yellow-300'>
                <CalendarIcon className='h-5 w-5' />
                <span className='font-semibold'>
                  Не установлена дата инкассации
                </span>
              </div>
              <p className='text-sm text-yellow-200 mt-1'>
                Для этого аппарата нужно установить дату начала периода вручную.
                После пополнения нажмите "Сохранить состояние" - дата обновится
                автоматически.
              </p>
            </div>
          )}
          <ShoppingList
          key={`${id}-${effectiveStartDate}`}
            machineIds={[id]}
            title={`Что брать к аппарату #${id}`}
            description={
              isServiced
                ? 'Аппарат обслужен - следующий расчёт будет от текущей даты'
                : 'Список расходников на основе продаж'
            }
            dateFrom={new Date (effectiveStartDate)}
            showControls={false}
            forceLoad={true}
            specialMachineDates={
              isSpecialMachine(machineData) ? { [id]: effectiveStartDate } : {}
            }
            onDateChange={handleManualDateChange}
            onTimestampUpdate={refreshTimestamp}
            markAsServiced={isServiced} 
          />
        </div>
      </div>
    </main>
  );
}
