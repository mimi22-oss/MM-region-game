# Procedural horror audio

The night ghosts and existing rural ambience now share one application-scoped AudioContext. No external audio assets, decoders, media elements, or audio downloads are used. The synthesizer uses OscillatorNode, GainNode, BiquadFilterNode, DynamicsCompressorNode, WaveShaperNode, generated AudioBuffer/AudioBufferSourceNode, PannerNode and AudioParam automation. Reverb-like reflections are synthesized as quiet delayed noise envelopes rather than adding a DelayNode outside the allowed API list. Spatialization follows the [Web Audio specification](https://www.w3.org/TR/webaudio/).

## Graph and lifecycle

`GameAudioRuntime` lazily creates the graph only from trusted pointer/key input while userActivation is active. Sound playback, settings changes and animation callbacks cannot create or resume a context. Repeated gestures reuse the context. Browser/Android WebView denial leaves gameplay functional; a subsequent gesture can retry. One context persists for the page lifetime; unmounting the last attachment suspends it rather than creating new contexts on every zone visit.

Ghost emitter -> HRTF PannerNode -> emitter mute gain -> Ghost bus -> Master -> compressor -> bounded soft saturation -> output. Existing AmbientAudio -> Ambience bus -> Master. The compressor and final bounded soft saturation reduce digital spikes; absolute acoustic loudness still depends on device/headphone volume. Master defaults to the existing saved game volume, Ghost defaults to 70%, Ambience 100%. Bus changes ramp over 50 ms. The original sound checkbox gates the whole graph. Ghost/Ambience controls persist separately; Master keeps the existing preference storage.

Each ghost ID owns an independent panner with inverse attenuation (reference distance 3 m, rolloff 1.8, max distance 65 m) and is explicitly muted outside its audible/active range. Camera world position and forward/up basis update the listener, including rotated/parented cameras. Sources follow NPC world position. There are no per-frame React state writes. Stereo headphone HRTF and attenuation use browser implementations.

Voices share one generated noise buffer and one distortion curve. At most 24 preset voices can exist concurrently. A silent scheduled oscillator owns each voice's cleanup after its longest tail; completion, cancellation and emitter release disconnect all owned nodes and stop modulation sources too. Unmount releases only that NPC's voices/panner. Tab hiding cancels ghost voices and suspends the shared context; resumption requires input. AmbientAudio no longer suspends/closes the shared context when its own channel is muted.

## Presets and event alignment

| Preset | Synthesis / trigger |
|---|---|
| ghost_ambient | Low drone and filtered noise; sustained only while audible and active |
| ghost_whisper | Breath-like bandpass noise syllables; observe state begins |
| ghost_warning | Falling FM/formant tone and noise; flee begins |
| ghost_scream | FM saw carriers, formant filters, distorted harmonic layer, noise and reflections; actual freaky clip begins |
| ghost_evil_laugh | Six voiced pulses with alternating, falling pitches; actual laugh clip begins |
| ghost_footsteps | Short low-filtered noise and thump; locomotion clip phase crossings |
| ghost_chase_tension | Pulsed bass/noise; sustained while chasing |
| ghost_grab | Bass impact and short noise; AI neck-contact phase begins |
| player_struggle | Voiced breath/noise pulses; contact/struggle phase begins |
| player_fall | Descending tone and low noise; existing player-fall phase begins |
| ghost_disappear | Filtered breath, falling tone, quiet reflections; despawn begins |

HorrorAnimationSync reads the real mixer action's time/duration once a loaded action is running. Scream/laugh therefore do not fire while a clip is still downloading. Footsteps use four evenly spaced contact phases per locomotion clip cycle, with current playback speed automatically reflected by mixer time. Missed steps after a stalled frame produce at most one burst, preventing catch-up storms. There are no unrelated wall-clock timers for encounter audio. The four contact phases are an initial timing calibration; foot-bone/contact-marker inspection on each authored motion is a remaining artistic refinement. State/contact events use the existing AI/interaction phase callbacks; legacy AI audio cue aliases remain supported for callers, without double-playing the same NPC event.

## Changed files

| File | Reason |
|---|---|
| src/game/gameAudio.ts (new) | Shared context, trusted-input unlock, buses, listener and output protection |
| src/game/horrorMix.ts (new) | Persisted Ghost/Ambience settings and UI subscription |
| src/game/ghostAudio.ts | Expand four-cue synth into eleven spatial presets, bounded voice management and clip-event synchronizer |
| src/game/ambientAudio.ts | Route existing rural synthesis through shared Ambience bus |
| src/components/EnvironmentAudio.tsx | Attach shared runtime lifecycle and configure master/buses |
| src/components/EnvironmentSettings.tsx | Master, Ghost and Ambience sliders |
| src/components/GhostNpc.tsx | Per-NPC spatial position, camera listener, running clip timing, state/contact synchronization, owner cleanup |
| tests/ghostAudio.test.ts (new) | Locked-context safety and animation/stride/contact event deduplication |
| tests/fixtures/ghostAudio.html (new) | Real-browser synthesis fixture without game/GLB load |
| scripts/checkGhostAudio.mjs (new) | Trusted CDP input, shared-context, all-preset, polyphony and cleanup regression |
| package.json | Register unit tests and test:audio:browser command |
| artifacts/performance-audit/audio/audio-regression.json | Actual browser test result |

## Executed checks

- `npm test`: 261 passed, zero failed (includes two new audio tests and current concurrent repository tests). Log: artifacts/performance-audit/tests-audio.log.
- `node --experimental-strip-types --test tests/ghostAudio.test.ts`: two passed after lifecycle/output changes.
- `npm run test:audio:browser`: Chrome headless actual Web Audio, all eleven presets, two emitters, one shared context for ghost and ambience, max 24 voices, automatic drain, cancellation and release. Raw result stored above.
- `npm run build`: TypeScript and Vite production build; existing large-chunk warning remains. Final log: artifacts/performance-audit/build-audio-final.log.

The browser harness uses installed Windows Chrome, local Vite 5196 and CDP 9356. Its assertions validate graph scheduling/lifecycle; it does not measure subjective horror quality or real headphone loudness. Android hardware/autoplay interruption recovery and listening checks remain manual validation. The client-side ghost AI is unchanged; this introduces no network authority or inventory/ownership protocol changes. Future multiplayer ghost event replication should send authoritative event IDs/clip phase and deduplicate before calling this synthesizer.

## Reuse from another NPC

Acquire the shared engine, attach `gameAudio.attach()` to the component lifetime, and call `audio.position(ownerId, x, y, z, audible)` before `audio.play('ghost_whisper', 1, ownerId)`. Route active-camera world pose to `gameAudio.listener(...)`. Release the owner on unmount, call the attachment cleanup, then `releaseSharedGhostAudio()`. Do not call unlock from effects or frame callbacks; the runtime's trusted gesture handlers own it. The exported `HorrorAnimationSync` can consume another actor's actual clip timing and interaction phases without adding timers or mixers.
