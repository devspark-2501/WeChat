'use client';

import { useEffect, useState } from 'react';

export default function CometChatWrapper({ uid, children }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initCometChat() {
      try {
        const { CometChatUIKit, UIKitSettingsBuilder } = await import('@cometchat/chat-uikit-react');
        
        const appId = process.env.NEXT_PUBLIC_COMETCHAT_APP_ID;
        const region = process.env.NEXT_PUBLIC_COMETCHAT_REGION;
        const authKey = process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY;

        const uiKitSettings = new UIKitSettingsBuilder()
          .setAppId(appId)
          .setRegion(region)
          .setAuthKey(authKey)
          .subscribePresenceForAllUsers()
          .build();

        await CometChatUIKit.init(uiKitSettings);
        
        // Use CometChatUIKit.login directly to authenticate the UID session
        await CometChatUIKit.login(uid);

        if (isMounted) setInitialized(true);
      } catch (err) {
        console.error('CometChat Init Error:', err);
      }
    }

    if (uid) {
      initCometChat();
    }

    return () => { isMounted = false; };
  }, [uid]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white text-xs tracking-widest uppercase font-mono">
        INITIALIZING COMETCHAT ENGINE...
      </div>
    );
  }

  return <>{children}</>;
}