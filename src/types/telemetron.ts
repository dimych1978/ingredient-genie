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
  value: number; // выручка в рублях
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
export type LoadingStatus = 'pending' | 'full' | 'none' | 'partial';

export interface LoadingOverride {
  status: LoadingStatus;
  requiredAmount?: number; // Сколько требовалось в прошлый раз
  loadedAmount?: number;   // Сколько было загружено (для 'partial' и 'full')
}

export type LoadingOverrides = Record<string, LoadingOverride>;
