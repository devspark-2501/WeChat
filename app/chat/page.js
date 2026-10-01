'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const CometChatWrapper = dynamic(() => import('@/components/CometChatWrapper'), { ssr: false });

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTargetUser, setActiveTargetUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sdk, setSdk] = useState(null);
  const messagesEndRef = useRef(null);

  // 1. Load user session
  useEffect(() => {
    const stored = localStorage.getItem('wechat_user');
    if (stored) {
      setCurrentUser(JSON.parse(stored));
    }
  }, []);

  // 2. Load SDK
  useEffect(() => {
    import('@cometchat/chat-sdk-javascript').then((mod) => {
      setSdk(mod);
    });
  }, []);

  // 3. Fetch Recent Conversations safely
  const fetchConversations = async () => {
    if (!sdk?.CometChat) return;
    try {
      setLoadingConversations(true);
      const conversationsRequest = new sdk.CometChat.ConversationsRequestBuilder()
        .setLimit(30)
        .build();

      const convList = await conversationsRequest.fetchNext();
      setConversations(convList || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (sdk && currentUser) {
      fetchConversations();
    }
  }, [sdk, currentUser]);

  // 4. Handle User Search when typing in search bar
  useEffect(() => {
    if (!searchQuery.trim() || !currentUser) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (res.ok) {
          setSearchResults((data.users || []).filter(u => u.cometchatUID !== currentUser.cometchatUID));
        }
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser]);

  // 5. Load Messages & Real-time Listener
  useEffect(() => {
    if (!activeTargetUser || !sdk?.CometChat) return;

    const { CometChat } = sdk;

    async function loadMessages() {
      try {
        const messagesRequest = new CometChat.MessagesRequestBuilder()
          .setUID(activeTargetUser.cometchatUID)
          .setLimit(50)
          .build();

        const history = await messagesRequest.fetchPrevious();
        setMessages(history || []);
      } catch (err) {
        console.error('Failed to load messages:', err);
        setMessages([]);
      }
    }

    loadMessages();

    const listenerID = `CHAT_LISTENER_${Date.now()}`;
    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: (textMessage) => {
          if (textMessage.getSender()?.getUid() === activeTargetUser.cometchatUID) {
            setMessages((prev) => [...prev, textMessage]);
          }
          fetchConversations();
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

  // 6. Send Message
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!textInput.trim() || !activeTargetUser || !sdk?.CometChat) return;

    const { CometChat } = sdk;
    const text = textInput;
    setTextInput('');
    setSending(true);

    try {
      const receiverID = activeTargetUser.cometchatUID;
      const textMessage = new CometChat.TextMessage(receiverID, text, CometChat.RECEIVER_TYPE.USER);

      const sentMsg = await CometChat.sendMessage(textMessage);
      setMessages((prev) => [...prev, sentMsg]);
      fetchConversations();
    } catch (err) {
      console.error('Message failed:', err);
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
        <div className="w-80 border-r border-zinc-800 flex flex-col justify-between bg-zinc-950">
          <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
            
            {/* User Header */}
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
                className="text-xs font-mono border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-white hover:border-white transition-colors"
              >
                LOGOUT
              </button>
            </div>

            {/* SINGLE Search Input */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user to chat..."
                className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Sidebar List (Recent Chats OR Search Results) */}
            <div className="flex-1 overflow-y-auto">
              {searchQuery.trim().length > 0 ? (
                // USER SEARCH MODE
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2 block">
                    SEARCH RESULTS
                  </span>
                  {searching ? (
                    <p className="text-xs font-mono text-zinc-600 p-2">Searching users...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs font-mono text-zinc-600 p-2">No users found.</p>
                  ) : (
                    searchResults.map((user) => (
                      <div
                        key={user._id || user.cometchatUID}
                        className="p-3 bg-black border border-zinc-900 hover:border-zinc-700 flex justify-between items-center transition-colors"
                      >
                        <div className="truncate mr-2">
                          <p className="text-xs font-bold text-white truncate">{user.name}</p>
                          <p className="text-[10px] font-mono text-zinc-500 truncate">{user.email}</p>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTargetUser(user);
                            setSearchQuery(''); // clear search to show conversation list
                          }}
                          className="bg-white text-black font-mono text-[10px] font-bold px-2 py-1 uppercase hover:bg-zinc-200"
                        >
                          SELECT
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // RECENT CHATS HISTORY MODE
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2 block">
                    RECENT CHATS
                  </span>

                  {loadingConversations ? (
                    <p className="text-xs font-mono text-zinc-600 p-2">Loading chats...</p>
                  ) : conversations.length === 0 ? (
                    <p className="text-xs font-mono text-zinc-600 p-2">
                      No recent chats yet. Type in the search box above to find users!
                    </p>
                  ) : (
                    conversations.map((conv) => {
                      const conversationWith = conv.getConversationWith();
                      const targetName = conversationWith?.getName() || 'User';
                      const targetUID = conversationWith?.getUid();
                      const lastMsg = conv.getLastMessage()?.getText() || 'Start chatting';
                      const isSelected = activeTargetUser?.cometchatUID === targetUID;

                      return (
                        <div
                          key={conv.getConversationId()}
                          onClick={() =>
                            setActiveTargetUser({
                              name: targetName,
                              cometchatUID: targetUID
                            })
                          }
                          className={`p-3 border transition-colors cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-zinc-900 border-zinc-600'
                              : 'bg-black border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/50'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-white truncate">{targetName}</span>
                            {conv.getLastMessage() && (
                              <span className="text-[9px] font-mono text-zinc-600">
                                {new Date(
                                  (conv.getLastMessage()?.getSentAt() || Date.now() / 1000) * 1000
                                ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 font-mono truncate">{lastMsg}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Active Selection Footer Card */}
          {activeTargetUser && (
            <div className="border-t border-zinc-800 p-3 bg-zinc-900">
              <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">SELECTED TARGET</span>
              <p className="text-sm font-bold text-white mt-0.5 truncate">{activeTargetUser.name}</p>
              <p className="text-xs font-mono text-zinc-500 truncate">{activeTargetUser.cometchatUID}</p>
            </div>
          )}
        </div>

        {/* Right Chat Panel */}
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
                    onClick={() => alert(`Voice Call with ${activeTargetUser.name}`)}
                    className="border border-zinc-700 px-3 py-1.5 text-xs text-white uppercase hover:border-white transition-colors"
                  >
                    📞 Voice Call
                  </button>
                  <button
                    onClick={() => alert(`Video Call with ${activeTargetUser.name}`)}
                    className="border border-white bg-white text-black px-3 py-1.5 text-xs uppercase font-bold hover:bg-zinc-200 transition-colors"
                  >
                    🎥 Video Call
                  </button>
                </div>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-black">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-1">
                      NO MESSAGES YET
                    </p>
                    <p className="text-xs font-mono text-zinc-700">
                      Send a message below to start chatting
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

              {/* Message Input */}
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
              SELECT A USER FROM RECENT CHATS OR SEARCH TO START CHATTING
            </div>
          )}
        </div>

      </div>
    </CometChatWrapper>
  );
}