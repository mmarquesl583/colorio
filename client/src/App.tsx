import { useState } from 'react';
import { useRoomConnection } from './ws.ts';
import AppShell from './components/AppShell.tsx';
import HomeScreen from './screens/HomeScreen.tsx';
import LobbyScreen from './screens/LobbyScreen.tsx';
import FindRoomScreen from './screens/FindRoomScreen.tsx';
import WaitingScreen from './screens/WaitingScreen.tsx';
import GameScreen from './screens/GameScreen.tsx';
import MatchEndScreen from './screens/MatchEndScreen.tsx';
import type { RoomConfig } from '@shared/types';

type Route = 'home' | 'create-lobby' | 'find-room';

export default function App() {
  const conn = useRoomConnection();
  const [route, setRoute] = useState<Route>('home');
  const [pendingName, setPendingName] = useState('');

  const content = (() => {
    if (conn.state) {
      if (conn.state.screen === 'waiting') {
        return <WaitingScreen conn={conn} />;
      }
      if (conn.state.screen === 'finished') {
        return <MatchEndScreen conn={conn} />;
      }
      return <GameScreen conn={conn} />;
    }
    if (route === 'create-lobby') {
      return (
        <LobbyScreen
          playerName={pendingName}
          connecting={conn.connecting}
          error={conn.error}
          onBack={() => setRoute('home')}
          onCreate={(config: RoomConfig) => conn.createRoom(pendingName, config)}
        />
      );
    }
    if (route === 'find-room') {
      return (
        <FindRoomScreen
          playerName={pendingName}
          connecting={conn.connecting}
          error={conn.error}
          onBack={() => { conn.clearError(); setRoute('home'); }}
          onJoin={(name, code) => conn.joinRoom(code, name)}
        />
      );
    }
    return (
      <HomeScreen
        connecting={conn.connecting}
        error={conn.error}
        onClearError={conn.clearError}
        onStartCreate={(name) => { setPendingName(name); setRoute('create-lobby'); }}
        onFindRooms={(name) => { setPendingName(name); setRoute('find-room'); }}
      />
    );
  })();

  return (
    <AppShell>{content}</AppShell>
  );
}
