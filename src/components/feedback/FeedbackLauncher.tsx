'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export default function FeedbackLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('Bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setType('Bug');
    setSubject('');
    setMessage('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const pageUrl =
        typeof window !== 'undefined' ? `${window.location.origin}${pathname || ''}` : pathname || '';
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subject: subject.trim() || undefined,
          message,
          pageUrl: pageUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not submit feedback');
        return;
      }
      setSuccess(true);
      setSubject('');
      setMessage('');
    } catch {
      setError('Could not submit feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-primary text-white shadow-lg px-4 py-3 text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900"
        aria-label="Report a bug or request a feature"
      >
        Feedback
      </button>

      <Modal
        isOpen={open}
        onClose={handleClose}
        title="Bug report or feature request"
        maxWidth="md"
        stackAboveOverlays
      >
        {success ? (
          <div className="p-6 text-center space-y-4">
            <p className="text-text-primary font-medium">Thanks — your feedback was submitted.</p>
            <Button type="button" variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-error-light border border-error/30 text-error px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
            <Select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: 'Bug', label: 'Bug report' },
                { value: 'Feature Request', label: 'Feature request' },
                { value: 'Other', label: 'Other' },
              ]}
            />
            <Input
              label="Subject (optional)"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary"
            />
            <div>
              <label htmlFor="feedback-message" className="block text-sm font-medium text-text-primary mb-1">
                Details
              </label>
              <textarea
                id="feedback-message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background-card text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="What happened or what would help?"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !message.trim()}>
                {loading ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
