
export type Ingredient = {
    name: string;
    unit: 'кг' | 'шт' | 'л';
    type: 'auto' | 'manual';
};

export type Machine = {
    id: string;
    name: string;
    location: string;
};

export const allMachines: Machine[] = [
    { id: '58899', name: 'Necta Krea Touch', location: 'Автовокзал 2 этаж корнер' },
    { id: '49176', name: 'Sanden Vendo SVE DR9', location: 'Автовокзал бутмат' },
    { id: '49005', name: 'Necta Opera', location: 'Автовокзал кофе' },
    { id: '48914', name: 'TCN CSC-10G', location: 'Автовокзал снэк' },
    { id: '53703', name: 'Saeco Cristallo 400 EVO', location: 'АвтоДом 193' },
    { id: '36112', name: 'Necta Opera', location: 'Автодор корпус 3 кофе 200' },
    { id: '51151', name: 'Necta Opera', location: 'Автодор на Первомайском кофе' },
    { id: '51211', name: 'TCN CSC-10G', location: 'Автодор на Первомайском снэк' },
    { id: '33412', name: 'Necta Opera', location: 'Автодор на Советской кофе' },
    { id: '39496', name: 'Necta Snakky 6-30', location: 'Автодор на Советской снэк 55' },
    { id: '40181', name: 'Necta Kikko ES6', location: 'Автокит 148' },
    { id: '33341', name: 'Necta Kikko ES6', location: 'Автоколонна проходная 165/2' },
    { id: '33344', name: 'Saeco Cristallo 400', location: 'Автоколонна проходная 166' },
    { id: '39875', name: 'Necta Colibri', location: 'Автолайн 29' },
    { id: '58689', name: 'Necta Colibri', location: 'Автомойка Автобаня' },
    { id: '33819', name: 'Necta Kikko ES6', location: 'Автомойка Автоколонна 118/15' },
    { id: '40975', name: 'Necta Colibri', location: 'Автомойка Детейлинг' },
    { id: '58691', name: 'Necta Colibri', location: 'Автомойка Дойче стандарт 66' },
    { id: '58692', name: 'Necta Kikko ES6', location: 'Автомойка ПитСтоп 155' },
    { id: '51352', name: 'Necta Colibri', location: 'Автомойка Пузыри' },
    { id: '58694', name: 'Necta Opera', location: 'Автомойка Эксперт 214' },
    { id: '45678', name: 'Necta Krea Touch', location: 'Автопарт корнер' },
    { id: '58727', name: 'Necta Colibri', location: 'Авторазборка Иномарок 122' },
    { id: '58695', name: 'Necta Krea Touch', location: 'Автосалон Альянс корнер' },
    { id: '58690', name: 'Necta Kikko ES6', location: 'Автосервис 10 регион' },
    { id: '34493', name: 'Saeco Cristallo 400 EVO', location: 'Автосервис Авангард 178' },
    { id: '37867', name: 'Necta Colibri', location: 'Автосервис Автодвор 124' },
    { id: '58698', name: 'Necta Colibri', location: 'Автосервис Динамика 134' },
    { id: '58702', name: 'Necta Krea Touch', location: 'Автосервис Мастер на Ветеринарном корнер' },
    { id: '58704', name: 'Necta Krea Touch', location: 'Автосервис Мастер на Правде корнер' },
    { id: '53150', name: 'Necta Colibri', location: 'Автосервис Механика' },
    { id: '33496', name: 'Necta Kikko ES6', location: 'Автосервис Петродок 137' },
    { id: '58697', name: 'Necta Kikko ES6', location: 'Автосервис ПроСто 21' },
    { id: '40400', name: 'Necta Colibri', location: 'Автостолица 101' },
    { id: '41899', name: 'Necta Colibri', location: 'Автостоянка ТЭЦ' },
    { id: '58707', name: 'Necta Colibri', location: 'Автоцентрум 106' },
    { id: '52517', name: 'Necta Colibri', location: 'Автошкола ДОСААФ' },
    { id: '37596', name: 'Necta Opera', location: 'РАНХиГС 222' },
    { id: '37718', name: 'FAS FAST 1050', location: 'РАНХиГС снэк 77' },
    { id: '64228', name: 'Jetinno JL300', location: 'Акватика кофе' },
    { id: '55133', name: 'TCN CSC-10G', location: 'Акватика снэк' },
    { id: '53359', name: 'Necta Colibri', location: 'Алло Такси' },
    { id: '58734', name: 'Necta Krea Touch', location: 'Алмакс - авто' },
    { id: '41373', name: 'Necta Krea Touch', location: 'АртАвто 13' },
    { id: '43960', name: 'Necta Krea Touch', location: 'Аста автомагазин' },
    { id: '53755', name: 'Necta Colibri', location: 'База лесторг' },
    { id: '34246', name: 'Sanden Vendo SVE DR9', location: 'Бассейн Н2О бутмат 75' },
    { id: '41997', name: 'Necta Opera', location: 'Бассейн Н2О кофе' },
    { id: '33347', name: 'Unicum FoodBox', location: 'Бассейн H2O снэк 34' },
    { id: '41261', name: 'Necta Krea Touch', location: 'Белые ключи корнер' },
];

export type MachineIngredients = {
    [key: string]: Ingredient[];
};

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
    'krea touch': [
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
