import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameState, LeaderboardEntry } from './types';
import { fetchLeaderboard, submitScore } from './services/supabaseClient';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(100);
  const [level, setLevel] = useState(1);
  const [flavorText, setFlavorText] = useState("System online. Waiting for pilot input.");
  const [highScore, setHighScore] = useState(0);
  const [isMuted, setIsMuted] = useState(audioService.getMuteState());

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pilotName, setPilotName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    const data = await fetchLeaderboard();
    setLeaderboard(data);
  };

  const handleStartGame = () => {
    setGameState(GameState.PLAYING);
    setSubmissionSuccess(false);
    setPilotName("");
    // Resume audio context if suspended (needed for browsers)
    if ((window as any).AudioContext || (window as any).webkitAudioContext) {
      audioService.playShoot(); // Silent trigger to init
    }
  };

  const handleReturnToMenu = () => {
    setGameState(GameState.MENU);
  };

  const handleGameOver = (finalScore: number) => {
    setGameState(GameState.GAME_OVER);
    if (finalScore > highScore) setHighScore(finalScore);
  };

  const handleSubmitScore = async () => {
    if (!pilotName.trim()) return;
    setIsSubmitting(true);
    const success = await submitScore(pilotName.toUpperCase(), score, level);
    if (success) {
      setSubmissionSuccess(true);
      await loadLeaderboard();
    }
    setIsSubmitting(false);
  };

  const toggleMute = () => {
    const newState = audioService.toggleMute();
    setIsMuted(newState);
  };

  const isPlaying = gameState === GameState.PLAYING;

  return (
    <div className={`min-h-screen bg-slate-950 flex flex-col items-center justify-center p-0 sm:p-4 select-none ${isPlaying ? 'overflow-hidden touch-none h-screen' : 'overflow-y-auto min-h-screen touch-auto'}`}>
      
      {/* Header / HUD */}
      <div className="w-full max-w-[800px] flex justify-between items-end mb-2 sm:mb-4 font-mono px-4 sm:px-0 pt-2 sm:pt-0 shrink-0">
        <div className="flex-1">
          <h1 className="text-xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 truncate">
             *STARFIGHTER*
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 h-6 truncate max-w-[200px] sm:max-w-none">{flavorText}</p>
        </div>
        
        <div className="flex items-center gap-4 text-right">
           <button 
             onClick={toggleMute} 
             className="text-slate-500 hover:text-cyan-400 transition-colors p-2"
             title={isMuted ? "Unmute" : "Mute"}
           >
             {isMuted ? (
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9l-5 5H2v-4h2l5-5v2"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
             ) : (
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
             )}
           </button>
           <div>
             <div className="text-[10px] sm:text-sm text-slate-500 uppercase tracking-widest">Score</div>
             <div className="text-xl sm:text-2xl text-white font-bold tracking-widest">{score.toString().padStart(6, '0')}</div>
           </div>
        </div>
      </div>

      {/* Main Game Container */}
      <div className="relative group w-full max-w-[800px] shrink-0 aspect-[4/3] sm:aspect-auto">
        <GameCanvas 
          gameState={gameState}
          setGameState={setGameState}
          setScore={setScore}
          setLives={setLives}
          setLevel={setLevel}
          setFlavorText={setFlavorText}
          onGameOver={handleGameOver}
        />

        {/* Start Menu Overlay */}
        {gameState === GameState.MENU && (
          <div className="absolute inset-0 bg-black/90 flex flex-col sm:flex-row items-stretch justify-center z-20 backdrop-blur-sm overflow-y-auto sm:overflow-hidden no-scrollbar">
            {/* Main Action Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 border-b sm:border-b-0 sm:border-r border-slate-800 min-h-[300px] sm:min-h-0">
                <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 sm:mb-8 tracking-tighter text-center uppercase">Ready Pilot One</h2>
                <button 
                  onClick={handleStartGame}
                  className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-none border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all transform hover:scale-105 active:scale-95 text-xl"
                >
                  INITIATE LAUNCH
                </button>
                <div className="text-slate-500 mt-6 sm:mt-8 font-mono text-sm text-center">
                  <p className="hidden sm:block">WASD to Move • MOUSE to Aim • CLICK/SPACE to Fire</p>
                  <div className="sm:hidden">
                    <p className="text-cyan-400 animate-pulse uppercase font-bold text-xs mb-1">Dual Thumbstick Interface</p>
                    <p className="text-[10px]">Left: Navigation | Right: Tactical Targeting</p>
                  </div>
                </div>
            </div>
            
            {/* Leaderboard Area - Now visible on mobile */}
            <div className="w-full sm:w-64 bg-slate-900/50 p-4 sm:p-6 flex flex-col border-t sm:border-t-0 sm:border-l border-slate-800 max-h-[250px] sm:max-h-none overflow-hidden">
                <h3 className="text-cyan-400 font-bold mb-3 sm:mb-4 tracking-widest text-center border-b border-cyan-900 pb-2 uppercase text-xs sm:text-sm">Top Aces</h3>
                <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-1">
                    {leaderboard.length === 0 ? (
                        <p className="text-[10px] text-slate-600 text-center mt-4 uppercase">No combat data available</p>
                    ) : (
                        leaderboard.map((entry, idx) => (
                            <div key={entry.id} className="flex justify-between items-center text-[10px] sm:text-xs font-mono group">
                                <span className={`mr-2 truncate ${idx < 3 ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>
                                    {idx + 1}. {entry.username}
                                </span>
                                <span className="text-white group-hover:text-cyan-400 transition-colors">{entry.score.toLocaleString()}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center text-center z-20 backdrop-blur-sm p-8">
            <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-2 uppercase tracking-tighter">Mission Failed</h2>
            <p className="text-xl text-white mb-6 uppercase font-mono tracking-wide">Final Score: {score}</p>
            
            {!submissionSuccess ? (
                <div className="bg-black/50 p-6 border border-red-900 mb-8 w-full max-w-sm">
                    <p className="text-red-400 text-xs mb-3 font-mono uppercase">Enter Pilot Identification</p>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            maxLength={8}
                            value={pilotName}
                            onChange={(e) => setPilotName(e.target.value.toUpperCase())}
                            placeholder="NAME"
                            className="bg-red-950/50 border border-red-800 text-white px-4 py-2 w-full font-mono focus:outline-none focus:border-red-500 uppercase"
                        />
                        <button 
                            onClick={handleSubmitScore}
                            disabled={isSubmitting || !pilotName}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed uppercase transition-colors"
                        >
                            {isSubmitting ? '...' : 'SAVE'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mb-8 text-green-400 font-mono border border-green-900 bg-green-950/30 px-6 py-4 uppercase">
                    Flight Data Uploaded
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleStartGame}
                className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold border-2 border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.3)] transition-all transform hover:scale-105 active:scale-95 uppercase"
              >
                Restart Mission
              </button>
              <button 
                onClick={handleReturnToMenu}
                className="px-8 py-4 bg-transparent hover:bg-slate-800 text-white font-bold border-2 border-slate-600 transition-all transform hover:scale-105 active:scale-95 uppercase"
              >
                Exit to Menu
              </button>
            </div>
          </div>
        )}
        
         {/* Pause Overlay */}
         {gameState === GameState.PAUSED && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-center z-20 backdrop-blur-sm">
            <h2 className="text-4xl font-bold text-yellow-400 mb-8 tracking-widest uppercase">System Paused</h2>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => setGameState(GameState.PLAYING)}
                className="px-12 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold border-2 border-yellow-400 transition-all uppercase w-64 shadow-lg shadow-yellow-900/20"
              >
                Resume
              </button>
              <button 
                onClick={handleStartGame}
                className="px-12 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold border-2 border-slate-600 transition-all uppercase w-64"
              >
                Restart
              </button>
              <button 
                onClick={handleReturnToMenu}
                className="px-12 py-3 bg-transparent hover:bg-slate-900 text-slate-400 font-bold border-2 border-slate-700 transition-all uppercase w-64"
              >
                Main Menu
              </button>
            </div>
          </div>
        )}

        {/* HUD Overlay inside relative container */}
        {gameState === GameState.PLAYING && (
           <>
            {/* Health Bar */}
            <div className="absolute bottom-4 left-4 z-10 w-32 sm:w-48 pointer-events-none">
              <div className="text-[10px] text-cyan-400 mb-1 font-mono uppercase tracking-widest">Hull Integrity</div>
              <div className="h-4 bg-slate-800 border border-slate-600 w-full relative overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${lives < 30 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-red-600 via-orange-500 to-green-500'}`} 
                  style={{ width: `${Math.max(0, Math.min(100, lives))}%` }}
                ></div>
              </div>
            </div>
            
            {/* Level Indicator */}
            <div className="absolute bottom-4 right-4 z-10 text-right pointer-events-none">
              <div className="text-[10px] text-cyan-400 mb-1 font-mono uppercase tracking-widest">Threat Level</div>
              <div className="text-2xl font-bold text-white font-mono">{level}</div>
            </div>
           </>
        )}
      </div>

      <div className="mt-4 sm:mt-8 text-slate-600 text-[10px] sm:text-xs text-center font-mono max-w-lg px-4 shrink-0 uppercase tracking-widest">
        <p>Powered by Google Gemini AI</p>
        <p>Procedural Tactical Analysis: Sector {level}</p>
      </div>
    </div>
  );
};

export default App;
