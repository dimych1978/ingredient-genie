
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Icons } from '@/components/icons';
import { ShoppingList } from '@/components/shopping-list';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MapPin, Calendar, Package, Clock } from 'lucide-react';
import Link from 'next/link';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { useTeletmetronAuth } from '@/hooks/useTelemetronAuth';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getSpecialMachineDates, setSpecialMachineDate } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { allMachines, Machine } from '@/lib/data';

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

const isSpecialMachine = (machine: Machine | undefined): boolean => {
  if (!machine || !machine.model) return false;
  const model = machine.model.toLowerCase();
  return model.includes('krea') || model.includes('tcn');
};

export default function MachineStatusPage() {
  const params = useParams();
  const id = params.id as string;
  const [machineOverview, setMachineOverview] = useState<MachineOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [effectiveStartDate, setEffectiveStartDate] = useState<string | null>(null);
  const [isManualDate, setIsManualDate] = useState(false);

  const { getMachineOverview } = useTeletmetronApi();
  const { token } = useTeletmetronAuth();
  const { toast } = useToast();
  
  const machineData = useMemo(() => allMachines.find(m => m.id === id), [id]);

  useEffect(() => {
    const fetchMachineData = async () => {
      if (!id || !token) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const overviewResult = await getMachineOverview(id);
        setMachineOverview(overviewResult.data);

        const lastCollectionDate = overviewResult.data?.cache?.last_collection_at;
        const special = isSpecialMachine(machineData);

        let finalStartDate: Date;
        
        if (special) {
            const dates = await getSpecialMachineDates();
            const savedDate = dates[id];
            if (savedDate) {
                finalStartDate = new Date(savedDate);
            } else {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                finalStartDate = yesterday;
            }
            setIsManualDate(true);
        } else if (lastCollectionDate) {
            finalStartDate = new Date(lastCollectionDate);
            setIsManualDate(false);
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            finalStartDate = yesterday;
            setIsManualDate(true);
        }

        setEffectiveStartDate(finalStartDate.toISOString());
        
      } catch (e) {
        const err = e instanceof Error ? e.message : 'Ошибка при загрузке данных аппарата';
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMachineData();
  }, [id, token, getMachineOverview, machineData]);

  const handleManualDateChange = (isoDate: string) => {
     setEffectiveStartDate(isoDate);
     // Если это специальный аппарат, сохраняем дату
     if (isSpecialMachine(machineData)) {
        const saveDate = async () => {
             const result = await setSpecialMachineDate(id, isoDate);
             if(result.success){
                toast({ title: 'Дата сохранена', description: 'Начальная дата для этого аппарата обновлена.' });
             } else {
                toast({ variant: 'destructive', title: 'Ошибка', description: 'Не удалось сохранить дату.' });
             }
        };
        saveDate();
     }
  };


  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="font-semibold font-headline text-lg">Загрузка данных аппарата...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md bg-destructive/10 border-destructive">
          <CardHeader><CardTitle>Ошибка</CardTitle></CardHeader>
          <CardContent><p className="text-destructive">{error}</p></CardContent>
        </Card>
      </main>
    );
  }
  
  if (!machineOverview || !effectiveStartDate) {
     return (
       <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p>Инициализация...</p>
        </div>
      </main>
     );
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <header className="mb-8 md:mb-12">
          <div className="flex items-center gap-4 mb-2">
         
         
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4 w-fit">
                <Icons.logo className="h-8 w-8 text-primary" />
                <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
                  Аппарат #{id}
                </h1>
              </Link>
              
              {machineOverview.machine?.name && (
                <div className="flex items-center gap-2 mt-1">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div className="text-lg font-medium text-foreground">
                    {machineOverview.machine.name}
                  </div>
                </div>
              )}
              
              {machineOverview.location && (
                <div className="flex items-start gap-2 mt-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium">{machineOverview.location.name}</div>
                    <div>{machineOverview.location.address}</div>
                  </div>
                </div>
              )}

              {machineOverview.cache?.last_collection_at && !isManualDate ? (
                <div className="flex items-start gap-2 mt-2 text-muted-foreground">
                  <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium">Последняя инкассация (Telemetron):</div>
                    <div>{format(new Date(machineOverview.cache.last_collection_at), 'dd MMMM yyyy, HH:mm', { locale: ru })}</div>
                  </div>
                </div>
              ) : (
                 <div className="flex items-start gap-2 mt-2 text-muted-foreground">
                  <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium">Дата инкассации (Telemetron):</div>
                    <div>{isSpecialMachine(machineData) ? 'Ручной ввод для этого типа аппарата' : 'Нет данных'}</div>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-2 mt-4 text-sm">
                <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-foreground">Период для загрузки:</div>
                  <div className="text-muted-foreground">
                    с {format(new Date(effectiveStartDate), 'dd.MM.yyyy', { locale: ru })} 
                    по {format(new Date(), 'dd.MM.yyyy', { locale: ru })}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </header>
        
        <div className="space-y-6">
           <ShoppingList 
                machineIds={[id]} 
                title={`Что брать к аппарату #${id}`}
                description="Список расходников на основе продаж"
                showControls={isManualDate}
                forceLoad={true} // Всегда загружаем, т.к. дата теперь есть всегда
                specialMachineDates={{ [id]: effectiveStartDate }}
                onDateChange={handleManualDateChange}
              />
        </div>
      </div>
    </main>
  );
}
