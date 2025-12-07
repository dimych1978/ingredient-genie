'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icons } from '@/components/icons';
import { ShoppingList } from '@/components/shopping-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { useTeletmetronAuth } from '@/hooks/useTelemetronAuth';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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
    last_collection_at: string;
  };
}

export default function MachinePage() {
  const params = useParams();
  const id = params.id as string;
  const [machineOverview, setMachineOverview] = useState<MachineOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { token } = useTeletmetronAuth();
  const {getMachineOverview} = useTeletmetronApi()

  // Форматирование даты из Telemetron
  const formatTelemetronDate = (dateString: string | null) => {
    if (!dateString) return 'Не указана';
    try {
      const date = new Date(dateString);
      return format(date, 'dd.MM.yyyy', { locale: ru });
    } catch {
      return dateString;
    }
  };

  // Получение завтрашней даты
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  };

  useEffect(() => {
  const fetchMachineOverview = async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Запрос информации об аппарате #${id}...`);
      
      // Используем метод из хука
      const result = await getMachineOverview(id);
      console.log('Информация об аппарате:', result);
      
      setMachineOverview(result.data);
      
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Ошибка при загрузке данных аппарата';
      console.error('Ошибка:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  fetchMachineOverview();
}, [id, getMachineOverview]);

useEffect(() => {
  const fetchMachineOverview = async () => {
    if (!id || !token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Запрос информации об аппарате #${id}...`);
      
      // Используем FormData для machines-overview
      const formData = new FormData();
      formData.append('_method', 'get');
      formData.append('data[id]', id);
      
      // Используем НАШ ПРОКСИ вместо прямого запроса
      const response = await fetch(`/api/telemetron/machines-overview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // НЕ добавляем Content-Type - браузер сам установит для FormData
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Ошибка ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Информация об аппарате:', result);
      
      setMachineOverview(result.data);
      
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Ошибка при загрузке данных аппарата';
      console.error('Ошибка:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  fetchMachineOverview();
}, [id, token]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="font-semibold font-headline text-lg">Загрузка аппарата...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle>Ошибка</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Не удалось загрузить информацию об аппарате #{id}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Заголовок с информацией об аппарате */}
        <header className="mb-8 md:mb-12">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/" aria-label="Вернуться на главную">
              <Icons.logo className="h-10 w-10 text-primary" />
            </Link>
            <div>
              <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
                Аппарат #{id}
              </h1>
              
              {machineOverview?.machine?.name && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-lg font-medium text-foreground">
                    {machineOverview.machine.name}
                  </div>
                </div>
              )}
              
              {machineOverview?.location && (
                <div className="flex items-start gap-2 mt-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium">{machineOverview.location.name}</div>
                    <div>{machineOverview.location.address}</div>
                  </div>
                </div>
              )}
              
              {/* Период для Shopping List */}
              <div className="flex items-start gap-2 mt-4 text-sm">
                <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <div className="font-medium text-foreground">Период для загрузки:</div>
                  <div className="text-muted-foreground">
                    {machineOverview?.cache?.last_collection_at ? (
                      <>
                        с {formatTelemetronDate(machineOverview.cache.last_collection_at)} 
                        по {format(getTomorrowDate(), 'dd.MM.yyyy', { locale: ru })}
                      </>
                    ) : (
                      'Последняя неделя'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Shopping List - показывается сразу */}
        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Список для загрузки</CardTitle>
            </CardHeader>
            <CardContent>
              <ShoppingList 
                machineId={id} 
                // Передаем даты по умолчанию, если есть данные
                defaultStartDate={machineOverview?.cache?.last_collection_at || undefined}
                defaultEndDate={getTomorrowDate().toISOString()}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}