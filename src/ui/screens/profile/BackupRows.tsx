import { useRef, useState } from 'react';
import { getServices } from '@/app/services';
import { APP_CONFIG } from '@/config/app';
import { exportBackup, importBackup, readBackupManifest } from '@/db/backup';
import { tr } from '@/i18n/locale';
import { t } from '@/i18n/text';
import { shareFile } from '@/render/exports';
import { Button, ListRow, Sheet } from '@/ui/kit';

function Glyph({ d }: { d: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const dateText = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Sauvegarde complète de la progression en fichier .zip (partagé vers Drive, Fichiers…) et restauration
 * depuis un fichier choisi, après confirmation. L'application redémarre sur la progression importée.
 */
export function BackupRows() {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<{ bytes: Uint8Array; exportedAt: number; version: string } | null>(
    null,
  );

  const doExport = async () => {
    setStatus(tr(t('Préparation…', 'Preparing…')));
    try {
      const { db, meta } = await getServices();
      await meta.flush();
      const bytes = await exportBackup(db, APP_CONFIG.version);
      const day = new Date().toISOString().slice(0, 10);
      await shareFile(
        new Blob([bytes.slice().buffer], { type: 'application/zip' }),
        `tessel-sauvegarde-${day}.zip`,
        'Tessel',
      );
      setStatus(tr(t('Sauvegarde prête ✓', 'Backup ready ✓')));
    } catch (e) {
      console.error('Sauvegarde impossible', e);
      setStatus(tr(t('Sauvegarde impossible pour le moment', 'Backup unavailable right now')));
    }
  };

  const pick = async (file: File) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const m = readBackupManifest(bytes);
      setPending({ bytes, exportedAt: m.exportedAt, version: m.appVersion });
    } catch {
      setStatus(tr(t('Ce fichier n’est pas une sauvegarde Tessel', 'This file is not a Tessel backup')));
    }
  };

  const restore = async () => {
    if (!pending) return;
    try {
      const { db, meta } = await getServices();
      await meta.flush();
      await importBackup(db, pending.bytes);
      // tout repart de la base restaurée
      location.reload();
    } catch (e) {
      console.error('Restauration impossible', e);
      setPending(null);
      setStatus(
        tr(
          t(
            'Restauration impossible : fichier abîmé ou trop récent',
            'Restore failed: damaged or newer file',
          ),
        ),
      );
    }
  };

  return (
    <>
      <ListRow
        icon={<Glyph d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />}
        title={tr(t('Sauvegarder ma progression', 'Back up my progress'))}
        subtitle={
          status ?? tr(t('Un fichier .zip à garder où tu veux', 'A .zip file to keep wherever you like'))
        }
        onClick={() => {
          void doExport();
        }}
      />
      <ListRow
        icon={<Glyph d="M12 21V9m0 0l-4 4m4-4l4 4M5 3h14" />}
        title={tr(t('Restaurer une sauvegarde', 'Restore a backup'))}
        subtitle={tr(t('Remplace la progression actuelle', 'Replaces your current progress'))}
        onClick={() => {
          input.current?.click();
        }}
      />
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (f) void pick(f);
        }}
      />
      <Sheet
        open={pending !== null}
        onClose={() => {
          setPending(null);
        }}
        label={tr(t('Restaurer une sauvegarde', 'Restore a backup'))}
      >
        <div className="set-confirm">
          <h3>{tr(t('Restaurer cette sauvegarde ?', 'Restore this backup?'))}</h3>
          {pending && (
            <p>
              {tr(
                t(
                  `Sauvegarde du ${dateText(pending.exportedAt)} (version ${pending.version}). Ta progression actuelle sera remplacée, puis Tessel redémarrera.`,
                  `Backup from ${dateText(pending.exportedAt)} (version ${pending.version}). Your current progress will be replaced, then Tessel will restart.`,
                ),
              )}
            </p>
          )}
          <Button
            variant="filled"
            onClick={() => {
              void restore();
            }}
          >
            {tr(t('Restaurer', 'Restore'))}
          </Button>
          <Button
            variant="text"
            onClick={() => {
              setPending(null);
            }}
          >
            {tr(t('Annuler', 'Cancel'))}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
