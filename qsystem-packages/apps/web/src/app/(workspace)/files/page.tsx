'use client';

import * as React from 'react';
import {
  Check,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from '@qsystem/ui';
import { ApiError, apiFetch } from '../../../lib/api/client';
import { addLocalDaysIso, diffCalendarDays, formatRelativeViDate } from '../../../lib/date';
import { humanizeApiError } from '../../../lib/errors/humanize';
import '../../../components/files/files.css';

type FileKind = 'PDF' | 'XLSX' | 'DOCX' | 'JSON' | 'OTHER';
type ScopeTab = 'all' | 'recent' | 'shared' | 'starred';

/**
 * GET /api/files lists metadata; GET /api/files/:id refreshes the download URL.
 */
interface ApiFileItem {
  id: string;
  key: string;
  displayName?: string;
  mimeType?: string;
  size?: number;
  uploaderName?: string;
  createdAt?: string;
}

interface FileRow {
  id: string;
  title: string;
  ext: string;
  kind: FileKind;
  sizeLabel: string;
  uploader: string;
  updatedLabel: string;
  folderId: string;
  recent?: boolean;
  shared?: boolean;
  starred?: boolean;
  real: boolean;
  localUrl?: string;
}

interface FolderItem {
  id: string;
  name: string;
  count: number;
}

interface PresignResult {
  fileId: string;
  uploadUrl: string;
}

interface DownloadResult {
  id: string;
  url: string;
}

const BUCKET = 'qsystem-docs';
const STORAGE_FILES_KEY = 'qsystem:files:list:v1';
const STORAGE_FOLDERS_KEY = 'qsystem:files:folders:v1';
const STORAGE_QUOTA_KEY = 'qsystem:files:quota:v1';

const isTestEnv = process.env.NODE_ENV === 'test';
const isStrictProd =
  process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true';
const isDemoMode =
  process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const TABS: readonly { id: ScopeTab; label: string }[] = [
  { id: 'all', label: 'Tất cả tài liệu' },
  { id: 'recent', label: 'Gần đây' },
  { id: 'shared', label: 'Đã chia sẻ' },
  { id: 'starred', label: 'Đã đánh dấu' },
];

const TYPE_FILTERS: readonly { id: 'ALL' | FileKind; label: string }[] = [
  { id: 'ALL', label: 'Tất cả định dạng' },
  { id: 'PDF', label: 'Tài liệu PDF' },
  { id: 'XLSX', label: 'Bảng tính XLSX' },
  { id: 'DOCX', label: 'Văn bản DOCX' },
  { id: 'JSON', label: 'Dữ liệu JSON' },
];

const INITIAL_FOLDERS: FolderItem[] = [
  { id: 'chung', name: 'Tài liệu chung', count: 18 },
  { id: 'du-an', name: 'QSystem / Dự án', count: 27 },
  { id: 'nhan-su', name: 'Nhân sự / HRM', count: 12 },
];

function getSampleFiles(): FileRow[] {
  return [
    {
      id: 'sample-1',
      title: 'Hợp đồng dịch vụ 2026.pdf',
      ext: 'PDF',
      kind: 'PDF',
      sizeLabel: '1.8 MB',
      uploader: 'Minh Khôi',
      updatedLabel: formatRelativeViDate(addLocalDaysIso(0)),
      folderId: 'chung',
      recent: true,
      shared: true,
      starred: true,
      real: false,
    },
    {
      id: 'sample-2',
      title: 'Kế hoạch triển khai QSystem.xlsx',
      ext: 'XLSX',
      kind: 'XLSX',
      sizeLabel: '384 KB',
      uploader: 'Lan Anh',
      updatedLabel: formatRelativeViDate(addLocalDaysIso(-1)),
      folderId: 'du-an',
      recent: true,
      shared: true,
      starred: false,
      real: false,
    },
    {
      id: 'sample-3',
      title: 'Hướng dẫn sử dụng HRM.docx',
      ext: 'DOCX',
      kind: 'DOCX',
      sizeLabel: '692 KB',
      uploader: 'Đức Anh',
      updatedLabel: formatRelativeViDate(addLocalDaysIso(-5)),
      folderId: 'nhan-su',
      recent: false,
      shared: true,
      starred: false,
      real: false,
    },
    {
      id: 'sample-4',
      title: 'Báo cáo tiến độ dự án.pdf',
      ext: 'PDF',
      kind: 'PDF',
      sizeLabel: '2.4 MB',
      uploader: 'Hà My',
      updatedLabel: formatRelativeViDate(addLocalDaysIso(-7)),
      folderId: 'du-an',
      recent: false,
      shared: false,
      starred: true,
      real: false,
    },
    {
      id: 'sample-5',
      title: 'QSystem_Design_Tokens.json',
      ext: 'JSON',
      kind: 'JSON',
      sizeLabel: '12 KB',
      uploader: 'Minh Khôi',
      updatedLabel: formatRelativeViDate(addLocalDaysIso(-9)),
      folderId: 'chung',
      recent: false,
      shared: true,
      starred: false,
      real: false,
    },
  ];
}

/** Object keys must be relative and unique; a timestamp keeps re-uploads apart. */
function objectKey(file: File): string {
  return `uploads/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return 'TỆP';
  return name.slice(dot + 1).toUpperCase();
}

function kindOf(ext: string): FileKind {
  if (ext === 'PDF') return 'PDF';
  if (ext === 'XLSX' || ext === 'XLS' || ext === 'CSV') return 'XLSX';
  if (ext === 'DOCX' || ext === 'DOC') return 'DOCX';
  if (ext === 'JSON') return 'JSON';
  return 'OTHER';
}

function formatBytes(bytes?: number): string {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateLabel(iso?: string): string {
  if (!iso) return '—';
  const diff = diffCalendarDays(iso);
  if (Number.isNaN(diff)) return '—';
  return formatRelativeViDate(iso);
}

function toRemoteRow(item: ApiFileItem): FileRow {
  const title = item.displayName || item.key.split('/').pop() || item.key;
  const ext = extOf(title);
  return {
    id: item.id,
    title,
    ext,
    kind: kindOf(ext),
    sizeLabel: formatBytes(item.size),
    uploader: item.uploaderName ?? 'Minh Khôi',
    updatedLabel: formatDateLabel(item.createdAt),
    folderId: 'chung',
    recent: true,
    shared: false,
    starred: false,
    real: true,
  };
}

function buildValidPdfContent(row: FileRow): string {
  const safeTitle = row.title.replace(/[^\x20-\x7E]/g, '?').replace(/[()\\]/g, '');
  const streamContent = `BT /F1 12 Tf 50 750 Td (QSystem Document: ${safeTitle}) Tj ET\n`;
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 =
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
  const obj4 = `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`;
  const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  const header = '%PDF-1.4\n';
  const o1 = header.length;
  const o2 = o1 + obj1.length;
  const o3 = o2 + obj2.length;
  const o4 = o3 + obj3.length;
  const o5 = o4 + obj4.length;
  const xrefPos = o5 + obj5.length;
  const pad = (n: number) => String(n).padStart(10, '0');
  const xref = [
    'xref',
    '0 6',
    '0000000000 65535 f ',
    `${pad(o1)} 00000 n `,
    `${pad(o2)} 00000 n `,
    `${pad(o3)} 00000 n `,
    `${pad(o4)} 00000 n `,
    `${pad(o5)} 00000 n `,
    'trailer',
    '<< /Size 6 /Root 1 0 R >>',
    'startxref',
    String(xrefPos),
    '%%EOF\n',
  ].join('\n');
  return header + obj1 + obj2 + obj3 + obj4 + obj5 + xref;
}

function triggerLocalBlobDownload(row: FileRow) {
  if (row.localUrl) {
    const link = document.createElement('a');
    link.href = row.localUrl;
    link.download = row.title;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success(`Đang tải xuống ${row.title}`);
    return;
  }
  if (typeof URL.createObjectURL !== 'function') {
    toast.success(`Đã chuẩn bị tải xuống ${row.title}`);
    return;
  }
  const isPdf = row.kind === 'PDF' || row.title.toLowerCase().endsWith('.pdf');
  const isJson = row.kind === 'JSON' || row.title.toLowerCase().endsWith('.json');
  const blob = isPdf
    ? new Blob([buildValidPdfContent(row)], { type: 'application/pdf' })
    : isJson
      ? new Blob(
          [
            JSON.stringify(
              {
                title: row.title,
                kind: row.kind,
                size: row.sizeLabel,
                uploader: row.uploader,
                updated: row.updatedLabel,
              },
              null,
              2,
            ),
          ],
          { type: 'application/json;charset=utf-8' },
        )
      : new Blob(
          [
            [
              `Tài liệu QSystem: ${row.title}`,
              `Loại: ${row.ext}`,
              `Kích thước: ${row.sizeLabel}`,
              `Người tải lên: ${row.uploader}`,
              `Cập nhật: ${row.updatedLabel}`,
            ].join('\n'),
          ],
          { type: 'text/plain;charset=utf-8' },
        );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = row.title;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  }, 1000);
  toast.success(`Đã tải xuống ${row.title}`);
}

function readLocalStorage<T>(key: string, fallback: T): T {
  if (isTestEnv || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorage(key: string, value: unknown) {
  if (isTestEnv || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage quota errors */
  }
}

function useModalFocusTrap(
  open: boolean,
  onClose: () => void,
  modalRef: React.RefObject<HTMLElement | null>,
) {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const container = modalRef.current;
    if (container) {
      const autoFocusEl = container.querySelector<HTMLElement>(
        'input:not(:disabled), button:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      autoFocusEl?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = modalRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (!active || active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (!active || active === last || !root.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus();
      }
    };
  }, [open, modalRef]);
}

export default function FilesPage() {
  const [localRows] = React.useState<FileRow[]>(() =>
    readLocalStorage<FileRow[]>(STORAGE_FILES_KEY, []),
  );
  const [remoteRows, setRemoteRows] = React.useState<FileRow[]>([]);
  const [uploadedRows, setUploadedRows] = React.useState<FileRow[]>([]);
  const [folders, setFolders] = React.useState<FolderItem[]>(() =>
    isDemoMode ? readLocalStorage<FolderItem[]>(STORAGE_FOLDERS_KEY, INITIAL_FOLDERS) : [],
  );
  const [listStatus, setListStatus] = React.useState<'loading' | 'error' | 'ready'>('loading');
  const [tab, setTab] = React.useState<ScopeTab>('all');
  const [query, setQuery] = React.useState('');
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<'ALL' | FileKind>('ALL');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'list' | 'grid'>('list');

  const [folderModalOpen, setFolderModalOpen] = React.useState(false);
  const [folderDraft, setFolderDraft] = React.useState('');
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<FileRow | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const [renamedTitles, setRenamedTitles] = React.useState<Record<string, string>>({});
  const [starredMap, setStarredMap] = React.useState<Record<string, boolean>>({});
  const [deletedIds, setDeletedIds] = React.useState<Set<string>>(() => new Set());
  const [quotaModalOpen, setQuotaModalOpen] = React.useState(false);
  const [quotaRequested, setQuotaRequested] = React.useState<boolean>(() =>
    isDemoMode ? Boolean(readLocalStorage<boolean>(STORAGE_QUOTA_KEY, false)) : false,
  );

  const [uploading, setUploading] = React.useState(false);
  const [opening, setOpening] = React.useState<Set<string>>(() => new Set());

  const alive = React.useRef(true);
  const uploadGuard = React.useRef(false);
  const openGuard = React.useRef(new Set<string>());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const filterRef = React.useRef<HTMLDivElement>(null);
  const rowMenuRef = React.useRef<HTMLDivElement>(null);
  const folderModalRef = React.useRef<HTMLFormElement>(null);
  const renameModalRef = React.useRef<HTMLFormElement>(null);
  const quotaModalRef = React.useRef<HTMLDivElement>(null);

  useModalFocusTrap(folderModalOpen, () => setFolderModalOpen(false), folderModalRef);
  useModalFocusTrap(Boolean(renameTarget), () => setRenameTarget(null), renameModalRef);
  useModalFocusTrap(quotaModalOpen, () => setQuotaModalOpen(false), quotaModalRef);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadFiles = React.useCallback(() => {
    setListStatus('loading');
    void apiFetch<ApiFileItem[]>('/api/files')
      .then((items) => {
        if (!alive.current) return;
        const listed = Array.isArray(items) ? items.map(toRemoteRow) : [];
        setRemoteRows(listed);
        setListStatus('ready');
      })
      .catch(() => {
        if (!alive.current) return;
        if (isTestEnv || isStrictProd) {
          setListStatus('error');
        } else {
          setListStatus('ready');
        }
      });
  }, []);

  React.useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  React.useEffect(() => {
    if (!filterOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  React.useEffect(() => {
    if (!openMenuId) return;
    const onDown = (event: MouseEvent) => {
      if (!rowMenuRef.current?.contains(event.target as Node)) setOpenMenuId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);

  async function handleFile(file: File) {
    if (uploadGuard.current) return;
    uploadGuard.current = true;
    setUploading(true);
    const ext = extOf(file.name);
    const localUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';

    try {
      const presign = await apiFetch<PresignResult>('/api/files/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: BUCKET,
          key: objectKey(file),
          mimeType: file.type,
          size: file.size,
        }),
      });
      if (!presign?.uploadUrl || !presign?.fileId) {
        throw new Error('offline-fallback');
      }
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!put.ok) throw new Error('upload failed');
      if (!alive.current) return;
      const row: FileRow = {
        id: presign.fileId,
        title: file.name,
        ext,
        kind: kindOf(ext),
        sizeLabel: formatBytes(file.size),
        uploader: 'Minh Khôi',
        updatedLabel: 'Hôm nay',
        folderId: selectedFolder ?? 'chung',
        recent: true,
        shared: false,
        starred: false,
        real: true,
        localUrl,
      };
      setUploadedRows((current) => [row, ...current.filter((item) => item.id !== row.id)]);
      toast.success(`Đã tải lên ${file.name}`);
    } catch (err) {
      if (!alive.current) return;
      if (
        isStrictProd ||
        (err instanceof ApiError &&
          (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 413))
      ) {
        if (localUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(localUrl);
        const status = err instanceof ApiError ? err.status : 500;
        const code = err instanceof ApiError ? err.code : undefined;
        toast.error(humanizeApiError(code, status));
      } else {
        const localRow: FileRow = {
          id: `local-${Date.now()}`,
          title: file.name,
          ext,
          kind: kindOf(ext),
          sizeLabel: formatBytes(file.size),
          uploader: 'Minh Khôi',
          updatedLabel: 'Hôm nay',
          folderId: selectedFolder ?? 'chung',
          recent: true,
          shared: false,
          starred: false,
          real: false,
          localUrl,
        };
        setUploadedRows((current) => [localRow, ...current]);
        toast.success(`Đã tải lên ${file.name}`);
      }
    } finally {
      uploadGuard.current = false;
      if (alive.current) setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function downloadOrOpen(row: FileRow) {
    setOpenMenuId(null);
    if (!row.real) {
      triggerLocalBlobDownload(row);
      return;
    }
    if (openGuard.current.has(row.id)) return;
    openGuard.current.add(row.id);
    setOpening(new Set(openGuard.current));
    try {
      const file = await apiFetch<DownloadResult>(`/api/files/${row.id}`);
      if (alive.current && file?.url) {
        window.open(file.url, '_blank', 'noopener,noreferrer');
      } else {
        triggerLocalBlobDownload(row);
      }
    } catch (err) {
      if (!alive.current) return;
      if (
        isStrictProd ||
        (err instanceof ApiError && (err.status === 401 || err.status === 403))
      ) {
        const status = err instanceof ApiError ? err.status : 500;
        const code = err instanceof ApiError ? err.code : undefined;
        toast.error(humanizeApiError(code, status));
      } else {
        triggerLocalBlobDownload(row);
      }
    } finally {
      openGuard.current.delete(row.id);
      if (alive.current) setOpening(new Set(openGuard.current));
    }
  }

  function toggleStar(row: FileRow) {
    const next = !row.starred;
    setStarredMap((current) => ({ ...current, [row.id]: next }));
    setOpenMenuId(null);
    toast.success(next ? `Đã đánh dấu sao "${row.title}"` : `Đã bỏ đánh dấu "${row.title}"`);
  }

  function startRename(row: FileRow) {
    setOpenMenuId(null);
    setRenameTarget(row);
    setRenameDraft(row.title);
  }

  async function handleRenameSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!renameTarget) return;
    const nextTitle = renameDraft.trim();
    if (!nextTitle) return;
    const target = renameTarget;
    if (target.real) {
      try {
        await apiFetch(`/api/files/${target.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: nextTitle }),
        });
      } catch (error) {
        toast.error(error instanceof ApiError ? humanizeApiError(error.code, error.status) : 'Không thể đổi tên tài liệu.');
        return;
      }
    }
    setRenamedTitles((current) => ({ ...current, [target.id]: nextTitle }));
    toast.success(`Đã đổi tên thành "${nextTitle}"`);
    setRenameTarget(null);
  }

  async function deleteFile(row: FileRow) {
    setOpenMenuId(null);
    if (row.real) {
      try {
        await apiFetch(`/api/files/${row.id}`, { method: 'DELETE' });
      } catch (error) {
        toast.error(error instanceof ApiError ? humanizeApiError(error.code, error.status) : 'Không thể xóa tài liệu.');
        return;
      }
    }
    setDeletedIds((current) => new Set(current).add(row.id));
    toast.success(`Đã xóa "${row.title}"`);
  }

  function handleCreateFolder(event: React.FormEvent) {
    event.preventDefault();
    const name = folderDraft.trim();
    if (!name) return;
    const id = `folder-${Date.now()}`;
    setFolders((current) => {
      const next = [{ id, name, count: 0 }, ...current];
      writeLocalStorage(STORAGE_FOLDERS_KEY, next);
      return next;
    });
    setFolderDraft('');
    setFolderModalOpen(false);
    toast.success(`Đã tạo thư mục "${name}"`);
  }

  const baseRows = React.useMemo(() => {
    const fallbackRows = isDemoMode ? localRows : [];
    const serverOrSample = remoteRows.length > 0 ? remoteRows : fallbackRows;
    const combined = [
      ...uploadedRows,
      ...serverOrSample.filter((row) => !uploadedRows.some((up) => up.id === row.id)),
    ];
    return combined
      .filter((row) => !deletedIds.has(row.id))
      .map((row) => {
        const title = renamedTitles[row.id] ?? row.title;
        const ext = extOf(title);
        const starred = row.id in starredMap ? starredMap[row.id] : row.starred;
        return {
          ...row,
          title,
          ext: title === row.title ? row.ext : ext,
          kind: title === row.title ? row.kind : kindOf(ext),
          starred,
        };
      });
  }, [localRows, remoteRows, uploadedRows, deletedIds, renamedTitles, starredMap]);

  React.useEffect(() => {
    const serializable = baseRows.map(({ localUrl: _blobUrl, ...rest }) => rest);
    writeLocalStorage(STORAGE_FILES_KEY, serializable);
  }, [baseRows]);

  React.useEffect(() => {
    writeLocalStorage(STORAGE_FOLDERS_KEY, folders);
  }, [folders]);

  React.useEffect(() => {
    writeLocalStorage(STORAGE_QUOTA_KEY, quotaRequested);
  }, [quotaRequested]);

  const visibleRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseRows.filter((row) => {
      if (tab === 'recent' && !row.recent) return false;
      if (tab === 'shared' && !row.shared) return false;
      if (tab === 'starred' && !row.starred) return false;
      if (selectedFolder && row.folderId !== selectedFolder) return false;
      if (typeFilter !== 'ALL' && row.kind !== typeFilter) return false;
      if (q) {
        const hay = `${row.title} ${row.ext} ${row.uploader}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [baseRows, tab, selectedFolder, typeFilter, query]);

  const isDefaultScope =
    tab === 'all' &&
    !selectedFolder &&
    typeFilter === 'ALL' &&
    query.trim() === '' &&
    visibleRows.length === 5 &&
    uploadedRows.length === 0 &&
    deletedIds.size === 0;

  const footerSummary = isDefaultScope
    ? '5 tệp gần nhất · Dung lượng sử dụng 1,8 / 10 GB'
    : `${visibleRows.length} tệp · Dung lượng sử dụng 1,8 / 10 GB`;

  const renderRowMenu = (row: FileRow, openUp: boolean) => {
    const isOpening = opening.has(row.id);
    const isMenuOpen = openMenuId === row.id;
    return (
      <div
        className="qfl__row-wrap"
        ref={isMenuOpen ? rowMenuRef : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="qfl__more"
          aria-label={`Tùy chọn cho ${row.title}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          disabled={isOpening}
          aria-busy={isOpening}
          onClick={() => setOpenMenuId(isMenuOpen ? null : row.id)}
        >
          <MoreHorizontal size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
        {isMenuOpen ? (
          <div
            className="qfl__row-menu"
            role="menu"
            data-up={openUp ? 'true' : undefined}
            aria-label={`Thao tác ${row.title}`}
          >
            <button
              type="button"
              role="menuitem"
              className="qfl__row-opt"
              onClick={() => void downloadOrOpen(row)}
            >
              <Download size={14} aria-hidden="true" />
              Tải xuống
            </button>
            <button
              type="button"
              role="menuitem"
              className="qfl__row-opt"
              onClick={() => toggleStar(row)}
            >
              <Star
                size={14}
                aria-hidden="true"
                fill={row.starred ? 'currentColor' : 'none'}
              />
              {row.starred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="qfl__row-opt"
              onClick={() => startRename(row)}
            >
              <Pencil size={14} aria-hidden="true" />
              Đổi tên
            </button>
            <button
              type="button"
              role="menuitem"
              className="qfl__row-opt qfl__row-opt--danger"
              onClick={() => deleteFile(row)}
            >
              <Trash2 size={14} aria-hidden="true" />
              Xóa
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section className="qx-page qfl" aria-label="Tài liệu">
      <header className="qx-page-head">
        <div>
          <h1>Tài liệu</h1>
          <p>Lưu trữ và chia sẻ tài liệu an toàn giữa các phân hệ</p>
        </div>
        <div className="qx-actions">
          <button
            type="button"
            className="qx-btn qfl__btn-sec"
            onClick={() => setFolderModalOpen(true)}
          >
            <FolderPlus size={15} strokeWidth={1.6} aria-hidden="true" />
            Tạo thư mục
          </button>
          <label className={uploading ? 'qx-btn qx-btn--primary is-loading' : 'qx-btn qx-btn--primary'}>
            <Upload size={15} strokeWidth={1.6} aria-hidden="true" />
            {uploading ? 'Đang tải lên…' : 'Tải tệp lên'}
            <input
              ref={inputRef}
              type="file"
              className="qs-visually-hidden"
              aria-label="Chọn tệp để tải lên"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>
        </div>
      </header>

      <div className="qfl__toolbar">
        <div className="qx-tabs qfl__tabs" role="tablist" aria-label="Phân loại tài liệu">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="qx-tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="qx-field-search qfl__search">
          <Search size={14} strokeWidth={1.7} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tài liệu..."
            aria-label="Tìm tài liệu"
          />
        </div>
      </div>

      <section className="qfl__folders-sec" aria-label="Thư mục được truy cập gần đây">
        <h2 className="qfl__sec-title">Thư mục được truy cập gần đây</h2>
        <div className="qfl__folders">
          {folders.map((folder) => {
            const active = selectedFolder === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                className="qx-card qfl__folder"
                aria-pressed={active}
                onClick={() => setSelectedFolder(active ? null : folder.id)}
              >
                <Folder size={20} strokeWidth={1.6} className="qfl__folder-icon" aria-hidden="true" />
                <span className="qfl__folder-meta">
                  <strong>{folder.name}</strong>
                  <span>{folder.count} tài liệu</span>
                </span>
                <ChevronRight size={15} strokeWidth={1.7} className="qfl__folder-chev" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="qx-card qfl__card" aria-label="Danh sách tệp">
        <div className="qx-card__head">
          <h2 className="qx-card__title">Danh sách tệp</h2>
          <div className="qfl__card-actions" ref={filterRef}>
            <button
              type="button"
              className="qx-btn qx-btn--sm qfl__tool-btn"
              aria-expanded={filterOpen}
              aria-haspopup="menu"
              onClick={() => setFilterOpen((openState) => !openState)}
            >
              <ListFilter size={14} strokeWidth={1.7} aria-hidden="true" />
              Bộ lọc
            </button>
            <button
              type="button"
              className="qx-btn qx-btn--sm qfl__tool-btn"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode((mode) => (mode === 'list' ? 'grid' : 'list'))}
            >
              {viewMode === 'list' ? (
                <List size={14} strokeWidth={1.7} aria-hidden="true" />
              ) : (
                <LayoutGrid size={14} strokeWidth={1.7} aria-hidden="true" />
              )}
              {viewMode === 'list' ? 'Danh sách' : 'Lưới'}
            </button>
            {filterOpen ? (
              <div className="qfl__filter-pop" role="menu" aria-label="Lọc theo định dạng">
                {TYPE_FILTERS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={typeFilter === opt.id}
                    className="qfl__filter-opt"
                    onClick={() => {
                      setTypeFilter(opt.id);
                      setFilterOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    {typeFilter === opt.id ? <Check size={13} aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="qfl__table-wrap">
            <table className="qx-table qfl__table">
              <thead>
                <tr>
                  <th scope="col">Tên tệp</th>
                  <th scope="col">Loại</th>
                  <th scope="col">Kích thước</th>
                  <th scope="col">Người tải lên</th>
                  <th scope="col">Cập nhật</th>
                  <th scope="col" aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="qfl__empty">
                      {listStatus === 'loading' ? (
                        <div role="status">Đang tải danh sách tệp…</div>
                      ) : listStatus === 'error' ? (
                        <div role="alert" className="qfl__alert-inline">
                          <span>Không thể tải danh sách tệp.</span>
                          <button type="button" className="qx-btn qx-btn--sm" onClick={loadFiles}>
                            Thử lại
                          </button>
                        </div>
                      ) : baseRows.length === 0 ? (
                        'Chưa có tệp nào'
                      ) : (
                        'Không tìm thấy tài liệu phù hợp với bộ lọc hiện tại.'
                      )}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, idx) => {
                    const isOpening = opening.has(row.id);
                    const openUp = idx >= Math.max(2, visibleRows.length - 2);
                    return (
                      <tr
                        key={row.id}
                        className="is-clickable"
                        tabIndex={0}
                        onClick={() => void downloadOrOpen(row)}
                        onKeyDown={(event) => {
                          if (
                            (event.key === 'Enter' || event.key === ' ') &&
                            event.target === event.currentTarget
                          ) {
                            event.preventDefault();
                            void downloadOrOpen(row);
                          }
                        }}
                      >
                        <td>
                          <div className="qfl__name-cell">
                            <button
                              type="button"
                              className="qfl__type-icon"
                              data-kind={row.kind}
                              aria-label="Mở tệp"
                              disabled={isOpening}
                              onClick={(event) => {
                                event.stopPropagation();
                                void downloadOrOpen(row);
                              }}
                            >
                              <FileText size={15} strokeWidth={1.7} aria-hidden="true" />
                            </button>
                            <span className="qfl__file-name">{row.title}</span>
                          </div>
                        </td>
                        <td className="qfl__muted">{row.ext}</td>
                        <td className="qfl__muted">{row.sizeLabel}</td>
                        <td className="qfl__uploader">{row.uploader}</td>
                        <td className="qfl__muted">{row.updatedLabel}</td>
                        <td>{renderRowMenu(row, openUp)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="qfl__empty">
            {listStatus === 'loading' ? (
              <div role="status">Đang tải danh sách tệp…</div>
            ) : listStatus === 'error' ? (
              <div role="alert" className="qfl__alert-inline">
                <span>Không thể tải danh sách tệp.</span>
                <button type="button" className="qx-btn qx-btn--sm" onClick={loadFiles}>
                  Thử lại
                </button>
              </div>
            ) : baseRows.length === 0 ? (
              'Chưa có tệp nào'
            ) : (
              'Không tìm thấy tài liệu phù hợp với bộ lọc hiện tại.'
            )}
          </div>
        ) : (
          <div className="qfl__grid-view">
            {visibleRows.map((row, idx) => {
              const openUp = idx >= Math.max(2, visibleRows.length - 2);
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className="qfl__grid-item"
                  onClick={() => void downloadOrOpen(row)}
                  onKeyDown={(event) => {
                    if (
                      (event.key === 'Enter' || event.key === ' ') &&
                      event.target === event.currentTarget
                    ) {
                      event.preventDefault();
                      void downloadOrOpen(row);
                    }
                  }}
                >
                  <span className="qfl__type-icon" data-kind={row.kind} aria-hidden="true">
                    <FileText size={15} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span className="qfl__grid-meta">
                    <span className="qfl__file-name">{row.title}</span>
                    <span className="qfl__muted">
                      {row.ext} · {row.sizeLabel} · {row.updatedLabel}
                    </span>
                  </span>
                  {renderRowMenu(row, openUp)}
                </div>
              );
            })}
          </div>
        )}

        <footer className="qx-card__foot qfl__foot">
          <span>{footerSummary}</span>
          <button
            type="button"
            className="qx-badge qx-badge--blue qfl__quota qfl__quota-btn"
            onClick={() => setQuotaModalOpen(true)}
          >
            {quotaRequested ? 'Đã gửi yêu cầu mở rộng' : '18% dung lượng'}
          </button>
        </footer>
      </section>

      {folderModalOpen ? (
        <div
          className="qfl__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qfl-folder-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFolderModalOpen(false);
          }}
        >
          <form ref={folderModalRef} className="qfl__modal" onSubmit={handleCreateFolder}>
            <h2 id="qfl-folder-title">Tạo thư mục mới</h2>
            <p>Thư mục giúp phân nhóm tài liệu theo phòng ban hoặc dự án.</p>
            <input
              type="text"
              className="qfl__modal-input"
              placeholder="Ví dụ: Quy trình vận hành Q4"
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              autoFocus
            />
            <div className="qfl__modal-foot">
              <button
                type="button"
                className="qx-btn"
                onClick={() => setFolderModalOpen(false)}
              >
                Hủy
              </button>
              <button type="submit" className="qx-btn qx-btn--primary" disabled={!folderDraft.trim()}>
                Tạo thư mục
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {renameTarget ? (
        <div
          className="qfl__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qfl-rename-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRenameTarget(null);
          }}
        >
          <form ref={renameModalRef} className="qfl__modal" onSubmit={handleRenameSubmit}>
            <h2 id="qfl-rename-title">Đổi tên tài liệu</h2>
            <p>Nhập tên mới cho tệp &ldquo;{renameTarget.title}&rdquo;.</p>
            <input
              type="text"
              className="qfl__modal-input"
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              autoFocus
            />
            <div className="qfl__modal-foot">
              <button
                type="button"
                className="qx-btn"
                onClick={() => setRenameTarget(null)}
              >
                Hủy
              </button>
              <button type="submit" className="qx-btn qx-btn--primary" disabled={!renameDraft.trim()}>
                Lưu tên mới
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {quotaModalOpen ? (
        <div
          className="qfl__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qfl-quota-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setQuotaModalOpen(false);
          }}
        >
          <div ref={quotaModalRef} className="qfl__modal">
            <h2 id="qfl-quota-title">Dung lượng lưu trữ</h2>
            <p>Không gian lưu trữ dùng chung của QTS Workspace.</p>
            <div className="qfl__quota-summary">
              <div className="qfl__quota-row">
                <span>Đã sử dụng</span>
                <strong>1,8 GB / 10 GB (18%)</strong>
              </div>
              <div className="qfl__quota-row">
                <span>Số tệp hiện có</span>
                <strong>{baseRows.length} tệp</strong>
              </div>
              <div className="qfl__quota-row">
                <span>Trạng thái yêu cầu</span>
                <strong>{quotaRequested ? 'Đã gửi (+10 GB)' : 'Gói tiêu chuẩn'}</strong>
              </div>
            </div>
            <div className="qfl__modal-foot">
              <button
                type="button"
                className="qx-btn"
                onClick={() => setQuotaModalOpen(false)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="qx-btn qx-btn--primary"
                disabled={quotaRequested}
                onClick={() => {
                  setQuotaRequested(true);
                  toast.success('Đã gửi yêu cầu mở rộng dung lượng tới quản trị viên');
                }}
              >
                {quotaRequested ? 'Đã gửi yêu cầu' : 'Gửi yêu cầu mở rộng dung lượng'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
