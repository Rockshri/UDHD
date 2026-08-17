import { useEffect, useState } from 'react';
import { Button } from '../ui/button';

/**
 * Single-field modal for adding a Sector or a Scheme. Shared between
 * SectorsPage and SchemesPage — same visual shape, only the labels and
 * save handler differ.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  fieldLabel: string;
  placeholder: string;
  maxLength: number;
  saving: boolean;
  onSave: (value: string) => Promise<void>;
}

export function AddLookupModal({
  open, onClose, title, fieldLabel, placeholder, maxLength, saving, onSave,
}: Props): JSX.Element | null {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset local state whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setValue('');
      setError(null);
    }
  }, [open]);

  // Escape to close (unless a save is in flight).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && !saving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (e) {
      const msg = (e as { data?: { error?: { message?: string } }; message?: string })?.data?.error?.message
        ?? (e as { message?: string })?.message
        ?? `Could not save ${fieldLabel.toLowerCase()}.`;
      setError(msg);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center px-3"
    >
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
        <div className="border-b border-[#F3F4F6] px-4 py-3">
          <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
        </div>

        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#374151]">
              {fieldLabel} <span className="text-[#B91C1C]">*</span>
            </span>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={maxLength}
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              className="h-9 w-full rounded border border-[#D1D5DB] px-3 text-sm focus:border-[#1E3A5F] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
            />
            <p className="mt-1 text-[10.5px] text-[#9CA3AF]">
              {trimmed.length}/{maxLength} characters
            </p>
          </label>

          {error ? (
            <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] font-medium text-[#B91C1C]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#F3F4F6] px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
