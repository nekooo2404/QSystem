'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { StateRegion, toast } from '@qsystem/ui';
import { ApiError, apiFetch } from '../../../lib/api/client';
import { humanizeApiError } from '../../../lib/errors/humanize';

/**
 * GET /files lists metadata; GET /files/:id refreshes the download URL.
 */
interface FileRow {
  id: string;
  title: string;
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

/** Object keys must be relative and unique; a timestamp keeps re-uploads apart. */
function objectKey(file: File): string {
  return `uploads/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
}

export default function FilesPage() {
  const [rows, setRows] = React.useState<FileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const additions = React.useRef(new Map<string, FileRow>());
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void apiFetch<Array<{ id: string; key: string }>>('/api/files')
      .then((items) => {
        if (!active) return;
        const listed = items.map((item) => ({
            id: item.id,
            title: item.key.split('/').pop() || item.key,
          }));
        setRows([...additions.current.values(), ...listed.filter(row => !additions.current.has(row.id))]);
      })
      .catch((err) => {
        if (active) setError(humanizeApiError(err instanceof ApiError ? err.code : undefined, err instanceof ApiError ? err.status : undefined));
      }).finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
    };
  }, [attempt]);
  const [uploading, setUploading] = React.useState(false);
  const uploadGuard = React.useRef(false);
  const openGuard = React.useRef(new Set<string>());
  const [opening, setOpening] = React.useState(new Set<string>());
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (uploadGuard.current) return;
    uploadGuard.current = true;
    setUploading(true);
    try {
      const presign = await apiFetch<PresignResult>('/api/files/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: BUCKET, key: objectKey(file), mimeType: file.type, size: file.size }),
      });
      const put = await fetch(presign.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!put.ok) throw new Error('upload failed');
      if (!alive.current) return;
      const row = { id: presign.fileId, title: file.name };
      additions.current.set(row.id, row);
      setRows((current) => [row, ...current.filter(item => item.id !== row.id)]);
      toast.success(`Đã tải lên ${file.name}`);
    } catch (err) {
      if (!alive.current) return;
      toast.error(
        humanizeApiError(err instanceof ApiError ? err.code : undefined, err instanceof ApiError ? err.status : undefined),
      );
    } finally {
      uploadGuard.current = false;
      if (alive.current) setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function open(row: FileRow) {
    if (openGuard.current.has(row.id)) return;
    openGuard.current.add(row.id);
    setOpening(new Set(openGuard.current));
    try {
      const file = await apiFetch<DownloadResult>(`/api/files/${row.id}`);
      if (alive.current) window.open(file.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      if (!alive.current) return;
      toast.error(
        humanizeApiError(err instanceof ApiError ? err.code : undefined, err instanceof ApiError ? err.status : undefined),
      );
    } finally {
      openGuard.current.delete(row.id);
      if (alive.current) setOpening(new Set(openGuard.current));
    }
  }

  return (
    <section className="qs-files qs-page" aria-label="Tài liệu">
      <div className="qs-page__head">
        <h1>Tài liệu</h1>
        <label className={uploading ? 'qs-btn qs-btn--primary qs-btn--md is-loading' : 'qs-btn qs-btn--primary qs-btn--md'}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
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

      {error ? <StateRegion state="error" errorDescription={error} onRetry={() => { if (!loading) setAttempt(value => value + 1); }} /> : null}
      {loading && rows.length === 0 ? <StateRegion state="loading" rows={4} /> : !loading && !error && rows.length === 0 ? (
        <StateRegion
          state="empty"
          emptyTitle="Chưa có tệp nào"
          emptyDescription="Tệp bạn tải lên sẽ hiển thị ở đây và được đưa vào tìm kiếm."
        />
      ) : rows.length > 0 ? (
        <ul className="qs-files__list">
          {rows.map((row) => (
            <li key={row.id} className="qs-files__item">
              <span className="qs-files__title">{row.title}</span>
              <button
                type="button"
                className="qs-btn qs-btn--secondary qs-btn--sm"
                onClick={() => void open(row)}
                disabled={opening.has(row.id)}
                aria-busy={opening.has(row.id)}
              >
                {opening.has(row.id) ? 'Đang mở…' : 'Mở tệp'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
