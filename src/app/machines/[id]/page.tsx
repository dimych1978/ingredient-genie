'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icons } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Server, BarChart } from 'lucide-react';
import Link from 'next/link';
import { useTeletmetronApi } from '@/hooks/useTelemetronApi';
import { useTeletmetronAuth } from '@/hooks/useTelemetronAuth';
import { Button } from '@/components/ui/button';

export default function MachineStatusPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any | null>(null);
  const [machineInfo, setMachineInfo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getSalesByProducts, getMachineOverview } = useTeletmetronApi();
  const { token } = useTeletmetronAuth();
  
  useEffect(() => {
    const fetchStatus = async () => {
      if (!id || !token) {
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        const dateFrom = '2025-11-17T00:00:00.000';
        const dateTo = '2025-11-23T23:59:59.999';

        console.log(`Запрос данных о продажах для аппарата #${id}...`);
        const result = await getSalesByProducts(id, dateFrom, dateTo);
        
        console.log('Ответ от API Telemetron:', result);
        setData(result);

      } catch (e) {
        const err = e instanceof Error ? e.message : 'An unknown error occurred.';
        console.error('Ошибка при загрузке данных:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [id, token]);

  // Тестовые функции
  const testMachineOverview = async () => {
    if (!id) return;
    
    setTesting(true);
    setError(null);
    try {
      console.log(`🧪 Тестируем machines-overview для аппарата #${id}...`);
      const result = await getMachineOverview(id);
      console.log('✅ Результат:', result);
      setMachineInfo(result);
      
      // Показываем основную информацию в alert
      if (result?.data?.machine) {
        alert(`✅ Машина: ${result.data.machine.name}\nID: ${result.data.machine.id}\nЛокация: ${result.data.location?.address || 'Нет данных'}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Ошибка теста';
      console.error('❌ Ошибка теста:', err);
      setError(err);
      alert(`❌ Ошибка: ${err}`);
    } finally {
      setTesting(false);
    }
  };

  const testSalesReport = async () => {
    if (!id) return;
    
    setTesting(true);
    setError(null);
    try {
      const dateFrom = '2025-11-30T00:00:00.000';
      const dateTo = '2025-12-07T23:59:59.999';
      
      console.log(`🧪 Тестируем sales-by-products для аппарата #${id}...`);
      const result = await getSalesByProducts(id, dateFrom, dateTo);
      console.log('✅ Результат:', result);
      
      // Показываем статистику в alert
      if (result?.data) {
        const totalItems = result.data.reduce((sum: number, item: any) => sum + item.number, 0);
        const totalSales = result.data.reduce((sum: number, item: any) => sum + item.value, 0);
        alert(`✅ Отчет по продажам:\nТоваров продано: ${totalItems}\nОбщая сумма: ${totalSales} ₽`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Ошибка теста';
      console.error('❌ Ошибка теста:', err);
      setError(err);
      alert(`❌ Ошибка: ${err}`);
    } finally {
      setTesting(false);
    }
  };

  if (isLoading && (!token || !id)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground transition-opacity duration-300">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="font-semibold font-headline text-lg">Загрузка данных аппарата...</p>
          <p className="text-sm">Пожалуйста, подождите.</p>
        </div>
      </main>
    );
  }
  
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground transition-opacity duration-300">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="font-semibold font-headline text-lg">Загрузка данных аппарата...</p>
          <p className="text-sm">Пожалуйста, подождите.</p>
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
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <header className="mb-8 md:mb-12">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/" aria-label="Вернуться на главную">
                <Icons.logo className="h-10 w-10 text-primary" />
            </Link>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
              Отчет о продажах для аппарата #{id}
            </h1>
          </div>
          <p className="text-muted-foreground">
            JSON Ответ
          </p>
        </header>

        {/* Тестовые кнопки */}
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2">
              <Server className="h-5 w-5" />
              Тестирование API (временные кнопки)
            </CardTitle>
            <CardDescription>
              Проверьте работу эндпоинтов перед добавлением основного функционала
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={testMachineOverview}
                disabled={testing || !id}
                variant="outline"
                className="flex-1"
              >
                {testing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Server className="mr-2 h-4 w-4" />}
                Тест: Информация об аппарате
              </Button>
              
              <Button
                onClick={testSalesReport}
                disabled={testing || !id}
                variant="outline"
                className="flex-1"
              >
                {testing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <BarChart className="mr-2 h-4 w-4" />}
                Тест: Отчет по продажам
              </Button>
            </div>
            
            {machineInfo && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <div className="font-medium text-green-800">✅ Информация об аппарате получена</div>
                <div className="text-sm text-green-700 mt-1">
                  {machineInfo.data?.machine?.name && (
                    <div>Название: {machineInfo.data.machine.name}</div>
                  )}
                  {machineInfo.data?.location?.address && (
                    <div>Адрес: {machineInfo.data.location.address}</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Основные данные */}
        <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">JSON Ответ</CardTitle>
              <CardDescription>Данные о продажах, полученные от сервера.</CardDescription>
            </CardHeader>
            <CardContent>
                {data ? (
                    <pre className="bg-muted/30 p-4 rounded-lg overflow-x-auto text-sm">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                ) : (
                    <p>Нет данных для отображения. Возможно, токен еще не был получен или ID аппарата не указан.</p>
                )}
            </CardContent>
          </Card>
      </div>
    </main>
  );
}