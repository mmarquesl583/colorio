import { useState } from 'react';
import { useRoomConnection } from './ws.ts';
import AppShell from './components/AppShell.tsx';
import HomeScreen from './screens/HomeScreen.tsx';
import LobbyScreen from './screens/LobbyScreen.tsx';
import WaitingScreen from './screens/WaitingScreen.tsx';
import GameScreen from './screens/GameScreen.tsx';
import type { RoomConfig } from '@shared/types';

type Route = 'home' | 'create-lobby';

export default function App() {
  const conn = useRoomConnection();
  const [route, setRoute] = useState<Route>('home');
  const [pendingName, setPendingName] = useState('');

  const content = (() => {
    if (conn.state) {
      if (conn.state.screen === 'waiting') {
        return <WaitingScreen conn={conn} />;
      }
      return <GameScreen conn={conn} />;
    }
    if (route === 'create-lobby') {
      return (
        <LobbyScreen
          connecting={conn.connecting}
          error={conn.error}
          onBack={() => setRoute('home')}
          onCreate={(config: RoomConfig) => conn.createRoom(pendingName, config)}
        />
      );
    }
    return (
      <HomeScreen
        connecting={conn.connecting}
        error={conn.error}
        onClearError={conn.clearError}
        onStartCreate={(name) => { setPendingName(name); setRoute('create-lobby'); }}
        onJoin={(name, code) => conn.joinRoom(code, name)}
      />
    );
  })();

  return (
    <AppShell>{content}</AppShell>
  );
}
