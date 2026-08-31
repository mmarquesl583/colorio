import { useEffect, useState } from 'react';
import { TITLE_CATALOG } from '@shared/titleCatalog';
import { equipTitle } from '../stats.ts';

interface Props {
  currentTitleId: string | null;
  unlockedTitleIds: Set<string>;
  onClose: () => void;
}

export default function TitlePickerModal({ currentTitleId, unlockedTitleIds, onClose }: Props) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = async (titleId: string) => {
    if (saving || titleId === currentTitleId) { onClose(); return; }
    setSaving(true);
    await equipTitle(titleId).finally(() => setSaving(false));
    onClose();
  };

  return (
    <div className="corio-avatar-modal-backdrop" onClick={onClose}>
      <div className="corio-avatar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="corio-avatar-modal-header">
          <div className="corio-avatar-modal-title">Escolha seu título</div>
          <button onClick={onClose} className="corio-tap corio-avatar-modal-close" aria-label="Fechar">✕</button>
        </div>

        <div className="corio-title-modal-list">
          {TITLE_CATALOG.map((title) => {
            const unlocked = title.free || unlockedTitleIds.has(title.id);
            return (
              <button
                key={title.id}
                onClick={() => unlocked && choose(title.id)}
                disabled={!unlocked}
                className={`corio-tap corio-title-modal-option ${currentTitleId === title.id ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}`}
                aria-label={unlocked ? `Usar título ${title.name}` : `${title.name} (bloqueado)`}
              >
                <span>{title.name}</span>
                {!unlocked && <span className="corio-title-modal-lock">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
