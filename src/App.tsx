import React from 'react';
import { GameCanvas } from './game/GameCanvas';

export default function App() {
  return (
    <main className="w-screen h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
      <GameCanvas />
    </main>
  );
}
