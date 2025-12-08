
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { weeklySchedule, allMachines, Machine } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { GroupedShoppingLists } from '@/components/grouped-shopping-lists';
import { Calendar as CalendarIcon, X, PlusCircle, Eye } from 'lucide-react';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getSpecialMachineDates, setSpecialMachineDate } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

const isSpecialMachine = (machine: Machine | undefined): boolean => {
  if (!machine) return false;
  const name = machine.name.toLowerCase();
  return name.includes('krea') || name.includes('tcn');
};

export const TomorrowsMachines = () => {
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    return today;
  });
  
  const [machineIdsForDay, setMachineIdsForDay] = useState<string[]>([]);
  const [machineToAdd, setMachineToAdd] = useState<string | null>(null);
  const [specialMachineDates, setSpecialMachineDates] = useState<Record<string, string>>({});
  
  const { toast } = useToast();

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

  // Загружаем даты при монтировании
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const dates = await getSpecialMachineDates();
        setSpecialMachineDates(dates);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'Не удалось загрузить даты специальных аппаратов.',
        });
      }
    };
    fetchDates();
  }, [toast]);

  useEffect(() => {
    const dayOfWeek = selectedDate.getDay();
    const scheduledKeys = weeklySchedule[dayOfWeek] || [];
    
    const initialMachineIds = new Set<string>();

    scheduledKeys.forEach(key => {
      if (allMachines.some(m => m.id === key)) {
        initialMachineIds.add(key);
      } else {
        allMachines.forEach(machine => {
          if (machine.name.toLowerCase().includes(key.toLowerCase())) {
            initialMachineIds.add(machine.id);
          }
        });
      }
    });

    setMachineIdsForDay(Array.from(initialMachineIds));
    setShowShoppingList(false);
  }, [selectedDate]);
  
  const machinesForDay = useMemo(() => {
      return allMachines.filter(machine => machineIdsForDay.includes(machine.id));
  }, [machineIdsForDay]);

  const addMachineToDay = useCallback((id: string) => {
    if (id && !machineIdsForDay.includes(id)) {
      setMachineIdsForDay(prev => [...prev, id]);
    }
    setMachineToAdd(null);
  }, [machineIdsForDay]);

  const handleAddMachineClick = () => {
    if (!machineToAdd) return;
    const machine = allMachines.find(m => m.id === machineToAdd);
    
    if (isSpecialMachine(machine)) {
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
    if (dialogState.machineId) {
      setCalendarState({ open: true, machineId: dialogState.machineId });
    }
    setDialogState({ open: false, machineId: null, lastDate: null });
  };

  const handleCalendarSelect = async (date: Date | undefined) => {
    if (date && calendarState.machineId) {
      const result = await setSpecialMachineDate(calendarState.machineId, date.toISOString());
      if (result.success) {
        setSpecialMachineDates(prev => ({...prev, [calendarState.machineId!]: date.toISOString()}));
        addMachineToDay(calendarState.machineId);
        toast({
          title: 'Дата сохранена',
          description: `Начальная дата для аппарата #${calendarState.machineId} установлена.`,
        });
      } else {
         toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'Не удалось сохранить дату.',
        });
      }
    }
    setCalendarState({ open: false, machineId: null });
  };

  const getFormattedDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };
  
  const unselectedMachines = useMemo(() => {
    return allMachines.filter(m => !machineIdsForDay.includes(m.id));
  }, [machineIdsForDay]);


  return (
    <>
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                <CalendarIcon className="h-6 w-6 text-primary"/>
                <span>Аппараты на дату</span>
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {getFormattedDate(selectedDate)}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                        locale={ru}
                    />
                </PopoverContent>
            </Popover>
        </CardTitle>
        <CardDescription>
            Список аппаратов для обслуживания на выбранную дату. Вы можете добавить или удалить аппараты из списка.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {machinesForDay.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Местоположение</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machinesForDay.map((machine) => (
                <TableRow key={machine.id}>
                  <TableCell className="font-mono">#{machine.id}</TableCell>
                  <TableCell className="font-medium">{machine.name}</TableCell>
                  <TableCell className="text-muted-foreground">{machine.location}</TableCell>
                  <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/machines/${machine.id}`}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Посмотреть</span>
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveMachine(machine.id)}>
                        <X className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Удалить</span>
                      </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-4">На {format(selectedDate, 'dd.MM.yyyy')} аппаратов не запланировано.</p>
        )}
        
        <div className="flex gap-2 items-center p-2 border rounded-lg">
             <Select onValueChange={setMachineToAdd} value={machineToAdd || ''}>
                <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Выберите аппарат для добавления..." />
                </SelectTrigger>
                <SelectContent>
                    {unselectedMachines.map(machine => (
                        <SelectItem key={machine.id} value={machine.id}>
                            {machine.name} (#{machine.id}) - {machine.location}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
             <Button onClick={handleAddMachineClick} disabled={!machineToAdd}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Добавить
             </Button>
        </div>

        {machineIdsForDay.length > 0 && (
          <div className="mt-4">
              <GroupedShoppingLists
                machineIds={machineIdsForDay}
                specialMachineDates={specialMachineDates}
              />
          </div>
        )}
      </CardContent>
    </Card>

    <AlertDialog open={dialogState.open} onOpenChange={(open) => !open && setDialogState({open: false, machineId: null, lastDate: null})}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Подтверждение даты</AlertDialogTitle>
          <AlertDialogDescription>
            Последний заказ для этого аппарата был создан {dialogState.lastDate ? format(dialogState.lastDate, 'dd MMMM yyyy г.', { locale: ru }) : ''}. Использовать эту дату как начальную?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDialogCancel}>Нет, выбрать другую</AlertDialogCancel>
          <AlertDialogAction onClick={handleDialogConfirm}>Да, использовать</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    
     <AlertDialog open={calendarState.open} onOpenChange={(open) => !open && setCalendarState({open: false, machineId: null})}>
      <AlertDialogContent className="w-auto p-2">
        <AlertDialogHeader>
          <AlertDialogTitle>Выберите начальную дату</AlertDialogTitle>
           <AlertDialogDescription>
            Выберите дату последнего обслуживания для аппарата #{calendarState.machineId}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Calendar
            mode="single"
            onSelect={handleCalendarSelect}
            initialFocus
            locale={ru}
            disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
        />
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};
