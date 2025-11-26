'use server';

import { z } from 'zod';

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
