'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { handleGenerateOrderList } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Bot, Loader2, Wand2 } from 'lucide-react';

const machineSchema = z.object({
  type: z.string().min(1, 'Machine type is required.'),
  count: z.coerce.number().int().positive('Count must be a positive number.'),
});

const formSchema = z.object({
  machines: z.array(machineSchema).min(1, 'Please add at least one machine.'),
});

type FormValues = z.infer<typeof formSchema>;

export function MachineForm() {
  const [orderList, setOrderList] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      machines: [{ type: '', count: 1 }],
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'machines',
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setOrderList(null);
    try {
      const result = await handleGenerateOrderList(data);
      if (result.orderList) {
        setOrderList(result.orderList);
      } else {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: 'The AI returned an empty response. Please try again.',
        });
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'An unknown error occurred.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `An error occurred while generating the order list: ${error}`,
      });
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <Card className="shadow-lg lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Machine Selection</CardTitle>
          <CardDescription>Specify the number and types of machines for production.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-2 p-4 border rounded-lg bg-card">
                  <div className="grid gap-2 flex-1">
                    <Label htmlFor={`machines.${index}.type`}>Machine Type</Label>
                    <Input {...form.register(`machines.${index}.type`)} placeholder="e.g., Vending Machine X1" />
                    {form.formState.errors.machines?.[index]?.type && (
                      <p className="text-sm text-destructive">{form.formState.errors.machines[index]?.type?.message}</p>
                    )}
                  </div>
                  <div className="grid gap-2 w-24">
                    <Label htmlFor={`machines.${index}.count`}>Count</Label>
                    <Input type="number" {...form.register(`machines.${index}.count`)} min="1" />
                    {form.formState.errors.machines?.[index]?.count && (
                      <p className="text-sm text-destructive">{form.formState.errors.machines[index]?.count?.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                    <span className="sr-only">Remove machine</span>
                  </Button>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={() => append({ type: '', count: 1 })} className="w-full">
              <PlusCircle />
              Add Another Machine
            </Button>

            {form.formState.errors.machines && typeof form.formState.errors.machines.message === 'string' && (
              <p className="text-sm font-medium text-destructive">{form.formState.errors.machines.message}</p>
            )}

            <Separator />

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 transform hover:scale-105"
              disabled={isLoading || !form.formState.isValid}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
              Generate Order List
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-lg lg:col-span-3">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center gap-2">
            <Bot />
            Generated Order List
          </CardTitle>
          <CardDescription>
            The AI-generated list of ingredients and quantities for your machines.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[400px] flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 text-muted-foreground transition-opacity duration-300">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-semibold font-headline">Generating your order list...</p>
              <p className="text-sm">Our AI is processing your request. Please wait.</p>
            </div>
          ) : orderList ? (
            <div className="bg-muted/30 p-6 rounded-lg w-full h-full overflow-y-auto animate-in fade-in duration-500">
              <pre className="whitespace-pre-wrap font-body text-sm text-foreground">{orderList}</pre>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <p className="font-semibold font-headline text-lg">Your generated order list will appear here.</p>
              <p className="text-sm mt-1">Fill out the machine details and click "Generate".</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
