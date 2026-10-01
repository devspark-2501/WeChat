import './globals.css';

export const metadata = {
  title: 'WECHAT | 1-to-1 Realtime Chat & Calling',
  description: 'Built for CometChat Zero to Chat Hackathon',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}