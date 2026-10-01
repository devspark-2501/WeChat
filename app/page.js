'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
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

      // Save user session to localStorage
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
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold font-mono tracking-widest uppercase">WECHAT</h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            {isLogin ? 'AUTHENTICATE TO CONTINUE' : 'CREATE YOUR ACCOUNT'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-zinc-900 border border-red-800 text-red-400 text-xs font-mono">
            ERR: {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-mono text-zinc-400 uppercase mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
                placeholder="Tanush"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-zinc-400 uppercase mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 uppercase mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-2.5 font-mono text-xs uppercase font-bold tracking-wider hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'PROCESSING...' : isLogin ? 'LOG IN' : 'REGISTER'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-900 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-xs font-mono text-zinc-400 hover:text-white underline uppercase"
          >
            {isLogin ? 'Need an account? Register' : 'Already registered? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}