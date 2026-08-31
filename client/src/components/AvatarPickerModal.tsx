import { useEffect, useState } from 'react';
import { AVATAR_ICONS } from '../avatarIcons.ts';
import { setAccountAvatar } from '../auth.ts';

const IMG = '/images/avatars';

interface Props {
  currentIcon: string | null;
  fallbackLetter: string;
  onClose: () => void;
}

export default function AvatarPickerModal({ currentIcon, fallbackLetter, onClose }: Props) {
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
            <button
              onClick={() => choose(null)}
              className={`corio-tap corio-avatar-modal-option ${currentIcon === null ? 'is-selected' : ''}`}
              aria-label="Usar inicial do nome"
            >
              <span className="corio-avatar-modal-letter">{fallbackLetter}</span>
            </button>
            {AVATAR_ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => choose(icon)}
                className={`corio-tap corio-avatar-modal-option ${currentIcon === icon ? 'is-selected' : ''}`}
                aria-label="Usar este ícone"
              >
                <img src={`${IMG}/${icon}`} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
