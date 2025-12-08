
'use client';

import { useState, useMemo, useCallback } from 'react';
import { allMachines, Machine } from '@/lib/data';
import { ShoppingList } from './shopping-list';
import { Coffee, Box, GlassWater } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GroupedShoppingListsProps {
  machineIds: string[];
  specialMachineDates: Record<string, string>;
}

const getMachineType = (machine: Machine): 'coffee' | 'snack' | 'bottle' => {
  const name = machine.name.toLowerCase();
  if (name.includes('krea') || name.includes('opera') || name.includes('kikko') || name.includes('colibri') || name.includes('saeco') || name.includes('jetinno')) {
    return 'coffee';
  }
  if (name.includes('snakky') || name.includes('tcn') || name.includes('fas') || name.includes('foodbox')) {
    return 'snack';
  }
  if (name.includes('sanden') || name.includes('sve')) {
      return 'bottle';
  }
  return 'snack'; // Default to snack if unsure
};

export const GroupedShoppingLists = ({ machineIds, specialMachineDates }: GroupedShoppingListsProps) => {
  const [showLists, setShowLists] = useState(false);

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
    setShowLists(prev => !prev);
  }, []);

  return (
    <div className="space-y-6">
        <Card className="bg-muted/20">
            <CardHeader>
                <CardTitle>Формирование общих заказов</CardTitle>
                <CardDescription>Нажмите кнопку, чтобы создать сводные списки по типам аппаратов.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={handleGenerateClick} className="w-full">
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
            />
          );
        }
        return null;
      })}
    </div>
  );
};
