// src\app\actions.ts
'use server';

import { kv } from '@/lib/kv';
import type { LoadingOverride } from '@/types/telemetron';

// --- Функции для работы с датами спец. аппаратов ---

const DATES_KEY = 'special-machine-dates';

const TELEMETRON_PRESS_KEY_PREFIX = 'telemetron-press:';
const LAST_SAVE_KEY_PREFIX = 'last-save:';

// --- Функции для работы с планограммами ---

const PLANOGRAM_KEY_PREFIX = 'planogram:';

// Сохраняем планограмму
export async function savePlanogram(machineId: string, planogram: Record<string, string>): Promise<{ success: boolean }> {
   console.log('savePlanogram вызван для', machineId, 'с', Object.keys(planogram).length, 'записей');
  
  // Пример первых 3 записей для отладки
  const sampleEntries = Object.entries(planogram).slice(0, 3);
  console.log('Пример записей:', sampleEntries);

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Таймаут сохранения планограммы (10 секунд)')), 10000);
    });

 const savePromise = kv.set(`${PLANOGRAM_KEY_PREFIX}${machineId}`, planogram);
    
    // Ждем с таймаутом
    await Promise.race([savePromise, timeoutPromise]);
    
    console.log('Планограмма успешно сохранена в Redis');    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения планограммы:', error);
       if (error instanceof Error) {
      console.error('Сообщение ошибки:', error.message);
      console.error('Стек:', error.stack);
    }
    
    return { success: false };
  }
}

// Получаем сохраненную планограмму
export async function getSavedPlanogram(machineId: string): Promise<Record<string, string> | null> {
  try {
    return await kv.get<Record<string, string>>(`${PLANOGRAM_KEY_PREFIX}${machineId}`);
  } catch (error) {
    console.error('Ошибка чтения планограммы:', error);
    return null;
  }
}

// Удаляем сохраненную планограмму
export async function deleteSavedPlanogram(machineId: string): Promise<{ success: boolean }> {
  try {
    await kv.del(`${PLANOGRAM_KEY_PREFIX}${machineId}`);
    return { success: true };
  } catch (error) {
    console.error('Ошибка удаления планограммы:', error);
    return { success: false };
  }
}

// Сохраняем время нажатия Telemetron
export async function saveTelemetronPress(machineId: string, timestamp: string): Promise<void> {
  try {
    await kv.set(`${TELEMETRON_PRESS_KEY_PREFIX}${machineId}`, timestamp);
  } catch (error) {
    console.error('Ошибка сохранения нажатия Telemetron:', error);
  }
}

// Получаем последнее нажатие Telemetron
export async function getLastTelemetronPress(machineId: string): Promise<string | null> {
  try {
    return await kv.get<string>(`${TELEMETRON_PRESS_KEY_PREFIX}${machineId}`);
  } catch (error) {
    console.error('Ошибка чтения нажатия Telemetron:', error);
    return null;
  }
}

// Сохраняем время последнего сохранения состояния
export async function saveLastSaveTime(machineId: string, timestamp: string): Promise<void> {
  try {
    await kv.set(`${LAST_SAVE_KEY_PREFIX}${machineId}`, timestamp);
  } catch (error) {
    console.error('Ошибка сохранения времени сохранения:', error);
  }
}

// Получаем время последнего сохранения состояния
export async function getLastSaveTime(machineId: string): Promise<string | null> {
  try {
    return await kv.get<string>(`${LAST_SAVE_KEY_PREFIX}${machineId}`);
  } catch (error) {
    console.error('Ошибка чтения времени сохранения:', error);
    return null;
  }
}

export async function getSpecialMachineDates(): Promise<Record<string, string>> {
  try {
    const dates = await kv.get<Record<string, string>>(DATES_KEY);
    return dates || {};
  } catch (error) {
    console.error('Ошибка чтения дат из KV:', error);
    return {};
  }
}

export async function setSpecialMachineDate(id: string, date: string): Promise<{ success: boolean }> {
  try {
    const dates = await getSpecialMachineDates();
    dates[id] = date;
    await kv.set(DATES_KEY, dates);
    return { success: true };
  } catch (error) {
    console.error('Ошибка записи даты в KV:', error);
    return { success: false };
  }
}

// --- Функции для работы с файлом истории заявок ---

const SCHEDULES_KEY_PREFIX = 'daily-schedule:';

export async function getDailySchedule(date: string): Promise<string[] | null> {
  try {
    const schedule = await kv.get<string[]>(`${SCHEDULES_KEY_PREFIX}${date}`);
    return schedule || null;
  } catch (error) {
    console.error('Ошибка чтения заявки из KV:', error);
    return null;
  }
}

export async function saveDailySchedule(date: string, machineIds: string[]): Promise<{ success: boolean }> {
  try {
    await kv.set(`${SCHEDULES_KEY_PREFIX}${date}`, machineIds);
    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения заявки в KV:', error);
    return { success: false };
  }
}

// --- Функции для работы с состоянием загрузки ингредиентов ---

const OVERRIDES_KEY = 'loading-overrides';

type LoadingOverrides = Record<string, LoadingOverride>;

export async function readAllOverrides(): Promise<LoadingOverrides> {
  try {
    console.log('object');
    const overrides = await kv.hgetall<LoadingOverrides>(OVERRIDES_KEY);
    console.log("🚀 ~ readAllOverrides ~ overrides:", overrides);
    return overrides || {};
  } catch (error) {
    console.error('Ошибка чтения состояний загрузки из KV:', error);
    // Возвращаем пустой объект при ошибке соединения
    return {};
  }
}
async function writeAllOverrides(overrides: LoadingOverrides): Promise<void> {
  try {
    await kv.set(OVERRIDES_KEY, overrides);
  } catch (error) {
    console.error('Ошибка записи состояний загрузки в KV:', error);
    throw new Error('Не удалось сохранить состояния.');
  }
}

export async function getLoadingOverrides(machineId: string): Promise<LoadingOverrides> {
  const allOverrides = await readAllOverrides();
  const machineOverrides: LoadingOverrides = {};
  for (const key in allOverrides) {
    if (key.startsWith(`${machineId}-`)) {
      machineOverrides[key] = allOverrides[key];
    }
  }
  return machineOverrides;
}

export async function saveLoadingOverrides(overridesToSave: LoadingOverrides): Promise<{ success: boolean }> {
  try {
    const allOverrides = await readAllOverrides();
    const updatedOverrides = { ...allOverrides };
    
    // Обновляем или добавляем override'ы
    Object.keys(overridesToSave).forEach(key => {
      const override = overridesToSave[key];
      
      // Используем переданный carryOver или рассчитываем
      let carryOver = override.carryOver;
      if (carryOver === undefined || carryOver === null) {
        carryOver = (override.requiredAmount || 0) - (override.loadedAmount || 0);
      }
      
      updatedOverrides[key] = {
        ...override,
        carryOver,
        timestamp: new Date().toISOString()
      };
    });
    
    await kv.hset(OVERRIDES_KEY, updatedOverrides);
    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения overrides:', error);
    return { success: false };
  }
}