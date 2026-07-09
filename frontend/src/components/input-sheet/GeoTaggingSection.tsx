import { useState } from 'react';
import {
  useCreateGeoPhotoUrlMutation,
  useDeleteGeoPhotoMutation,
} from '../../app/api/geoPhotosApi';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { FormField } from './FormField';
import { FormSectionHeader } from './FormSectionHeader';
import type { GeoPhoto } from '../../types/api';
import type { ProjectDraft } from '../../hooks/useProjectDraft';

interface Props {
  projectId: string | null;
  draft: ProjectDraft;
  setField: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
  photos: GeoPhoto[];
}

export function GeoTaggingSection({ projectId, draft, setField, photos }: Props): JSX.Element {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createPhoto, createState] = useCreateGeoPhotoUrlMutation();
  const [deletePhoto, deleteState] = useDeleteGeoPhotoMutation();

  const busy = createState.isLoading || deleteState.isLoading;

  const canSave = projectId !== null && url.trim().length > 0;

  const handleAddUrl = async (): Promise<void> => {
    if (!projectId || !url.trim()) return;
    try {
      setError(null);
      await createPhoto({
        projectId,
        body: {
          url: url.trim(),
          caption: caption.trim() || null,
          photoDate: new Date().toISOString().slice(0, 10),
        },
      }).unwrap();
      setUrl('');
      setCaption('');
    } catch (err) {
      setError(readError(err));
    }
  };

  const handleDelete = async (photoId: number): Promise<void> => {
    if (!projectId) return;
    if (!window.confirm('Delete this photo?')) return;
    try {
      setError(null);
      await deletePhoto({ projectId, photoId }).unwrap();
    } catch (err) {
      setError(readError(err));
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <FormSectionHeader
          num="06"
          title="Geo-Tagging"
          sub="Reference/overview URL for the dashboard + linked site photos"
        />

        <div className="mb-4">
          <FormField
            label="Geo-Tagging URL (overview / dashboard link)"
            value={draft.geoTaggingUrl}
            onChange={(v) => setField('geoTaggingUrl', v || null)}
            placeholder="https://…"
            hint="Full URL only (https://…). Blank is allowed."
          />
        </div>

        <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
          <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#374151]">
            Add photo (by URL / link)
          </div>
          {!projectId ? (
            <p className="rounded border border-[#FDE68A] bg-[#FFFBEB] px-2 py-1.5 text-[12px] text-[#92400E]">
              Save the project first — photos attach to an existing project.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto]">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…  or paste Maps/Drive/WhatsApp link"
                className="h-9 rounded border border-[#D1D5DB] bg-white px-3 text-[13px]"
              />
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption (optional)"
                className="h-9 rounded border border-[#D1D5DB] bg-white px-3 text-[13px]"
              />
              <Button size="sm" onClick={handleAddUrl} disabled={!canSave || busy}>
                + Add Link
              </Button>
            </div>
          )}
          <p className="mt-2 text-[11px] text-[#6B7280]">
            💡 File uploads (JPG/PNG/WEBP, ≤3 MB, up to 6 files) run from the dedicated Photos
            view — this section keeps URL-source references only.
          </p>
        </div>

        {error ? (
          <div className="mt-3 rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
            {error}
          </div>
        ) : null}

        {photos.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p) => (
              <div
                key={p.photoId}
                className="overflow-hidden rounded border border-[#E5E7EB] bg-white"
              >
                <div className="relative flex h-32 items-center justify-center bg-[#F3F4F6]">
                  <img
                    src={p.url}
                    alt={p.caption ?? 'Site photo'}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                    }}
                  />
                </div>
                <div className="px-2.5 py-1.5">
                  <div className="truncate text-[12px] font-semibold text-[#111827]">
                    {p.caption ?? '—'}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#6B7280]">
                    <span>{p.photoDate ?? '—'}</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[#2563EB] hover:underline"
                      >
                        Open ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.photoId)}
                        disabled={busy}
                        className="text-[#B91C1C] hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : projectId ? (
          <p className="mt-4 text-[12.5px] text-[#6B7280]">No photos yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function readError(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const e = (data as { error?: { message?: string } }).error;
      if (e?.message) return e.message;
    }
  }
  return 'Something went wrong. Please retry.';
}
