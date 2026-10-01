'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Save user session to localStorage and navigate to /chat
      localStorage.setItem('wechat_user', JSON.stringify(data.user));
      router.push('/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-sans">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-8 shadow-2xl">
        
        {/* Brand Header with Text Only */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold font-mono tracking-widest text-white uppercase pb-2">
            WECHAT
          </h1>
          <h2 className="text-sm font-bold font-mono tracking-wider text-zinc-400 uppercase mt-3">
            {isLogin ? 'AUTHENTICATE' : 'CREATE ACCOUNT'}
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono mt-1">
            {isLogin ? 'ENTER YOUR CREDENTIALS TO CONTINUE' : 'FILL IN DETAILS TO JOIN'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-zinc-900 border border-red-800 text-red-400 text-xs font-mono">
            ERR: {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors font-mono"
                placeholder="Tanush"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors font-mono"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-black border border-zinc-800 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors pr-10 font-mono"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-zinc-500 hover:text-white transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-3 font-mono text-xs uppercase font-bold tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'PROCESSING...' : isLogin ? 'LOG IN' : 'REGISTER'}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-zinc-900 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-xs font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider"
          >
            {isLogin ? '[ NEED AN ACCOUNT? REGISTER ]' : '[ ALREADY REGISTERED? LOG IN ]'}
          </button>
        </div>

      </div>
    </div>
  );
}