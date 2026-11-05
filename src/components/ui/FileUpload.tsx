import { FileText, ImageIcon, Upload, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentMeta } from '../../data';
import { cn } from '../../lib/cn';
import { UPLOAD_ACCEPT, validateUpload } from '../../lib/upload';
import { FieldError } from './Field';

const ACCEPT = UPLOAD_ACCEPT.join(',');

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

/**
 * One document slot with an image preview and the file name. The file itself rides along in memory:
 * Supabase mode uploads it to the private org-docs bucket; mock mode keeps only its metadata (SPEC §13).
 */
export function FileUpload({
  label,
  docType,
  value,
  onChange,
  required,
}: {
  label: string;
  docType: string;
  value: DocumentMeta | null;
  onChange: (doc: DocumentMeta | null) => void;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = validateUpload(file);
    if (problem) {
      setError(t(`errors.${problem}`));
      return;
    }
    setError(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    });
    onChange({ docType, fileName: file.name, size: file.size, mime: file.type, file });
  };

  const clear = () => {
    setPreview(null);
    onChange(null);
    if (input.current) input.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-medium">
        {label}
        {required && <span className="ms-1 text-bad-text" aria-hidden>*</span>}
      </label>
      <div
        className={cn(
          'flex items-center gap-3 rounded-card border border-dashed p-3',
          error ? 'border-bad-text' : value ? 'border-secondary bg-mint' : 'border-border bg-surface',
        )}
      >
        {preview ? (
          <img src={preview} alt="" className="size-12 rounded-control object-cover" />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-control bg-canvas">
            {value?.mime.startsWith('image/') ? (
              <ImageIcon aria-hidden className="size-6 text-secondary" />
            ) : (
              <FileText aria-hidden className="size-6 text-secondary" />
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {value ? (
            <>
              <p className="truncate font-medium" dir="auto">
                {value.fileName}
              </p>
              <p className="text-meta text-ink-muted">
                <bdi>{kb(value.size)}</bdi>
              </p>
            </>
          ) : (
            <p className="text-meta text-ink-muted">{t('upload.hint')}</p>
          )}
        </div>
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label={t('upload.remove', { name: value.fileName })}
            className="inline-flex size-10 items-center justify-center rounded-control text-ink-muted hover:bg-canvas"
          >
            <X aria-hidden className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-primary px-3 font-medium text-primary hover:bg-mint"
          >
            <Upload aria-hidden className="size-4" />
            {t('upload.choose')}
          </button>
        )}
        <input
          ref={input}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-required={required}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
