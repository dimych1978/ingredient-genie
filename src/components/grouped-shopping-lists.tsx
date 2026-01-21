//grouped-shopping-lists.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { allMachines, GroupedShoppingListsProps, getMachineType } from '@/lib/data';
import { ShoppingList } from './shopping-list';
import { Coffee, Box, GlassWater } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getLastTelemetronPress } from '@/app/actions';


export const GroupedShoppingLists = ({ 
  machineIds, 
  specialMachineDates,
  onSaveChanges,
}: GroupedShoppingListsProps) => {
  const [showLists, setShowLists] = useState(false);
  // const [actualDates, setActualDates] = useState(specialMachineDates);

  const groupedMachines = useMemo(() => {
    const groups: Record<string, string[]> = {
      coffee: [],
      snack: [],
      bottle: [],
    };

    machineIds.forEach(id => {
      const machine = allMachines.find(m => m.id === id);
      if (machine) {
        const type = getMachineType(machine);
        groups[type].push(id);
      }
    });

    return groups;
  }, [machineIds]);

  const groupConfigs = [
    { type: 'coffee', title: 'Общий заказ для кофейных аппаратов', icon: <Coffee className="h-5 w-5 text-yellow-400" /> },
    { type: 'snack', title: 'Общий заказ для снековых аппаратов', icon: <Box className="h-5 w-5 text-blue-400" /> },
    { type: 'bottle', title: 'Общий заказ для бутылочных аппаратов', icon: <GlassWater className="h-5 w-5 text-green-400" /> },
  ];

  const handleGenerateClick = useCallback(() => {
    // Сначала сохраняем заявку
    if (machineIds.length > 0) {
      onSaveChanges();
    }
    // Потом показываем списки
    setShowLists(prev => !prev);
  }, [machineIds.length, onSaveChanges]);

// useEffect(() => {
//     const loadDates = async () => {
//       const dates: Record<string, string> = {};
//       for (const id of machineIds) {
//         const date = await getLastTelemetronPress(id);
//         if (date) dates[id] = date;
//       }
//       setActualDates(dates);
//     };
//     if (machineIds.length > 0) loadDates();
//   }, [machineIds]);

  return (
    <div className="space-y-6">
        <Card className="bg-muted/20">
            <CardHeader>
                <CardTitle>Формирование общих заказов</CardTitle>
                <CardDescription>
                  {machineIds.length > 0 
                    ? `Нажмите кнопку, чтобы создать сводные списки по ${machineIds.length} аппаратам.` 
                    : 'Сначала добавьте аппараты в список выше.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Button 
                   onClick={handleGenerateClick} 
                   className="w-full"
                   disabled={machineIds.length === 0}
                 >
                    {showLists ? 'Скрыть списки' : 'Сформировать общие заказы'}
                </Button>
            </CardContent>
        </Card>
      
      {showLists && groupConfigs.map(config => {
        const ids = groupedMachines[config.type as 'coffee' | 'snack' | 'bottle'];
        if (ids.length > 0) {
          return (
            <ShoppingList
              key={config.type}
              machineIds={ids}
              title={config.title}
              description={`На основе продаж для ${ids.length} апп.`}
              showControls={false}
              forceLoad
              specialMachineDates={specialMachineDates} 
              sort="alphabetical"
              markAsServiced={false}
            />
          );
        }
        return null;
      })}
    </div>
  );
};