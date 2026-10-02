'use client';

export default function CallOverlay({ activeCall, onAccept, onReject, onEnd }) {
  if (!activeCall) return null;

  const { targetName, isIncoming, isVideo } = activeCall;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm sm:max-w-md bg-zinc-950 border border-zinc-800 p-6 font-mono text-center">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">
          {isVideo ? 'VIDEO CALL SESSION' : 'VOICE CALL SESSION'}
        </span>

        <h3 className="text-lg sm:text-xl font-bold text-white uppercase mb-1 truncate">{targetName}</h3>
        
        <p className="text-xs text-zinc-400 mb-6 sm:mb-8">
          {isIncoming ? 'INCOMING CALL REQUEST...' : 'CALLING TARGET USER...'}
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          {isIncoming ? (
            <>
              <button
                onClick={onAccept}
                className="w-full sm:w-auto bg-white text-black border border-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors"
              >
                ACCEPT
              </button>
              <button
                onClick={onReject}
                className="w-full sm:w-auto bg-black text-zinc-400 border border-zinc-800 px-6 py-2.5 text-xs font-bold uppercase tracking-wider hover:text-white hover:border-white transition-colors"
              >
                REJECT
              </button>
            </>
          ) : (
            <button
              onClick={onEnd}
              className="w-full sm:w-auto bg-black text-red-500 border border-red-900 px-8 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-red-950 transition-colors"
            >
              END CALL
            </button>
          )}
        </div>
      </div>
    </div>
  );
}