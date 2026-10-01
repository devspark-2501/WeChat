'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import UserSearch from '@/components/UserSearch';

const CometChatWrapper = dynamic(() => import('@/components/CometChatWrapper'), { ssr: false });

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTargetUser, setActiveTargetUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sdk, setSdk] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('wechat_user');
    if (stored) {
      setCurrentUser(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    import('@cometchat/chat-sdk-javascript').then((mod) => {
      setSdk(mod);
    });
  }, []);

  useEffect(() => {
    if (!activeTargetUser || !sdk) return;

    const { CometChat } = sdk;

    async function fetchMessages() {
      try {
        const messagesRequest = new CometChat.MessagesRequestBuilder()
          .setUID(activeTargetUser.cometchatUID)
          .setLimit(50)
          .build();

        const history = await messagesRequest.fetchPrevious();
        setMessages(history || []);
      } catch (err) {
        console.error('Failed to fetch message history:', err);
        setMessages([]);
      }
    }

    fetchMessages();

    const listenerID = `LISTENER_${Date.now()}`;
    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: (textMessage) => {
          if (textMessage.getSender()?.getUid() === activeTargetUser.cometchatUID) {
            setMessages((prev) => [...prev, textMessage]);
          }
        }
      })
    );

    return () => {
      CometChat.removeMessageListener(listenerID);
    };
  }, [activeTargetUser, sdk]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!textInput.trim() || !activeTargetUser || !sdk) return;

    const { CometChat } = sdk;
    const text = textInput;
    setTextInput('');
    setSending(true);

    try {
      const receiverID = activeTargetUser.cometchatUID;
      const receiverType = CometChat.RECEIVER_TYPE.USER;
      const textMessage = new CometChat.TextMessage(receiverID, text, receiverType);

      const sentMsg = await CometChat.sendMessage(textMessage);
      setMessages((prev) => [...prev, sentMsg]);
    } catch (err) {
      console.error('Message sending failed:', err);
    } finally {
      setSending(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-4 font-mono">
        <p className="text-sm mb-4 uppercase">NO ACTIVE SESSION FOUND</p>
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
              <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">SELECTED TARGET</span>
              <p className="text-sm font-bold text-white mt-1">{activeTargetUser.name}</p>
              <p className="text-xs font-mono text-zinc-400">{activeTargetUser.cometchatUID}</p>
            </div>
          )}
        </div>

        {/* Main Direct Chat Workspace */}
        <div className="flex-1 flex flex-col bg-black">
          {activeTargetUser ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Header Bar */}
              <div className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between bg-zinc-950">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase">{activeTargetUser.name}</h2>
                  <p className="text-xs font-mono text-zinc-500">UID: {activeTargetUser.cometchatUID}</p>
                </div>
                <div className="flex space-x-2 font-mono">
                  <button
                    onClick={() => alert(`Starting Voice Call with ${activeTargetUser.name}...`)}
                    className="border border-zinc-700 px-3 py-1.5 text-xs text-white uppercase hover:border-white hover:bg-zinc-800 transition-colors"
                  >
                    📞 Voice Call
                  </button>
                  <button
                    onClick={() => alert(`Starting Video Call with ${activeTargetUser.name}...`)}
                    className="border border-white bg-white text-black px-3 py-1.5 text-xs uppercase font-bold hover:bg-zinc-200 transition-colors"
                  >
                    🎥 Video Call
                  </button>
                </div>
              </div>

              {/* Message Feed Area (Discord/IG Style) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-black">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-1">
                      NO MESSAGES YET
                    </p>
                    <p className="text-xs font-mono text-zinc-700">
                      Send a message below to start chatting with {activeTargetUser.name}
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.getSender()?.getUid() === currentUser.cometchatUID;
                    return (
                      <div
                        key={msg.getId() || idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2.5 text-xs font-sans border ${
                            isMe
                              ? 'bg-white text-black border-white'
                              : 'bg-zinc-900 text-white border-zinc-800'
                          }`}
                        >
                          {msg.getText()}
                        </div>
                        <span className="text-[9px] font-mono text-zinc-600 mt-1 uppercase">
                          {new Date((msg.getSentAt() || Date.now() / 1000) * 1000).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input & Send Controls */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-800 bg-zinc-950 flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`Message ${activeTargetUser.name}...`}
                  className="flex-1 bg-black border border-zinc-800 px-4 py-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-white transition-colors"
                />
                <button
                  type="submit"
                  disabled={sending || !textInput.trim()}
                  className="bg-white text-black font-mono font-bold text-xs uppercase px-6 py-2.5 hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {sending ? 'SENDING...' : 'SEND'}
                </button>
              </form>

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