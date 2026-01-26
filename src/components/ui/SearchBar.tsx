'use client';

import { useState, useRef, useEffect } from 'react';

interface SearchBarProps { value: string; onChange: (value: string) => void; placeholder?: string; className?: string; autoFocus?: boolean; }

export default function SearchBar({ value, onChange, placeholder = 'Search...', className = '', autoFocus = false }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus && inputRef.current) inputRef.current.focus(); }, [autoFocus]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute left-3 pointer-events-none">
        <svg className={`w-4 h-4 transition-colors ${isFocused ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input ref={inputRef} type="text" value={value} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 text-sm border rounded-lg transition-colors bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white" />
      {value && <button type="button" onClick={() => { onChange(''); inputRef.current?.focus(); }}
        className="absolute right-3 p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>}
    </div>
  );
}
