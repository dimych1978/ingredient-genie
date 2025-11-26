
export type Ingredient = {
    name: string;
    unit: 'кг' | 'шт' | 'л';
    type: 'auto' | 'manual';
};

export type MachineIngredients = {
    [key: string]: Ingredient[];
};

export const allMachines = [
  { id: '40680', name: 'Crea Touch', location: 'Локация не указана' },
  { id: 'opera', name: 'Opera', location: 'Локация не указана' },
  { id: 'colibri', name: 'Colibri', location: 'Локация не указана' },
  { id: 'kiko', name: 'Kiko', location: 'Локация не указана' },
  { id: 'saeco', name: 'Saeco', location: 'Локация не указана' },
  { id: 'saeco-max', name: 'Saeco Max', location: 'Локация не указана' },
];

export const machineIngredients: MachineIngredients = {
    '40680': [
        { name: 'вода', unit: 'л', type: 'auto' },
        { name: 'кофе', unit: 'кг', type: 'auto' },
        { name: 'сливки', unit: 'кг', type: 'auto' },
        { name: 'шоколад', unit: 'кг', type: 'auto' },
        { name: 'ваниль', unit: 'кг', type: 'auto' },
        { name: 'стаканы 250', unit: 'шт', type: 'manual' },
        { name: 'стаканы 350', unit: 'шт', type: 'manual' },
        { name: 'крышки 80', unit: 'шт', type: 'manual' },
        { name: 'крышки 90', unit: 'шт', type: 'manual' },
        { name: 'размешиватели деревянные', unit: 'шт', type: 'manual' },
        { name: 'сахар в стиках', unit: 'шт', type: 'manual' },
    ],
    'opera': [
        { name: 'вода', unit: 'л', type: 'auto' },
        { name: 'кофе', unit: 'кг', type: 'auto' },
        { name: 'сливки', unit: 'кг', type: 'auto' },
        { name: 'шоколад', unit: 'кг', type: 'auto' },
        { name: 'ваниль', unit: 'кг', type: 'auto' },
        { name: 'банан', unit: 'кг', type: 'auto' },
        { name: 'чай', unit: 'кг', type: 'auto' },
        { name: 'стаканы 300', unit: 'шт', type: 'auto' },
        { name: 'крышки 80', unit: 'шт', type: 'auto' },
        { name: 'размешиватели 125', unit: 'шт', type: 'auto' },
        { name: 'сахар', unit: 'кг', type: 'auto' },
    ],
    'kiko': [
        { name: 'вода', unit: 'л', type: 'auto' },
        { name: 'кофе', unit: 'кг', type: 'auto' },
        { name: 'сливки', unit: 'кг', type: 'auto' },
        { name: 'шоколад', unit: 'кг', type: 'auto' },
        { name: 'ваниль', unit: 'кг', type: 'auto' },
        { name: 'чай', unit: 'кг', type: 'auto' },
        { name: 'стаканы 150', unit: 'шт', type: 'auto' },
        { name: 'размешиватели 105', unit: 'шт', type: 'auto' },
        { name: 'сахар', unit: 'кг', type: 'auto' },
    ],
    'saeco': [
        { name: 'вода', unit: 'л', type: 'auto' },
        { name: 'кофе', unit: 'кг', type: 'auto' },
        { name: 'сливки', unit: 'кг', type: 'auto' },
        { name: 'шоколад', unit: 'кг', type: 'auto' },
        { name: 'ваниль', unit: 'кг', type: 'auto' },
        { name: 'чай', unit: 'кг', type: 'auto' },
        { name: 'стаканы 150', unit: 'шт', type: 'auto' },
        { name: 'размешиватели 105', unit: 'шт', type: 'auto' },
        { name: 'сахар', unit: 'кг', type: 'auto' },
    ],
    'saeco-max': [
        { name: 'вода', unit: 'л', type: 'auto' },
        { name: 'кофе', unit: 'кг', type: 'auto' },
        { name: 'сливки', unit: 'кг', type: 'auto' },
        { name: 'шоколад', unit: 'кг', type: 'auto' },
        { name: 'ваниль', unit: 'кг', type: 'auto' },
        { name: 'кисель', unit: 'кг', type: 'auto' },
        { name: 'чай', unit: 'кг', type: 'auto' },
        { name: 'стаканы 150', unit: 'шт', type: 'auto' },
        { name: 'размешиватели 105', unit: 'шт', type: 'auto' },
        { name: 'сахар', unit: 'кг', type: 'auto' },
    ],
    'colibri': [
        { name: 'вода', unit: 'л', type: 'auto' },
        { name: 'кофе', unit: 'кг', type: 'auto' },
        { name: 'сливки', unit: 'кг', type: 'auto' },
        { name: 'шоколад', unit: 'кг', type: 'auto' },
        { name: 'чай', unit: 'кг', type: 'auto' },
        { name: 'стаканы пластик', unit: 'шт', type: 'auto' },
        { name: 'размешиватели 105', unit: 'шт', type: 'auto' },
        { name: 'сахар', unit: 'кг', type: 'auto' },
    ],
};


// 0: Sunday, 1: Monday, 2: Tuesday, 3: Wednesday, 4: Thursday, 5: Friday, 6: Saturday
export const weeklySchedule: { [key: number]: string[] } = {
    0: ['kiko'], // Sunday
    1: ['40680', 'kiko'], // Monday
    2: ['opera'], // Tuesday
    3: ['40680', 'saeco'], // Wednesday
    4: ['opera', 'kiko'], // Thursday
    5: ['40680', 'opera', 'saeco'], // Friday
    6: ['saeco-max'], // Saturday
};
