# Wake-word notes

- Browser speech APIs do not provide reliable background/off-tab wake detection.
- Current implementation uses in-page Web Speech recognition while the tab is active.
- Wake-word mode is opt-in and persisted via `localStorage` (`voiceWakeWordEnabled`).
- Phrase defaults to `nucleas`; cooldown defaults to 7000ms to reduce repeat triggers.
- Matching now supports aliases + fuzzy score threshold:
  - aliases: `nucleas`, `nucleus`, `nuclease`, `new cleus`, `newkleeus`
  - minimum score: `0.72` (tunable via config)
- Manual mic button remains primary fallback and is always available.
- Production hardening ideas:
  - calibrate sensitivity per browser/device
  - add explicit privacy consent copy in settings
  - add structured telemetry sink (detections, accepted activations, cancels)

## Chrome desktop verification checklist

1. Enable wake mode and wait for `Wake: armed`.
2. Say: `Nucleas`.
3. Say: `nucleus`.
4. Say a sentence with wake-word mid phrase: `hey nucleas open projects`.
5. Confirm in overlay counters:
   - detections increments on accepted wake
   - activations increments each time listening starts
   - cooldown prevents immediate retrigger spam
6. Inspect console logs:
   - `[Voice] Wake-word detected` includes `matchedAlias` + `score`
   - optional near-threshold logs show candidates below threshold
