import { apiFetch } from '../api/client';

export interface AppModuleEntry {
  id: 'qtask' | 'qhrm' | 'qcrm' | 'qsocial';
  name: string;
  description: string;
}

/**
 * GET /registry does not exist on apps/api yet — the static list below is the
 * real source of truth. The fetch stays so the day it lands, nothing here
 * changes; any failure (404 included) falls back rather than breaking the shell.
 */
export const STATIC_MODULES: readonly AppModuleEntry[] = [
  { id: 'qtask', name: 'QTask', description: 'Giao việc và theo dõi tiến độ' },
  { id: 'qhrm', name: 'QHRM', description: 'Nhân sự, phòng ban và chấm công' },
  { id: 'qcrm', name: 'QCRM', description: 'Khách hàng và cơ hội bán hàng' },
  { id: 'qsocial', name: 'QSocial', description: 'Tin tức và trao đổi nội bộ' },
];

const MODULE_IDS = STATIC_MODULES.map((module) => module.id);

function parseModules(data: unknown): AppModuleEntry[] {
  if (!Array.isArray(data)) throw new Error('Danh sách ứng dụng không hợp lệ');
  const parsed = data.filter(
    (row): row is AppModuleEntry =>
      MODULE_IDS.includes((row as AppModuleEntry)?.id) && typeof (row as AppModuleEntry).description === 'string',
  );
  return parsed.length > 0 ? parsed : [...STATIC_MODULES];
}

export async function listModules(): Promise<AppModuleEntry[]> {
  try {
    return await apiFetch('/api/registry', { schema: { parse: parseModules } });
  } catch {
    return [...STATIC_MODULES];
  }
}
