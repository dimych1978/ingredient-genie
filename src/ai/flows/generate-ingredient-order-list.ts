'use server';
/**
 * @fileOverview Generates an order list of ingredients with quantities required for production based on the number and types of machines.
 *
 * - generateIngredientOrderList - A function that generates the ingredient order list.
 * - GenerateIngredientOrderListInput - The input type for the generateIngredientOrderList function.
 * - GenerateIngredientOrderListOutput - The return type for the generateIngredientOrderList function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateIngredientOrderListInputSchema = z.object({
  machines: z.array(
    z.object({
      type: z.string().describe('The type of machine.'),
      count: z.number().int().positive().describe('The number of machines of this type.'),
    })
  ).describe('A list of machines with their types and counts.'),
});
export type GenerateIngredientOrderListInput = z.infer<typeof GenerateIngredientOrderListInputSchema>;

const GenerateIngredientOrderListOutputSchema = z.object({
  orderList: z.string().describe('A formatted list of ingredients and their quantities required for production.'),
});
export type GenerateIngredientOrderListOutput = z.infer<typeof GenerateIngredientOrderListOutputSchema>;

export async function generateIngredientOrderList(input: GenerateIngredientOrderListInput): Promise<GenerateIngredientOrderListOutput> {
  return generateIngredientOrderListFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateIngredientOrderListPrompt',
  input: {schema: GenerateIngredientOrderListInputSchema},
  output: {schema: GenerateIngredientOrderListOutputSchema},
  prompt: `You are an AI assistant specialized in generating ingredient order lists for production.

  Based on the provided list of machines and their quantities, determine the required ingredients and their respective quantities needed for production.
  Format the output as a readable list of ingredients and quantities.

  Machines:
  {{#each machines}}
  - Type: {{this.type}}, Count: {{this.count}}
  {{/each}}
  `,
});

const generateIngredientOrderListFlow = ai.defineFlow(
  {
    name: 'generateIngredientOrderListFlow',
    inputSchema: GenerateIngredientOrderListInputSchema,
    outputSchema: GenerateIngredientOrderListOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
