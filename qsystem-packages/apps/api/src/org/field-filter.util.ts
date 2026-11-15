// Salary fields redacted from API responses unless the viewer `can('read',
// 'salary')` (DIRECTOR-only). The prisma schema has no salary columns yet —
// the spec stubs them, so filtering works on plain response objects.
const SALARY_FIELDS = new Set(['base_salary', 'bonus']);

export function filterSalaryFields<T>(row: T, canReadSalary: boolean): T {
  if (canReadSalary || !row || typeof row !== 'object') return row;
  const out = { ...(row as Record<string, unknown>) };
  for (const field of SALARY_FIELDS) delete out[field];
  return out as T;
}

export function filterSalaryList<T>(rows: T[], canReadSalary: boolean): T[] {
  if (canReadSalary) return rows;
  return rows.map((row) => filterSalaryFields(row, false));
}
