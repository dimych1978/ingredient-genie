'use server';

import fs from 'fs/promises';
import path from 'path';

// --- Функции для работы с файлом дат спец. аппаратов ---

const DATES_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'special-machine-dates.json');

async function readDatesFile(): Promise<Record<string, string>> {
  try {
    const data = await fs.readFile(DATES_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') return {};
    console.error('Ошибка чтения файла дат:', error);
    throw new Error('Не удалось прочитать файл с датами.');
  }
}

async function writeDatesFile(dates: Record<string, string>): Promise<void> {
  try {
    await fs.writeFile(DATES_FILE_PATH, JSON.stringify(dates, null, 2), 'utf-8');
  } catch (error) {
    console.error('Ошибка записи в файл дат:', error);
    throw new Error('Не удалось сохранить дату.');
  }
}

export async function getSpecialMachineDates(): Promise<Record<string, string>> {
  return await readDatesFile();
}

export async function setSpecialMachineDate(id: string, date: string): Promise<{ success: boolean }> {
  try {
    const dates = await readDatesFile();
    dates[id] = date;
    await writeDatesFile(dates);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false };
  }
}


// --- Функции для работы с файлом истории заявок ---

const SCHEDULES_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'daily-schedules.json');

type DailySchedules = Record<string, string[]>;

async function readSchedulesFile(): Promise<DailySchedules> {
  try {
    const data = await fs.readFile(SCHEDULES_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') return {};
    console.error('Ошибка чтения файла заявок:', error);
    throw new Error('Не удалось прочитать файл с заявками.');
  }
}

async function writeSchedulesFile(schedules: DailySchedules): Promise<void> {
  try {
    await fs.writeFile(SCHEDULES_FILE_PATH, JSON.stringify(schedules, null, 2), 'utf-8');
  } catch (error) {
    console.error('Ошибка записи в файл заявок:', error);
    throw new Error('Не удалось сохранить заявку.');
  }
}

export async function getDailySchedule(date: string): Promise<string[] | null> {
    const schedules = await readSchedulesFile();
    return schedules[date] || null;
}

export async function saveDailySchedule(date: string, machineIds: string[]): Promise<{ success: boolean }> {
    try {
        const schedules = await readSchedulesFile();
        schedules[date] = machineIds;
        await writeSchedulesFile(schedules);
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false };
    }
}
