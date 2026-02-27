'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';

const PLACEHOLDERS = ['a niche site', 'a SaaS tool', 'an agency', 'a client project'];

interface InteractiveDemoBlockProps {
  variant?: 'hero' | 'section';
  label?: string;
  subtext?: string;
  buttonText?: string;
  showChips?: boolean;
}

export default function InteractiveDemoBlock({
  variant = 'section',
  label = "What are you trying to build?",
  subtext = "We'll spin up a live demo workspace based on your idea and guide you from scratch.",
  buttonText = 'Generate Demo Workspace →',
  showChips = true,
}: InteractiveDemoBlockProps) {
  const [idea, setIdea] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = idea.trim();
    if (!value) return;
    const params = new URLSearchParams();
    params.set('demo', '1');
    params.set('idea', value);
    window.location.href = `/register?${params.toString()}`;
  };

  const fillIdea = (text: string) => setIdea(text);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <p className="text-lg font-medium text-text-primary mb-2">{label}</p>
      <p className="text-sm text-text-secondary mb-3">
        I want to plan / build / run:
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={PLACEHOLDERS[placeholderIndex]}
            className="w-full px-4 py-3.5 min-h-[48px] rounded-xl border-2 border-border bg-background-card text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            aria-label="What you want to build"
          />
        </div>
        <Button type="submit" className="whitespace-nowrap px-6 py-3">
          {buttonText}
        </Button>
      </div>
      {showChips && (
        <div className="flex flex-wrap gap-2 mt-3">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => fillIdea(p)}
              className="text-xs px-3 py-2 min-h-[36px] rounded-full border border-border hover:border-primary hover:bg-primary-light text-text-secondary hover:text-primary transition-all touch-manipulation"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {subtext && (
        <p className="text-sm text-text-secondary mt-3">{subtext}</p>
      )}
    </form>
  );
}
