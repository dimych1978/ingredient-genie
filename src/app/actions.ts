'use server';

import {
  generateIngredientOrderList,
  type GenerateIngredientOrderListInput,
} from '@/ai/flows/generate-ingredient-order-list';
import { z } from 'zod';

const machineSchema = z.object({
  type: z.string(),
  count: z.number().int().positive(),
});

const formSchema = z.object({
  machines: z.array(machineSchema),
});

export async function handleGenerateOrderList(input: GenerateIngredientOrderListInput) {
  const parsedInput = formSchema.safeParse(input);

  if (!parsedInput.success) {
    throw new Error('Invalid input');
  }

  try {
    const output = await generateIngredientOrderList(parsedInput.data);
    return output;
  } catch (error) {
    console.error('Error generating ingredient order list:', error);
    throw new Error('Failed to generate order list due to a server error.');
  }
}
