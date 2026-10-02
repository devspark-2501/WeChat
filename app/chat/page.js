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
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallSession, setActiveCallSession] = useState(null);
  const messagesEndRef = useRef(null);

  // 1. Get logged-in user session
  useEffect(() => {
    const stored = localStorage.getItem('wechat_user');
    if (stored) {
      setCurrentUser(JSON.parse(stored));
    }
  }, []);

  // 2. Dynamic import CometChat SDK & Calls SDK
  useEffect(() => {
    Promise.all([
      import('@cometchat/chat-sdk-javascript'),
      import('@cometchat/calls-sdk-javascript').catch(() => null)
    ])
      .then(([chatMod, callsMod]) => {
        setSdk({
          CometChat: chatMod.CometChat,
          CometChatCalls: callsMod?.CometChatCalls
        });
      })
      .catch((err) => {
        console.error('SDK import failed:', err);
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
      console.error('Failed to fetch conversation history:', err);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (sdk && currentUser) {
      // Delay slightly to ensure CometChatWrapper finished SDK authentication
      const timer = setTimeout(() => {
        fetchConversations();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sdk, currentUser]);

  // 4. Setup Calling Listener
  useEffect(() => {
    if (!sdk?.CometChat) return;
    const { CometChat } = sdk;

    const listenerID = `CALL_LISTENER_${Date.now()}`;

    CometChat.addCallListener(
      listenerID,
      new CometChat.CallListener({
        onIncomingCallReceived: (call) => {
          console.log('Incoming call received:', call);
          setIncomingCall(call);
        },
        onOutgoingCallAccepted: (call) => {
          console.log('Outgoing call accepted:', call);
          startCallSession(call.getSessionId());
        },
        onOutgoingCallRejected: (call) => {
          alert('Call was rejected.');
          setIncomingCall(null);
          setActiveCallSession(null);
        },
        onCallEndedMessageReceived: (call) => {
          console.log('Call ended:', call);
          setIncomingCall(null);
          setActiveCallSession(null);
        }
      })
    );

    return () => {
      CometChat.removeCallListener(listenerID);
    };
  }, [sdk]);

  // Initiate Voice or Video Call
  const initiateCall = async (callType) => {
    if (!activeTargetUser || !sdk?.CometChat) return;

    const { CometChat } = sdk;
    const receiverID = activeTargetUser.cometchatUID;
    const receiverType = CometChat.RECEIVER_TYPE.USER;
    const type =
      callType === 'video'
        ? CometChat.CALL_TYPE.VIDEO
        : CometChat.CALL_TYPE.AUDIO;

    const call = new CometChat.Call(receiverID, type, receiverType);

    try {
      const outgoingCall = await CometChat.initiateCall(call);
      console.log('Call initiated:', outgoingCall);
      alert(`Calling ${activeTargetUser.name}... Waiting for response.`);
    } catch (error) {
      console.error('Call initiation failed:', error);
      alert('Failed to initiate call. Ensure media permissions are allowed.');
    }
  };

  // Accept Call
  const acceptCall = async () => {
    if (!incomingCall || !sdk?.CometChat) return;
    const { CometChat } = sdk;

    try {
      const acceptedCall = await CometChat.acceptCall(incomingCall.getSessionId());
      console.log('Call accepted:', acceptedCall);
      setIncomingCall(null);
      startCallSession(acceptedCall.getSessionId());
    } catch (error) {
      console.error('Call accept failed:', error);
    }
  };

  // Reject Call
  const rejectCall = async () => {
    if (!incomingCall || !sdk?.CometChat) return;
    const { CometChat } = sdk;

    try {
      await CometChat.rejectCall(
        incomingCall.getSessionId(),
        CometChat.CALL_STATUS.REJECTED
      );
      setIncomingCall(null);
    } catch (error) {
      console.error('Call reject failed:', error);
    }
  };

  // Start Call Media Session
  const startCallSession = (sessionId) => {
    setActiveCallSession(sessionId);
  };

  // 5. Search Users API Call
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
          setSearchResults(
            (data.users || []).filter((u) => u.cometchatUID !== currentUser.cometchatUID)
          );
        }
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser]);

  // 6. Fetch Message History & Listener for Active Chat
  useEffect(() => {
    if (!activeTargetUser || !sdk?.CometChat) return;

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

  // 7. Send Message Handler
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!textInput.trim() || !activeTargetUser || !sdk?.CometChat) return;

    const { CometChat } = sdk;
    const text = textInput;
    setTextInput('');
    setSending(true);

    try {
      const receiverID = activeTargetUser.cometchatUID;
      const textMessage = new CometChat.TextMessage(
        receiverID,
        text,
        CometChat.RECEIVER_TYPE.USER
      );

      const sentMsg = await CometChat.sendMessage(textMessage);
      setMessages((prev) => [...prev, sentMsg]);
      await fetchConversations();
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
        <a
          href="/"
          className="border border-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-white hover:text-black"
        >
          GO TO LOGIN
        </a>
      </div>
    );
  }

  return (
    <CometChatWrapper uid={currentUser.cometchatUID}>
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden relative">
        
        {/* INCOMING CALL MODAL POPUP */}
        {incomingCall && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 p-6 max-w-sm w-full text-center space-y-4 font-mono">
              <span className="text-xs text-zinc-400 uppercase tracking-widest block">INCOMING CALL</span>
              <h3 className="text-lg font-bold text-white">{incomingCall.sender?.name || 'Unknown User'}</h3>
              <p className="text-xs text-zinc-500 uppercase">{incomingCall.type} CALL</p>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={acceptCall}
                  className="bg-emerald-600 text-white font-bold text-xs uppercase px-5 py-2.5 hover:bg-emerald-500 transition-colors"
                >
                  ACCEPT
                </button>
                <button
                  onClick={rejectCall}
                  className="bg-rose-600 text-white font-bold text-xs uppercase px-5 py-2.5 hover:bg-rose-500 transition-colors"
                >
                  REJECT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Left Sidebar */}
        <div className="w-80 border-r border-zinc-800 flex flex-col justify-between bg-zinc-950">
          <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
            
            {/* Header / Logout */}
            <div className="border-b border-zinc-800 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold tracking-tight uppercase font-mono">
                  WECHAT
                </h1>
                <p className="text-xs text-zinc-500 font-mono">
                  USER: {currentUser.name}
                </p>
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

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user to chat..."
                className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Sidebar View */}
            <div className="flex-1 overflow-y-auto">
              {searchQuery.trim().length > 0 ? (
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
                            setSearchQuery('');
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
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2 block">
                    RECENT CHATS
                  </span>

                  {loadingConversations ? (
                    <p className="text-xs font-mono text-zinc-600 p-2">Loading chats...</p>
                  ) : conversations.length === 0 ? (
                    <p className="text-xs font-mono text-zinc-600 p-2">
                      No recent chats yet. Type in search above to find users!
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

          {activeTargetUser && (
            <div className="border-t border-zinc-800 p-3 bg-zinc-900">
              <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                SELECTED TARGET
              </span>
              <p className="text-sm font-bold text-white mt-0.5 truncate">{activeTargetUser.name}</p>
              <p className="text-xs font-mono text-zinc-500 truncate">{activeTargetUser.cometchatUID}</p>
            </div>
          )}
        </div>

        {/* Right Chat Panel */}
        <div className="flex-1 flex flex-col bg-black">
          {activeTargetUser ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Header */}
              <div className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between bg-zinc-950">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase">{activeTargetUser.name}</h2>
                  <p className="text-xs font-mono text-zinc-500">UID: {activeTargetUser.cometchatUID}</p>
                </div>
                <div className="flex space-x-2 font-mono">
                  <button
                    onClick={() => initiateCall('audio')}
                    className="border border-zinc-700 px-3 py-1.5 text-xs text-white uppercase hover:border-white transition-colors"
                  >
                    📞 Voice Call
                  </button>
                  <button
                    onClick={() => initiateCall('video')}
                    className="border border-white bg-white text-black px-3 py-1.5 text-xs uppercase font-bold hover:bg-zinc-200 transition-colors"
                  >
                    🎥 Video Call
                  </button>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-black">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-1">
                      NO MESSAGES YET
                    </p>
                    <p className="text-xs font-mono text-zinc-700">Send a message below to start chatting</p>
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

              {/* Input Form */}
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