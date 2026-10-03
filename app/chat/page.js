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
  const [isMounted, setIsMounted] = useState(false);

  const messagesEndRef = useRef(null);
  const callContainerRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem('wechat_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('LocalStorage read error:', e);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    let isSubscribed = true;

    async function loadSDKs() {
      try {
        const chatMod = await import('@cometchat/chat-sdk-javascript');
        const callsMod = await import('@cometchat/calls-sdk-javascript');

        if (isSubscribed) {
          setSdk({
            CometChat: chatMod.CometChat || chatMod.default,
            CometChatCalls: callsMod.CometChatCalls || callsMod.default,
            CallTokenSettingsBuilder: callsMod.CallTokenSettingsBuilder,
            CallSettingsBuilder: callsMod.CallSettingsBuilder,
          });
        }
      } catch (err) {
        console.error('Failed to load SDKs:', err);
      }
    }

    loadSDKs();

    return () => {
      isSubscribed = false;
    };
  }, [isMounted]);

  const fetchConversations = async () => {
    if (!sdk?.CometChat) return;
    const { CometChat } = sdk;

    try {
      setLoadingConversations(true);

      const loggedInUser = await CometChat.getLoggedinUser();
      if (!loggedInUser) {
        setLoadingConversations(false);
        return;
      }

      const conversationsRequest = new CometChat.ConversationsRequestBuilder()
        .setLimit(30)
        .build();

      const convList = await conversationsRequest.fetchNext();
      setConversations(convList || []);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (sdk && currentUser) {
      const timer = setTimeout(() => {
        fetchConversations();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [sdk, currentUser]);

  useEffect(() => {
    if (!sdk?.CometChat) return;
    const { CometChat } = sdk;
    const listenerID = `CALL_LISTENER_${Date.now()}`;

    try {
      CometChat.addCallListener(
        listenerID,
        new CometChat.CallListener({
          onIncomingCallReceived: (call) => setIncomingCall(call),
          onOutgoingCallAccepted: (call) => startCallSession(call.getSessionId()),
          onOutgoingCallRejected: () => {
            alert('Call rejected');
            setIncomingCall(null);
            setActiveCallSession(null);
            fetchMessages();
          },
          onCallEndedMessageReceived: () => {
            endCallCleanup();
            fetchMessages();
          }
        })
      );
    } catch (e) {
      console.error('Call listener error:', e);
    }

    return () => {
      try {
        CometChat.removeCallListener(listenerID);
      } catch (e) {}
    };
  }, [sdk, activeTargetUser]);

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      console.error('Media permission error:', err);
      alert('Camera and Microphone permissions are required.');
      return false;
    }
  };

  const startCallSession = async (sessionId) => {
    const hasPermissions = await requestMediaPermissions();
    if (!hasPermissions) return;

    setActiveCallSession(sessionId);

    if (!sdk?.CometChatCalls || !sdk?.CallTokenSettingsBuilder) {
      console.error('CometChat Calls SDK not initialized');
      return;
    }

    setTimeout(async () => {
      const container = callContainerRef.current || document.getElementById('call-container');
      if (!container) return;

      try {
        const callTokenSetting = new sdk.CallTokenSettingsBuilder()
          .setSessionId(sessionId)
          .build();

        const res = await sdk.CometChatCalls.generateToken(callTokenSetting);

        const callCallSettings = new sdk.CallSettingsBuilder()
          .enableDefaultLayout(true)
          .setContainer(container)
          .setIsAudioOnly(false)
          .startWithVideoMuted(false)
          .startWithAudioMuted(false)
          .build();

        await sdk.CometChatCalls.startCall(res.token, callCallSettings);

        // Allow permissions on dynamically added iframe elements
        const iframes = container.getElementsByTagName('iframe');
        for (let i = 0; i < iframes.length; i++) {
          iframes[i].setAttribute('allow', 'camera; microphone; display-capture; autoplay');
        }

        // Force browser re-render for WebRTC video feed dimensions
        window.dispatchEvent(new Event('resize'));
      } catch (err) {
        console.error('Error starting call session:', err);
      }
    }, 400);
  };

  const endCallCleanup = () => {
    setActiveCallSession(null);
    setIncomingCall(null);
  };

  const endCallSession = async () => {
    if (activeCallSession && sdk?.CometChat) {
      try {
        await sdk.CometChat.endCall(activeCallSession);
      } catch (err) {
        console.error('Error ending call:', err);
      }
    }
    endCallCleanup();
    fetchMessages();
  };

  const initiateCall = async (callType) => {
    if (!activeTargetUser || !sdk?.CometChat) return;

    const { CometChat } = sdk;
    const receiverID = activeTargetUser.cometchatUID;
    const receiverType = CometChat.RECEIVER_TYPE.USER;
    const type = callType === 'video' ? CometChat.CALL_TYPE.VIDEO : CometChat.CALL_TYPE.AUDIO;

    try {
      const call = new CometChat.Call(receiverID, type, receiverType);
      await CometChat.initiateCall(call);
      alert(`Calling ${activeTargetUser.name}...`);
      fetchMessages();
    } catch (error) {
      console.error('Call initiation failed:', error);
      alert('Could not start call.');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !sdk?.CometChat) return;
    try {
      const acceptedCall = await sdk.CometChat.acceptCall(incomingCall.getSessionId());
      setIncomingCall(null);
      startCallSession(acceptedCall.getSessionId());
    } catch (error) {
      console.error('Call accept failed:', error);
    }
  };

  const rejectCall = async () => {
    if (!incomingCall || !sdk?.CometChat) return;
    try {
      await sdk.CometChat.rejectCall(
        incomingCall.getSessionId(),
        sdk.CometChat.CALL_STATUS.REJECTED
      );
      setIncomingCall(null);
      fetchMessages();
    } catch (error) {
      console.error('Call reject failed:', error);
    }
  };

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

  const fetchMessages = async () => {
    if (!activeTargetUser || !sdk?.CometChat) return;

    try {
      const messagesRequest = new sdk.CometChat.MessagesRequestBuilder()
        .setUID(activeTargetUser.cometchatUID)
        .setLimit(50)
        .build();

      const history = await messagesRequest.fetchPrevious();
      setMessages(history || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!activeTargetUser || !sdk?.CometChat) return;
    const { CometChat } = sdk;

    fetchMessages();

    const listenerID = `CHAT_LISTENER_${Date.now()}`;
    try {
      CometChat.addMessageListener(
        listenerID,
        new CometChat.MessageListener({
          onTextMessageReceived: (textMessage) => {
            if (textMessage.getSender()?.getUid() === activeTargetUser.cometchatUID) {
              setMessages((prev) => [...prev, textMessage]);
            }
            fetchConversations();
          },
          onMediaMessageReceived: (mediaMessage) => {
            if (mediaMessage.getSender()?.getUid() === activeTargetUser.cometchatUID) {
              setMessages((prev) => [...prev, mediaMessage]);
            }
          }
        })
      );
    } catch (e) {
      console.error('Message listener error:', e);
    }

    return () => {
      try {
        CometChat.removeMessageListener(listenerID);
      } catch (e) {}
    };
  }, [activeTargetUser, sdk]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!textInput.trim() || !activeTargetUser || !sdk?.CometChat) return;

    const { CometChat } = sdk;
    const text = textInput;
    setTextInput('');
    setSending(true);

    try {
      const textMessage = new CometChat.TextMessage(
        activeTargetUser.cometchatUID,
        text,
        CometChat.RECEIVER_TYPE.USER
      );

      const sentMsg = await CometChat.sendMessage(textMessage);
      setMessages((prev) => [...prev, sentMsg]);
      fetchConversations();
    } catch (err) {
      console.error('Message sending failed:', err);
    } finally {
      setSending(false);
    }
  }

  if (!isMounted) {
    return <div className="min-h-screen bg-black text-white p-4 font-mono text-xs">Loading application...</div>;
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-mono">
        <p className="text-sm mb-4 uppercase">NO ACTIVE SESSION FOUND</p>
        <a
          href="/"
          className="border border-white px-4 py-2 text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
        >
          GO TO LOGIN
        </a>
      </div>
    );
  }

  return (
    <CometChatWrapper uid={currentUser.cometchatUID}>
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden relative">
        
        {/* ACTIVE CALL CONTAINER */}
        {activeCallSession && (
          <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-between p-4 md:p-6">
            <div
              id="call-container"
              ref={callContainerRef}
              className="w-full max-w-5xl bg-zinc-900 rounded-lg overflow-hidden relative border border-zinc-800"
              style={{ height: 'calc(100vh - 100px)', minHeight: '400px' }}
            />
            <button
              onClick={endCallSession}
              className="mt-4 bg-rose-600 text-white font-mono font-bold text-xs uppercase px-8 py-3 hover:bg-rose-500 transition-colors z-50"
            >
              END CALL
            </button>
          </div>
        )}

        {/* INCOMING CALL MODAL */}
        {incomingCall && !activeCallSession && (
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
        <div
          className={`${
            activeTargetUser ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 border-r border-zinc-800 flex-col justify-between bg-zinc-950 h-full`}
        >
          <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
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

            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user to chat..."
                className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

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
        </div>

        {/* Right Chat Panel */}
        <div className={`${activeTargetUser ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-black h-full w-full`}>
          {activeTargetUser ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="h-14 border-b border-zinc-800 px-4 md:px-6 flex items-center justify-between bg-zinc-950">
                <div className="flex items-center space-x-3 truncate">
                  <button
                    onClick={() => setActiveTargetUser(null)}
                    className="md:hidden border border-zinc-700 px-2.5 py-1 text-xs font-mono text-zinc-300 hover:border-white"
                  >
                    ← BACK
                  </button>
                  <div className="truncate">
                    <h2 className="text-xs md:text-sm font-bold text-white uppercase truncate">
                      {activeTargetUser.name}
                    </h2>
                    <p className="text-[10px] md:text-xs font-mono text-zinc-500 truncate">
                      UID: {activeTargetUser.cometchatUID}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-1.5 md:space-x-2 font-mono flex-shrink-0">
                  <button
                    onClick={() => initiateCall('audio')}
                    className="border border-zinc-700 px-2 md:px-3 py-1.5 text-[10px] md:text-xs text-white uppercase hover:border-white transition-colors"
                  >
                    📞 <span className="hidden sm:inline">Voice Call</span>
                  </button>
                  <button
                    onClick={() => initiateCall('video')}
                    className="border border-white bg-white text-black px-2 md:px-3 py-1.5 text-[10px] md:text-xs uppercase font-bold hover:bg-zinc-200 transition-colors"
                  >
                    🎥 <span className="hidden sm:inline">Video Call</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-black">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-1">
                      NO MESSAGES YET
                    </p>
                    <p className="text-xs font-mono text-zinc-700">Send a message below to start chatting</p>
                  </div>
                ) : (
                  messages.map((item, idx) => {
                    const isCall = item.getCategory?.() === 'call' || item instanceof sdk?.CometChat?.Call;

                    if (isCall) {
                      const callStatus = item.getStatus ? item.getStatus() : item.action;
                      const callType = item.getType ? item.getType() : 'call';
                      const isMe = item.getSender()?.getUid() === currentUser.cometchatUID;

                      let statusText = 'Call Logged';
                      let icon = '📞';

                      if (callStatus === 'initiated') {
                        statusText = isMe ? `Outgoing ${callType} call` : `Incoming ${callType} call`;
                      } else if (callStatus === 'rejected' || callStatus === 'cancelled') {
                        statusText = `Missed ${callType} call`;
                        icon = '🚫';
                      } else if (callStatus === 'ended') {
                        statusText = `${callType.toUpperCase()} call ended`;
                        icon = '⏱️';
                      }

                      return (
                        <div key={item.getId() || idx} className="flex justify-center my-2">
                          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 font-mono text-[11px] text-zinc-400 flex items-center space-x-2 rounded-sm">
                            <span>{icon}</span>
                            <span className="uppercase text-white font-semibold">{statusText}</span>
                            <span className="text-[9px] text-zinc-600 uppercase">
                              {new Date((item.getSentAt() || Date.now() / 1000) * 1000).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const isMe = item.getSender()?.getUid() === currentUser.cometchatUID;
                    return (
                      <div
                        key={item.getId() || idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-md px-3.5 py-2 md:px-4 md:py-2.5 text-xs font-sans border ${
                            isMe
                              ? 'bg-white text-black border-white'
                              : 'bg-zinc-900 text-white border-zinc-800'
                          }`}
                        >
                          {item.getText ? item.getText() : ''}
                        </div>
                        <span className="text-[9px] font-mono text-zinc-600 mt-1 uppercase">
                          {new Date((item.getSentAt() || Date.now() / 1000) * 1000).toLocaleTimeString([], {
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

              <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-zinc-800 bg-zinc-950 flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`Message ${activeTargetUser.name}...`}
                  className="flex-1 bg-black border border-zinc-800 px-3 md:px-4 py-2 md:py-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-white transition-colors"
                />
                <button
                  type="submit"
                  disabled={sending || !textInput.trim()}
                  className="bg-white text-black font-mono font-bold text-xs uppercase px-4 md:px-6 py-2 md:py-2.5 hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {sending ? '...' : 'SEND'}
                </button>
              </form>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-zinc-600 uppercase tracking-widest p-4 text-center">
              SELECT A USER FROM RECENT CHATS OR SEARCH TO START CHATTING
            </div>
          )}
        </div>

      </div>
    </CometChatWrapper>
  );
}