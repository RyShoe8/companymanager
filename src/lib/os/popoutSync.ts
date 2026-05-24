export type PopoutSyncMessage =
    | { type: 'POP_IN'; windowId: string }
    | { type: 'CLOSE'; windowId: string };

const CHANNEL_NAME = 'nucleas-os';

export interface PopoutSyncHandle {
    publish: (message: PopoutSyncMessage) => void;
    close: () => void;
}

export function subscribePopoutSync(onMessage: (message: PopoutSyncMessage) => void): PopoutSyncHandle {
    if (typeof BroadcastChannel === 'undefined') {
        return { publish: () => {}, close: () => {} };
    }
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<PopoutSyncMessage>) => {
        if (event.data?.windowId) onMessage(event.data);
    };
    return {
        publish: (message) => channel.postMessage(message),
        close: () => channel.close(),
    };
}
