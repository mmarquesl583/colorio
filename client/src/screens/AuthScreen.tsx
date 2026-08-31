import { useState } from 'react';
import { supabase, supabaseConfigured } from '../supabase.ts';

type Mode = 'login' | 'signup';

interface Props {
  onBack: () => void;
  onAuthed: () => void;
}

function translateAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Esse e-mail já tem uma conta. Tente entrar.';
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/invalid email|unable to validate email/i.test(msg)) return 'E-mail inválido.';
  return msg;
}

export default function AuthScreen({ onBack, onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chooseMode = (m: Mode) => { setMode(m); setError(null); setInfo(null); };

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!supabaseConfigured) { setError('O login ainda não foi configurado neste servidor.'); return; }
    if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
    if (mode === 'signup' && !displayName.trim()) { setError('Escolha um nome pra aparecer no jogo.'); return; }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (err) { setError(translateAuthError(err.message)); return; }
        if (data.session) { onAuthed(); return; }
        setInfo('Quase lá! Confirme seu e-mail pra ativar a conta e depois entre.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) { setError(translateAuthError(err.message)); return; }
        onAuthed();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="corio-wide" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 16px 14px', gap: 10, animation: 'corio-rise .4s ease' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          className="corio-tap"
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 13, background: '#1A0A33', border: '2.5px solid #4A2B7A', color: '#fff', fontSize: 17, boxShadow: '0 3px 0 rgba(0,0,0,0.35)' }}
        >‹</button>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 22, color: '#fff' }}>
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </div>
        <div className="corio-subtitle" style={{ fontSize: 10.5, color: 'rgba(244,242,248,0.55)', marginTop: 2, fontWeight: 600 }}>
          {mode === 'login' ? 'Entre pra salvar seu progresso.' : 'Cadastre-se pra salvar seu progresso.'}
        </div>
      </div>

      <div className="corio-find-tabs" style={{ flex: 'none' }}>
        <button onClick={() => chooseMode('login')} className={`corio-find-tab ${mode === 'login' ? 'active' : ''}`}>Entrar</button>
        <button onClick={() => chooseMode('signup')} className={`corio-find-tab ${mode === 'signup' ? 'active' : ''}`}>Criar conta</button>
      </div>

      <div className="corio-card" style={{ flex: 'none', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mode === 'signup' && (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
            placeholder="Seu nome"
            className="corio-home-v2-input"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          type="email"
          autoComplete="email"
          className="corio-home-v2-input"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="corio-home-v2-input"
        />

        {error && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(239,68,68,0.35)', border: '2px solid #EF4444', borderRadius: 12, padding: '9px 12px' }}>{error}</div>
        )}
        {info && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(74,222,128,0.18)', border: '2px solid #4ADE80', borderRadius: 12, padding: '9px 12px' }}>{info}</div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="corio-tap corio-btn-lg"
          style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%', textAlign: 'center', background: 'linear-gradient(90deg,#8B5CF6,#6D28D9)', color: '#fff', fontWeight: 800, fontSize: 13.5, padding: 13, borderRadius: 13, opacity: busy ? 0.6 : 1 }}
        >{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar →' : 'Criar conta →'}</button>
      </div>
    </div>
  );
}
