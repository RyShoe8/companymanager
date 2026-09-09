'use client';
import { useEffect, useRef, useState } from 'react';
type Content = { digest: string; text: string; offset: number; nextOffset: number | null; totalCharacters: number };
export default function ArtifactContent({ projectId, artifactId, evidenceDigests }: { projectId: string; artifactId: string; evidenceDigests: string[] }) {
  const [content, setContent] = useState<Content | null>(null);
  const [selection, setSelection] = useState('');
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function load(evidence: string, offset = 0) {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setContent(null); setMessage('Loading content…'); setSelection(evidence);
    try {
      const query = new URLSearchParams({ offset: String(offset), ...(evidence ? { evidence } : {}) });
      const response = await fetch(`/api/projects/${projectId}/ai/artifacts/${artifactId}/content?${query}`, { cache: 'no-store', signal: request.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Content unavailable.');
      if (!request.signal.aborted) { setContent(body); setMessage(''); }
    } catch (error) { if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Load failed.'); }
  }
  return <section className="space-y-2">
    <h2 className="text-lg font-semibold">Patch and evidence</h2>
    <p>Untrusted output, displayed as plain text. A matching hash does not prove tests passed or code is safe.</p>
    <button className="underline" onClick={() => void load('')}>View patch</button>
    {evidenceDigests.map((digest, index) => <button key={digest} className="ml-3 underline" onClick={() => void load(digest)}>Evidence {index + 1}</button>)}
    {message && <p role="status">{message}</p>}
    {content && <><p className="break-all text-sm">SHA-256: {content.digest}</p>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded border border-border p-3">{content.text}</pre>
      <p>Characters {content.offset + 1}–{content.offset + content.text.length} of {content.totalCharacters}</p>
      {content.offset > 0 && <button className="mr-3 underline" onClick={() => void load(selection, Math.max(0, content.offset - 16384))}>Previous</button>}
      {content.nextOffset !== null && <button className="underline" onClick={() => void load(selection, content.nextOffset!)}>Next</button>}
      <button className="ml-3 underline" onClick={() => { controller.current?.abort(); setContent(null); setMessage(''); }}>Close content</button>
    </>}
  </section>;
}
