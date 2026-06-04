export const RECORDING_POPOUT_CHANNEL = 'nucleas-recording-controls';

export type RecordingPopoutPhase = 'armed' | 'recording';

export type RecordingPopoutMessage =
  | { type: 'ready' }
  | { type: 'state'; phase: RecordingPopoutPhase; elapsedSeconds: number }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'closed' };

export function createRecordingPopoutChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(RECORDING_POPOUT_CHANNEL);
}

export function postRecordingPopoutMessage(message: RecordingPopoutMessage): void {
  const channel = createRecordingPopoutChannel();
  if (!channel) return;
  channel.postMessage(message);
  channel.close();
}

export function subscribeRecordingPopoutMessages(
  handler: (message: RecordingPopoutMessage) => void
): () => void {
  const channel = createRecordingPopoutChannel();
  if (!channel) return () => {};

  const onMessage = (event: MessageEvent<RecordingPopoutMessage>) => {
    if (event.data && typeof event.data.type === 'string') {
      handler(event.data);
    }
  };

  channel.addEventListener('message', onMessage);
  return () => {
    channel.removeEventListener('message', onMessage);
    channel.close();
  };
}
