'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import UserSearch from '@/components/UserSearch';

const CometChatWrapper = dynamic(() => import('@/components/CometChatWrapper'), { ssr: false });

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTargetUser, setActiveTargetUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('wechat_user');
    if (stored) {
      setCurrentUser(JSON.parse(stored));
    }
  }, []);

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-4 font-mono">
        <p className="text-sm mb-4">NO ACTIVE SESSION FOUND</p>
        <a href="/" className="border border-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-white hover:text-black">
          GO TO LOGIN
        </a>
      </div>
    );
  }

  return (
    <CometChatWrapper uid={currentUser.cometchatUID}>
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        
        {/* Left Sidebar: User Search & Active Profile */}
        <div className="w-80 border-r border-zinc-800 flex flex-col justify-between p-4 bg-zinc-950">
          <div>
            <div className="border-b border-zinc-800 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold tracking-tight uppercase font-mono">WECHAT</h1>
                <p className="text-xs text-zinc-500 font-mono">USER: {currentUser.name}</p>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('wechat_user');
                  window.location.href = '/';
                }}
                className="text-xs font-mono border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-white hover:border-white"
              >
                LOGOUT
              </button>
            </div>

            <UserSearch currentUID={currentUser.cometchatUID} onSelectUser={(user) => setActiveTargetUser(user)} />
          </div>

          {activeTargetUser && (
            <div className="border border-zinc-800 p-3 bg-zinc-900 mt-4">
              <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">SELECTED USER</span>
              <p className="text-sm font-bold text-white mt-1">{activeTargetUser.name}</p>
              <p className="text-xs font-mono text-zinc-400">{activeTargetUser.cometchatUID}</p>
            </div>
          )}
        </div>

        {/* Right Panel: Chat / Direct Communication Frame */}
        <div className="flex-1 flex flex-col bg-black">
          {activeTargetUser ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Header Bar with Direct Call Buttons */}
              <div className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between bg-zinc-950">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase">{activeTargetUser.name}</h2>
                  <p className="text-xs font-mono text-zinc-500">ID: {activeTargetUser.cometchatUID}</p>
                </div>
                <div className="flex space-x-2 font-mono">
                  <button
                    onClick={() => alert(`Starting Voice Call with ${activeTargetUser.name}...`)}
                    className="border border-zinc-700 px-3 py-1.5 text-xs text-white uppercase hover:border-white hover:bg-zinc-800"
                  >
                    📞 Voice Call
                  </button>
                  <button
                    onClick={() => alert(`Starting Video Call with ${activeTargetUser.name}...`)}
                    className="border border-white bg-white text-black px-3 py-1.5 text-xs uppercase font-bold hover:bg-zinc-200"
                  >
                    🎥 Video Call
                  </button>
                </div>
              </div>

              {/* Chat Container Placeholder for CometChat UI Frame */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-zinc-500 font-mono text-xs">
                <div className="border border-zinc-800 p-8 text-center bg-zinc-950 max-w-sm">
                  <p className="text-white text-sm font-bold mb-2">1-TO-1 CHAT READY</p>
                  <p className="mb-4 text-zinc-400">Connected via CometChat Web SDK to target UID: {activeTargetUser.cometchatUID}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-zinc-600 uppercase tracking-widest">
              SELECT A USER FROM THE SIDEBAR TO START CHATTING
            </div>
          )}
        </div>

      </div>
    </CometChatWrapper>
  );
}