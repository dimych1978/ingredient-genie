'use server';

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Путь к файлу для хранения дат
const DATES_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'special-machine-dates.json');

// --- Функции для работы с файлом дат ---

async function readDatesFile(): Promise<Record<string, string>> {
  try {
    const data = await fs.readFile(DATES_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    // Если файл не найден, возвращаем пустой объект
    if (error.code === 'ENOENT') {
      return {};
    }
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

// --- Серверные действия (Server Actions) ---

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


// --- Старые действия ---

export async function handleGetRealMachines() {
  // Реальный API call к Telemetron
  const response = await fetch(`${process.env.TELEMETRON_API_URL}/machines`, {
    headers: {
      'Authorization': `Basic ${btoa(process.env.TELEMETRON_EMAIL + ':' + process.env.TELEMETRON_PASSWORD)}`
    }
  });
  
  return await response.json();
}

const loginFormSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function handleLogin(credentials: z.infer<typeof loginFormSchema>) {
  const parsedCredentials = loginFormSchema.safeParse(credentials);
  if (!parsedCredentials.success) {
    return { success: false, error: 'Неверные данные.' };
  }

  const { email, password } = parsedCredentials.data;
  
  if (email === process.env.TELEMETRON_EMAIL && password === process.env.TELEMETRON_PASSWORD) {
    return { success: true };
  } else {
    return { success: false, error: 'Неверный email или пароль.' };
  }
}
