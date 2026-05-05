# Wake-word notes

- Browser speech APIs do not provide reliable background/off-tab wake detection.
- Current implementation uses in-page Web Speech recognition while the tab is active.
- Wake-word mode is opt-in and persisted via `localStorage` (`voiceWakeWordEnabled`).
- Phrase defaults to `nucleas`; cooldown defaults to 7000ms to reduce repeat triggers.
- Manual mic button remains primary fallback and is always available.
- Production hardening ideas:
  - calibrate sensitivity per browser/device
  - add explicit privacy consent copy in settings
  - add structured telemetry sink (detections, accepted activations, cancels)
