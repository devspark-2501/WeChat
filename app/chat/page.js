'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import UserSearch from '@/components/UserSearch';

const CometChatWrapper = dynamic(() => import('@/components/CometChatWrapper'), { ssr: false });

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTargetUser, setActiveTargetUser] = useState(null);
  const [cometchatTargetUser, setCometchatTargetUser] = useState(null);
  const [CometChatModules, setCometChatModules] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('wechat_user');
    if (stored) {
      setCurrentUser(JSON.parse(stored));
    }

    // Dynamically load CometChat UI components client-side
    import('@cometchat/chat-uikit-react').then((modules) => {
      setCometChatModules(modules);
    });
  }, []);

  // When a user is selected from search, fetch their CometChat User Object
  useEffect(() => {
    async function loadCometChatUser() {
      if (!activeTargetUser || !CometChatModules) return;
      setLoadingChat(true);
      try {
        const { CometChat } = await import('@cometchat/chat-sdk-javascript');
        const user = await CometChat.getUser(activeTargetUser.cometchatUID);
        setCometchatTargetUser(user);
      } catch (err) {
        console.error("Failed to fetch CometChat User:", err);
      } finally {
        setLoadingChat(false);
      }
    }
    loadCometChatUser();
  }, [activeTargetUser, CometChatModules]);

  function startCall(callType) {
    if (!cometchatTargetUser) return;
    alert(`Initiating ${callType === 'video' ? 'Video' : 'Voice'} Call to ${cometchatTargetUser.getName()}...`);
    // Calling SDK integration connects here
  }

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
        
        {/* Left Sidebar */}
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

        {/* Right Main Chat Panel */}
        <div className="flex-1 flex flex-col bg-black">
          {activeTargetUser ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header Bar */}
              <div className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between bg-zinc-950">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase">{activeTargetUser.name}</h2>
                  <p className="text-xs font-mono text-zinc-500">ID: {activeTargetUser.cometchatUID}</p>
                </div>
                <div className="flex space-x-2 font-mono">
                  <button
                    onClick={() => startCall('audio')}
                    className="border border-zinc-700 px-3 py-1.5 text-xs text-white uppercase hover:border-white hover:bg-zinc-800"
                  >
                    📞 Voice Call
                  </button>
                  <button
                    onClick={() => startCall('video')}
                    className="border border-white bg-white text-black px-3 py-1.5 text-xs uppercase font-bold hover:bg-zinc-200"
                  >
                    🎥 Video Call
                  </button>
                </div>
              </div>

              {/* Chat Interface */}
              <div className="flex-1 overflow-hidden bg-black">
                {loadingChat ? (
                  <div className="flex h-full items-center justify-center font-mono text-xs text-zinc-500">
                    LOADING CHAT SESSION...
                  </div>
                ) : cometchatTargetUser && CometChatModules?.CometChatMessages ? (
                  <CometChatModules.CometChatMessages user={cometchatTargetUser} />
                ) : (
                  <div className="flex h-full items-center justify-center font-mono text-xs text-zinc-500">
                    INITIALIZING CHAT UI...
                  </div>
                )}
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