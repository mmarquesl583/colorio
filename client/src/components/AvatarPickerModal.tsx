import { useEffect, useState } from 'react';
import { AVATAR_ICONS, avatarSmallSrc } from '@shared/avatarIcons';
import { setAccountAvatar } from '../auth.ts';

interface Props {
  currentIcon: string | null;
  fallbackLetter: string;
  unlockedAvatarIds: Set<string>;
  onClose: () => void;
}

export default function AvatarPickerModal({ currentIcon, fallbackLetter, unlockedAvatarIds, onClose }: Props) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = async (icon: string | null) => {
    if (saving || icon === currentIcon) { onClose(); return; }
    setSaving(true);
    await setAccountAvatar(icon).finally(() => setSaving(false));
    onClose();
  };

  return (
    <div className="corio-avatar-modal-backdrop" onClick={onClose}>
      <div className="corio-avatar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="corio-avatar-modal-header">
          <div className="corio-avatar-modal-title">Escolha seu ícone</div>
          <button onClick={onClose} className="corio-tap corio-avatar-modal-close" aria-label="Fechar">✕</button>
        </div>

        {AVATAR_ICONS.length === 0 ? (
          <div className="corio-avatar-modal-empty">Em breve você vai poder escolher um ícone aqui. 🎨</div>
        ) : (
          <div className="corio-avatar-modal-grid">
            <div className="corio-avatar-modal-item">
              <button
                onClick={() => choose(null)}
                className={`corio-tap corio-avatar-modal-option ${currentIcon === null ? 'is-selected' : ''}`}
                aria-label="Usar inicial do nome"
              >
                <span className="corio-avatar-modal-letter">{fallbackLetter}</span>
              </button>
              <span className="corio-avatar-modal-label">Inicial</span>
            </div>
            {AVATAR_ICONS.map((icon) => {
              const unlocked = icon.free || unlockedAvatarIds.has(icon.id);
              return (
                <div key={icon.id} className="corio-avatar-modal-item">
                  <button
                    onClick={() => unlocked && choose(icon.id)}
                    disabled={!unlocked}
                    className={`corio-tap corio-avatar-modal-option ${currentIcon === icon.id ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}`}
                    aria-label={unlocked ? `Usar ícone ${icon.name}` : `${icon.name} (bloqueado)`}
                  >
                    <img src={avatarSmallSrc(icon.id)} alt="" loading="lazy" />
                    {!unlocked && <span className="corio-avatar-modal-lock">🔒</span>}
                  </button>
                  <span className="corio-avatar-modal-label">{icon.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
