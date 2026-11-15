import { Controller, Get } from '@nestjs/common';
import { Public } from '../iam/jwt-auth.guard';

export interface RegistryModuleItem {
  id: 'qtask' | 'qhrm' | 'qcrm' | 'qsocial';
  name: string;
  description: string;
  routes: { label: string; href: string }[];
  enabled: boolean;
}

const ALL_MODULES: RegistryModuleItem[] = [
  {
    id: 'qtask',
    name: 'QTask',
    description: 'Quản lý công việc và dự án',
    routes: [
      { label: 'Tất cả công việc', href: '/' },
      { label: 'Công việc của tôi', href: '/tasks' },
      { label: 'Dự án', href: '/projects' },
      { label: 'Tài liệu', href: '/files' },
    ],
    enabled: true,
  },
  {
    id: 'qhrm',
    name: 'QHRM',
    description: 'Nhân sự và cơ cấu tổ chức',
    routes: [{ label: 'Danh bạ nhân sự', href: '/org' }],
    enabled: true,
  },
  {
    id: 'qcrm',
    name: 'QCRM',
    description: 'Khách hàng và hợp đồng',
    routes: [{ label: 'Khách hàng', href: '/crm' }],
    enabled: true,
  },
  {
    id: 'qsocial',
    name: 'QSocial',
    description: 'Bảng tin nội bộ',
    routes: [{ label: 'Bảng tin', href: '/social' }],
    enabled: true,
  },
];

@Public()
@Controller('registry')
export class RegistryController {
  @Get()
  list(): RegistryModuleItem[] {
    const raw = process.env.ENABLED_MODULES?.trim();
    if (!raw) return ALL_MODULES;
    const allowed = new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    return ALL_MODULES.filter((mod) => allowed.has(mod.id));
  }
}

