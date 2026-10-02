'use client';

import { useState } from 'react';

export default function UserSearch({ currentUID, onSelectUser }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    const value = e.target.value;
    setQuery(value);

    if (value.trim().length === 0) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users?query=${encodeURIComponent(value)}&currentUID=${currentUID}`);
      const data = await res.json();
      setResults(data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 p-3 sm:p-4">
      <div className="text-[11px] uppercase font-mono tracking-wider text-zinc-400 mb-2">Find User</div>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="Type name to search..."
        className="w-full bg-black border border-zinc-700 px-3 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors font-mono"
      />

      {loading && <div className="text-xs text-zinc-500 mt-2 font-mono">Searching...</div>}

      <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
        {results.map((user) => (
          <div
            key={user.cometchatUID || user._id}
            onClick={() => onSelectUser(user)}
            className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-800 hover:border-white hover:bg-zinc-800 cursor-pointer transition-all"
          >
            <div className="truncate mr-2">
              <p className="text-xs sm:text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] sm:text-xs font-mono text-zinc-400 truncate">{user.email}</p>
            </div>
            <button className="text-[10px] sm:text-xs font-mono bg-white text-black px-2 py-1 uppercase tracking-wider font-semibold hover:bg-zinc-200 transition-colors">
              Select
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}