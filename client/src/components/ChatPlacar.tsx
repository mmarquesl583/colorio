import { useEffect, useRef, useState } from 'react';
import type { ChatEntry, PlayerPublic } from '@shared/types';

interface Props {
  players: PlayerPublic[];
  youId: string;
  chat: ChatEntry[];
  onSendChat: (text: string) => void;
}

export default function ChatPlacar({ players, youId, chat, onSendChat }: Props) {
  const [tab, setTab] = useState<'placar' | 'chat'>('chat');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.length, tab]);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const send = () => {
    if (!draft.trim()) return;
    onSendChat(draft);
    setDraft('');
  };

  return (
    <>
      <div style={{ flex: 'none', display: 'flex', gap: 4, margin: '8px 16px 0' }}>
        <TabButton active={tab === 'placar'} color="#FF5C8A" label="🏆 PLACAR" onClick={() => setTab('placar')} />
        <TabButton active={tab === 'chat'} color="#29E7FF" label="💬 CHAT" onClick={() => setTab('chat')} />
      </div>

      <div style={{ flex: 'none', height: 150, margin: '0 16px 12px', background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 14px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'placar' && (
          <div className="corio-noscroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '7px 12px' }}>
            {sorted.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <div style={{ width: 14, fontSize: 9.5, fontWeight: 700, color: 'rgba(244,242,248,0.4)' }}>{i + 1}</div>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#050507', flex: 'none' }}>{p.initial}</div>
                <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600 }}>{p.id === youId ? `${p.name} (você)` : p.name}{!p.connected && ' 💤'}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{p.score.toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'chat' && (
          <>
            <div className="corio-noscroll" ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '7px 12px' }}>
              {chat.map((c) => (
                <div key={c.id} style={{ padding: '5px 0' }}>
                  {c.type === 'sys' ? (
                    <div style={{ fontSize: 10.5, color: c.color, fontWeight: 600 }}>{c.text}</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: c.color }}>{c.name}</div>
                      <div style={{ fontSize: 12 }}>{c.text}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div style={{ flex: 'none', display: 'flex', gap: 6, padding: '6px 12px 7px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                placeholder="Responda aqui..."
                style={{ flex: 1, background: '#1c1c26', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 10px', color: '#fff', fontSize: 11.5, outline: 'none', minWidth: 0 }}
              />
              <button onClick={send} style={{ all: 'unset', cursor: 'pointer', width: 28, height: 28, borderRadius: 9, background: '#8B5CF6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flex: 'none' }}>➤</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function TabButton({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: 7, borderRadius: '10px 10px 0 0', fontSize: 10, fontWeight: 700, letterSpacing: 0.3, background: active ? '#12121a' : 'transparent', color: active ? color : 'rgba(244,242,248,0.4)' }}
    >{label}</button>
  );
}
