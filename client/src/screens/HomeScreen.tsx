import { useState } from 'react';
import Logo from '../components/Logo.tsx';

interface Props {
  connecting: boolean;
  error: string | null;
  onClearError: () => void;
  onStartCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
}

export default function HomeScreen({ connecting, error, onClearError, onStartCreate, onJoin }: Props) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#12121a',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
    padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none',
  };

  const canSubmit = name.trim().length > 0 && (mode === 'create' || code.trim().length === 4);

  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'create') onStartCreate(name.trim());
    else onJoin(name.trim(), code.trim());
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 40px', gap: 22, textAlign: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 34 }}>🎨</div>
        <Logo size={30} />
        <div style={{ fontSize: 12, color: 'rgba(244,242,248,0.5)' }}>Adivinhe a cor, ganhe pontos, se divirta.</div>
      </div>

      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setMode('create'); onClearError(); }}
            style={{
              all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '9px 0',
              borderRadius: 11, fontSize: 12, fontWeight: 700,
              background: mode === 'create' ? 'linear-gradient(90deg,#8B5CF6,#6D28D9)' : 'rgba(255,255,255,0.05)',
              color: mode === 'create' ? '#fff' : 'rgba(244,242,248,0.55)',
            }}
          >🚀 Criar sala</button>
          <button
            onClick={() => { setMode('join'); onClearError(); }}
            style={{
              all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '9px 0',
              borderRadius: 11, fontSize: 12, fontWeight: 700,
              background: mode === 'join' ? 'linear-gradient(90deg,#29E7FF,#0891B2)' : 'rgba(255,255,255,0.05)',
              color: mode === 'join' ? '#04222b' : 'rgba(244,242,248,0.55)',
            }}
          >🔑 Entrar com código</button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="Seu nome"
          style={inputStyle}
        />
        {mode === 'join' && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            placeholder="Código da sala (ex: 7F92)"
            style={{ ...inputStyle, letterSpacing: 2, fontFamily: "'Space Grotesk',sans-serif", textAlign: 'center' }}
          />
        )}

        {error && (
          <div style={{ fontSize: 11.5, color: '#FCA5A5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '8px 10px' }}>{error}</div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit || connecting}
          style={{
            all: 'unset', cursor: canSubmit ? 'pointer' : 'default', boxSizing: 'border-box', width: '100%',
            textAlign: 'center', background: canSubmit ? 'linear-gradient(90deg,#8B5CF6,#6D28D9)' : 'rgba(255,255,255,0.08)',
            color: '#fff', fontWeight: 800, fontSize: 13, padding: 13, borderRadius: 13,
            opacity: connecting ? 0.6 : 1,
          }}
        >{connecting ? 'Conectando…' : mode === 'create' ? 'Continuar →' : 'Entrar na sala →'}</button>
      </div>
    </div>
  );
}
