export type IngredientType = 'auto' | 'manual' | 'checkbox' | 'select';

export interface SyrupOption {
  id: string;
  name: string;
  selected: boolean;
}

export interface Ingredient {
  name: string;
  apiNames: string[];
  unit: string;
  type: IngredientType;
  syrupOptions?: SyrupOption[]; // только для сиропа
}

export interface TelemetronIngredient {
  name: string;
  unit: number; // 1=штука, 2=миллилитр, 3=грамм
  volume: number;
}

export interface TelemetronPlanogram {
  id: number;
  name: string;
  receipt: boolean;
  ingredients: TelemetronIngredient[] | null;
}

export interface TelemetronSaleItem {
  product_number: string;
  planogram: TelemetronPlanogram;
  number: number; // количество продаж
  attribute: any;
  currency: string;
  price: number;
  summary_rate: number;
}

export interface TelemetronSalesResponse {
  data: TelemetronSaleItem[];
  total: {
    quantity: number;
    sales: number;
  };
}

// Типы для состояния загрузки
export type LoadingStatus = 'none' | 'partial';

export interface LoadingOverride {
  status: LoadingStatus;
  requiredAmount: number;
  loadedAmount: number;
  carryOver?: number; // Сколько недополнено (для переноса)
  timestamp?: string;
  checked?: boolean;
  checkedType?: ('big' | 'small');
  selectedSyrups?: string[];
}

export type LoadingOverrides = Record<string, LoadingOverride>;

export interface ShoppingListItem {
  name: string;
  amount: number; // Сколько нужно ВСЕГО (продажи + перенос)
  unit: string;
  status: LoadingStatus;
  previousDeficit?: number; // Сколько не доложили в прошлый раз
  salesAmount?: number; // Только продажи (для информации)
  isCore: boolean;
  type?: IngredientType; // 'auto' | 'checkbox' | 'select'
  syrupOptions?: SyrupOption[]; // для сиропа
  checked?: boolean;
}
