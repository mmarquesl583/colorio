import { useEffect, useState } from 'react';
import {
  AVATAR_ICONS, AVATAR_CATEGORIES, RARITY_LABELS, avatarSmallSrc, avatarLargeSrc,
  type AvatarCategory,
} from '@shared/avatarIcons';
import { TITLE_CATALOG, TITLE_CATEGORIES, titleNameFor, type TitleCategory } from '@shared/titleCatalog';
import { setAccountAvatar } from '../auth.ts';
import { equipTitle } from '../stats.ts';

type Mode = 'avatar' | 'title';

interface Props {
  initialMode: Mode;
  playerName: string;
  fallbackLetter: string;
  currentAvatarId: string | null;
  currentTitleId: string | null;
  unlockedAvatarIds: Set<string>;
  unlockedTitleIds: Set<string>;
  onAvatarEquipped: (iconId: string | null) => void;
  onTitleEquipped: (titleId: string | null) => void;
  onClose: () => void;
}

export default function IdentityPickerModal({
  initialMode, playerName, fallbackLetter, currentAvatarId, currentTitleId,
  unlockedAvatarIds, unlockedTitleIds, onAvatarEquipped, onTitleEquipped, onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [avatarCat, setAvatarCat] = useState<AvatarCategory | 'todos'>('todos');
  const [titleCat, setTitleCat] = useState<TitleCategory | 'todos'>('todos');
  const [previewAvatarId, setPreviewAvatarId] = useState<string | null>(currentAvatarId);
  const [previewTitleId, setPreviewTitleId] = useState<string | null>(currentTitleId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const avatarList = AVATAR_ICONS.filter((a) => avatarCat === 'todos' || a.category === avatarCat);
  const titleList = TITLE_CATALOG.filter((t) => titleCat === 'todos' || t.category === titleCat);
  const previewAvatar = AVATAR_ICONS.find((a) => a.id === previewAvatarId) ?? null;
  const previewTitle = TITLE_CATALOG.find((t) => t.id === previewTitleId) ?? null;
  const currentTitleName = titleNameFor(currentTitleId);
  const avatarChanged = previewAvatarId !== currentAvatarId;
  const titleChanged = previewTitleId !== currentTitleId;

  const commitAvatar = async () => {
    if (saving || !avatarChanged) return;
    setSaving(true);
    await setAccountAvatar(previewAvatarId).finally(() => setSaving(false));
    onAvatarEquipped(previewAvatarId);
  };
  const commitTitle = async () => {
    if (saving || !titleChanged) return;
    setSaving(true);
    await equipTitle(previewTitleId).finally(() => setSaving(false));
    onTitleEquipped(previewTitleId);
  };

  return (
    <div className="corio-picker-backdrop" onClick={onClose}>
      <div className="corio-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="corio-picker-header">
          <div className="corio-picker-header-title">
            <span className="corio-picker-crown">👑</span>
            <div style={{ minWidth: 0 }}>
              <div className="corio-picker-title-text">Escolha seu {mode === 'avatar' ? 'ícone' : 'título'}</div>
              <div className="corio-picker-subtitle">Mostre seu estilo no Colorio</div>
            </div>
          </div>
          <div className="corio-picker-header-actions">
            <div className="corio-picker-mode-toggle">
              <button onClick={() => setMode('avatar')} className={`corio-tap corio-picker-mode-btn ${mode === 'avatar' ? 'is-active' : ''}`}>Ícone</button>
              <button onClick={() => setMode('title')} className={`corio-tap corio-picker-mode-btn ${mode === 'title' ? 'is-active' : ''}`}>Título</button>
            </div>
            <button onClick={onClose} className="corio-tap corio-picker-close" aria-label="Fechar">✕</button>
          </div>
        </div>

        {mode === 'avatar' ? (
          <div className="corio-picker-body">
            <div className="corio-picker-preview">
              <div className="corio-picker-preview-circle">
                {previewAvatar ? <img src={avatarLargeSrc(previewAvatar.id)} alt="" /> : <span className="corio-picker-preview-letter">{fallbackLetter}</span>}
              </div>
              {previewAvatar && (
                <div className={`corio-picker-rarity corio-picker-rarity-${previewAvatar.rarity}`}>{RARITY_LABELS[previewAvatar.rarity]}</div>
              )}
              <div className="corio-picker-preview-name">{previewAvatar?.name ?? 'Inicial'}</div>
              <div className="corio-picker-preview-desc">{previewAvatar?.description ?? 'Suas iniciais, do jeito mais simples.'}</div>
              <button onClick={commitAvatar} disabled={saving || !avatarChanged} className="corio-tap corio-picker-confirm-btn">
                {avatarChanged ? (saving ? 'Salvando…' : 'Selecionar ícone') : 'Equipado ✓'}
              </button>
            </div>

            <div className="corio-picker-browser">
              <div className="corio-picker-tabs corio-noscroll">
                <button onClick={() => setAvatarCat('todos')} className={`corio-tap corio-picker-tab ${avatarCat === 'todos' ? 'is-active' : ''}`}><span>▦</span> Todos</button>
                {AVATAR_CATEGORIES.map((c) => (
                  <button key={c.id} onClick={() => setAvatarCat(c.id)} className={`corio-tap corio-picker-tab ${avatarCat === c.id ? 'is-active' : ''}`}><span>{c.icon}</span> {c.label}</button>
                ))}
              </div>
              <div className="corio-picker-grid corio-noscroll">
                <button
                  onClick={() => setPreviewAvatarId(null)}
                  className={`corio-tap corio-picker-grid-item ${previewAvatarId === null ? 'is-selected' : ''}`}
                >
                  <span className="corio-picker-letter">{fallbackLetter}</span>
                  {currentAvatarId === null && <span className="corio-picker-current-badge">✓</span>}
                </button>
                {avatarList.map((a) => {
                  const unlocked = a.free || unlockedAvatarIds.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => unlocked && setPreviewAvatarId(a.id)}
                      disabled={!unlocked}
                      className={`corio-tap corio-picker-grid-item ${previewAvatarId === a.id ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}`}
                      aria-label={unlocked ? `Usar ícone ${a.name}` : `${a.name} (bloqueado)`}
                    >
                      <img src={avatarSmallSrc(a.id)} alt="" loading="lazy" />
                      {!unlocked && <span className="corio-picker-lock">🔒</span>}
                      {currentAvatarId === a.id && unlocked && <span className="corio-picker-current-badge">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="corio-picker-body">
            <div className="corio-picker-preview">
              <div className="corio-picker-mini-identity">
                <div className="corio-picker-mini-avatar">
                  {currentAvatarId ? <img src={avatarSmallSrc(currentAvatarId)} alt="" /> : fallbackLetter}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="corio-picker-mini-name">{playerName}</div>
                  <div className="corio-picker-mini-title">{currentTitleName}</div>
                </div>
              </div>
              <div className="corio-picker-divider" />
              <div className="corio-picker-eyebrow">TÍTULO SELECIONADO</div>
              <div className="corio-picker-title-card">{previewTitle?.name ?? 'Novato das Cores'}</div>
              <div className="corio-picker-preview-desc">{previewTitle?.description ?? 'Todo mestre um dia começou por aqui.'}</div>
              <button onClick={commitTitle} disabled={saving || !titleChanged} className="corio-tap corio-picker-confirm-btn">
                {titleChanged ? (saving ? 'Salvando…' : 'Selecionar título') : 'Equipado ✓'}
              </button>
            </div>

            <div className="corio-picker-browser">
              <div className="corio-picker-tabs corio-noscroll">
                <button onClick={() => setTitleCat('todos')} className={`corio-tap corio-picker-tab ${titleCat === 'todos' ? 'is-active' : ''}`}>Todos</button>
                {TITLE_CATEGORIES.map((c) => (
                  <button key={c.id} onClick={() => setTitleCat(c.id)} className={`corio-tap corio-picker-tab ${titleCat === c.id ? 'is-active' : ''}`}>{c.label}</button>
                ))}
              </div>
              <div className="corio-picker-list corio-noscroll">
                {titleList.map((t) => {
                  const unlocked = t.free || unlockedTitleIds.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => unlocked && setPreviewTitleId(t.id)}
                      disabled={!unlocked}
                      className={`corio-tap corio-picker-list-item ${previewTitleId === t.id ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}`}
                      aria-label={unlocked ? `Usar título ${t.name}` : `${t.name} (bloqueado)`}
                    >
                      <span>{t.name}</span>
                      {unlocked ? <span className="corio-picker-radio">{previewTitleId === t.id ? '●' : '○'}</span> : <span className="corio-picker-lock">🔒</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
