'use server';

import { kv } from '@/lib/kv';
import type { LoadingOverride } from '@/types/telemetron';

// --- Функции для работы с датами спец. аппаратов ---

const DATES_KEY = 'special-machine-dates';

export async function getSpecialMachineDates(): Promise<Record<string, string>> {
  try {
    const dates = await kv.get<Record<string, string>>(DATES_KEY);
    return dates || {};
  } catch (error) {
    console.error('Ошибка чтения дат из KV:', error);
    throw new Error('Не удалось прочитать файл с датами.');
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
        throw new Error('Не удалось прочитать файл с заявками.');
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

async function readAllOverrides(): Promise<LoadingOverrides> {
  try {
    const overrides = await kv.get<LoadingOverrides>(OVERRIDES_KEY);
    return overrides || {};
  } catch (error) {
    console.error('Ошибка чтения состояний загрузки из KV:', error);
    throw new Error('Не удалось прочитать файл состояний.');
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
        const updatedOverrides = { ...allOverrides, ...overridesToSave };
        await writeAllOverrides(updatedOverrides);
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false };
    }
}
