/**
 * Budget Categories Enum
 * Used for categorizing budgets in the application
 */
export enum BudgetCategory {
  GROCERIES = 'GROCERIES',
  DATA = 'DATA',
  UTILITY = 'UTILITY',
  CLOTHES = 'CLOTHES',
  GIFTS = 'GIFTS',
  TRAVEL = 'TRAVEL',
  RENT = 'RENT',
  KIDS = 'KIDS',
  OTHERS = 'OTHERS',
}

/**
 * Get all budget categories as an array
 */
export const BUDGET_CATEGORIES = Object.values(BudgetCategory);

/**
 * Get budget category display name
 */
export const getBudgetCategoryDisplayName = (category: BudgetCategory): string => {
  const displayNames: Record<BudgetCategory, string> = {
    [BudgetCategory.GROCERIES]: 'Groceries',
    [BudgetCategory.DATA]: 'Data',
    [BudgetCategory.UTILITY]: 'Utility',
    [BudgetCategory.CLOTHES]: 'Clothes',
    [BudgetCategory.GIFTS]: 'Gifts',
    [BudgetCategory.TRAVEL]: 'Travel',
    [BudgetCategory.RENT]: 'Rent',
    [BudgetCategory.KIDS]: 'Kids',
    [BudgetCategory.OTHERS]: 'Others',
  };
  return displayNames[category] || category;
};
