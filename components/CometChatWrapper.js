'use client';

import { useEffect, useState } from 'react';

export default function CometChatWrapper({ children, uid }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initCometChat() {
      try {
        const { CometChat } = await import('@cometchat/chat-sdk-javascript');

        const appID = process.env.NEXT_PUBLIC_COMETCHAT_APP_ID;
        const region = process.env.NEXT_PUBLIC_COMETCHAT_REGION;
        const authKey = process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY;

        const appSetting = new CometChat.AppSettingsBuilder()
          .subscribePresenceForAllUsers()
          .setRegion(region)
          .build();

        await CometChat.init(appID, appSetting);

        const user = await CometChat.getLoggedinUser();
        if (!user && uid) {
          await CometChat.login(uid, authKey);
        }

        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('CometChat Wrapper initialization error:', error);
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    }

    if (uid) {
      initCometChat();
    }

    return () => {
      isMounted = false;
    };
  }, [uid]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen bg-black text-white items-center justify-center font-mono text-xs uppercase tracking-widest">
        INITIALIZING SESSION...
      </div>
    );
  }

  return <>{children}</>;
}