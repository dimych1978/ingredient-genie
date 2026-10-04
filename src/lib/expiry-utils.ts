// lib/expiry-utils.ts
import { differenceInDays, parseISO, isValid } from 'date-fns';
import { ALL_COFFEE_INGREDIENTS, PRODUCT_GROUPS } from '@/lib/data';

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const CRITICAL_DAYS = 14;

export type ResolveExpiryOptions = {
  /** конкретный аппарат (страница аппарата) */
  machineId?: string;
  /** список аппаратов (заявка) */
  machineIdsFilter?: string[];
  /** склад: true — ручные даты игнорируем полностью */
  ignoreMachineDates?: boolean;
  expirationDates: Record<string, string>;
  machineItemExpiry: Record<string, string>;
};

/**
 * Возвращает эффективную дату срока годности для позиции.
 * Порядок:
 *  1) ручная дата по аппарату (если не ignoreMachineDates);
 *  2) складская дата по имени;
 *  3) складская дата по родительской группе;
 *  4) для группы — минимум по составляющим (рекурсивно).
 */
export const resolveExpiryDate = (
  itemName: string,
  options: ResolveExpiryOptions,
): Date | null => {
  const {
    machineId,
    machineIdsFilter,
    ignoreMachineDates = false,
    expirationDates,
    machineItemExpiry,
  } = options;

  // 1) Ручные даты
  if (!ignoreMachineDates) {
    if (machineId) {
      const manual = machineItemExpiry[`${machineId}_${itemName}`];
      if (manual) {
        const d = parseISO(manual);
        if (isValid(d)) return d;
      }
    } else if (machineIdsFilter && machineIdsFilter.length) {
      // Складская дата (fallback для аппаратов без ручной)
      const warehouseByName = expirationDates[itemName];
      const warehouseByGroup = (() => {
        const parentGroup = Object.entries(PRODUCT_GROUPS).find(([, items]) =>
          items.some(c => normalize(c) === normalize(itemName)),
        )?.[0];
        return parentGroup ? expirationDates[parentGroup] : undefined;
      })();
      const warehouseStr = warehouseByName ?? warehouseByGroup;

      const dates: Date[] = [];

      machineIdsFilter.forEach(id => {
        const manual = machineItemExpiry[`${id}_${itemName}`];

        if (manual) {
          const d = parseISO(manual);
          if (isValid(d)) {
            dates.push(d);
            return;
          }
        }

        // ручной нет → берём складскую
        if (warehouseStr) {
          const d = parseISO(warehouseStr);
          if (isValid(d)) dates.push(d);
        }
      });

      if (dates.length) {
        return dates.reduce((a, b) => (a < b ? a : b));
      }
    }
  }

  // 2) Складская дата по имени
  const warehouse = expirationDates[itemName];
  if (warehouse) {
    const d = parseISO(warehouse);
    if (isValid(d)) return d;
  }

  // 3) Родительская группа — складская дата группы
  const parentGroup = Object.entries(PRODUCT_GROUPS).find(([, items]) =>
    items.some(c => normalize(c) === normalize(itemName)),
  )?.[0];

  if (parentGroup) {
    const groupDate = expirationDates[parentGroup];
    if (groupDate) {
      const d = parseISO(groupDate);
      if (isValid(d)) return d;
    }
  }

  // 4) Если это группа — минимум по составляющим
  const constituents = PRODUCT_GROUPS[itemName];
  if (constituents) {
    const dates: Date[] = [];
    constituents.forEach(part => {
      const d = resolveExpiryDate(part, options);
      if (d) dates.push(d);
    });
    if (dates.length) return dates.reduce((a, b) => (a < b ? a : b));
  }

  return null;
};

export const getExpiryStatus = (
  itemName: string,
  options: ResolveExpiryOptions,
): 'ok' | 'critical' | 'empty' => {
  if (ALL_COFFEE_INGREDIENTS.has(normalize(itemName))) return 'ok';
  const date = resolveExpiryDate(itemName, options);
  if (!date) return 'empty';
  const daysLeft = differenceInDays(date, new Date());
  return daysLeft <= CRITICAL_DAYS ? 'critical' : 'ok';
};
