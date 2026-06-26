'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { formInputClass } from '@/components/ui/formClasses';
import { useVoice } from '@/components/voice/VoiceProvider';
import { useFeedbackVisibility } from '@/hooks/useFeedbackVisibility';
import useIsMobile from '@/lib/hooks/useIsMobile';
import { MOBILE_NAV_CLEARANCE_CLASS } from '@/lib/ui/mobileLayout';

export default function FeedbackLauncher() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const visible = useFeedbackVisibility();
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

  const voice = useVoice();
  const isVoiceEnabled = voice.enabled;

  if (!visible) return null;

  const positionClass = isMobile
    ? MOBILE_NAV_CLEARANCE_CLASS
    : isVoiceEnabled
      ? 'bottom-40'
      : 'bottom-6';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={`fixed right-6 z-40 rounded-full bg-primary text-white shadow-lg px-4 py-3 text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-900 ${positionClass}`}
        data-tour="feedback-button"
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
          <div className="space-y-4">
            <p className="text-text-primary font-medium">Thanks — your feedback was submitted.</p>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-error/30 bg-error-light px-3 py-2 text-sm text-error">
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
              <AutoGrowTextarea
                id="feedback-message"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What happened or what would help?"
                minRows={5}
                className={formInputClass}
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
