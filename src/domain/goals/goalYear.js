export const minimumGoalYear = 2000;
export const maximumGoalYear = 2100;

export function isGoalYear(year) {
  if (!Number.isInteger(year)) return false;
  if (year < minimumGoalYear) return false;
  return year <= maximumGoalYear;
}
