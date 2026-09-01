# External TTS physical-device procedure

## Purpose and safety boundary

This procedure determines whether ordinary generated audio fixes the mirrored
TV routing behavior. It does not prove anything from desktop or automated
tests. Use only the bundled sentence, never names, imported packs, or private
sayings. Do not inspect or record provider keys. Screen recordings and exports
must not contain secrets.

The bundled WAV was generated outside the browser by
`scripts/generate-static-fixture.ps1`. Its source text is fixed and generic.
The live path is optional and must use the same-origin proxy described below.

## Setup for every run

1. Record the iPhone model and exact iOS version.
2. Select Safari browser tab or installed Home Screen mode.
3. Record the television or AirPlay receiver model and any intermediary.
4. Describe the mirroring or routing configuration. Confirm the visible display
   indicator matches the chosen launch mode.
5. Record whether representative workout music is playing.
6. Choose one RL-SPE case and press **Start run**. Do not reuse a run for a
   materially different setup or playback method.
7. After listening, select phone, TV, both, or neither. Record audible delay,
   interruptions, missing audio, music audibility, rotation, repetition count,
   and other observations. End, classify, and export the run JSON.

The app event log records method, display mode, document visibility,
AudioContext state, request timing, first response byte when measurable,
media-ready/decode, playback request/start, and terminal outcome. A Web Audio
`source.start()` timestamp is an inferred start request, not proof of audible
output; the tester's physical observation is authoritative.

## Test sequence

1. Run RL-SPE-09 without mirroring using Browser SpeechSynthesis.
2. Enable screen mirroring and run RL-SPE-10 with Browser SpeechSynthesis.
3. Without changing the route, run RL-SPE-11 using **Static fixture · HTML
   audio**, then RL-SPE-12 using **Static fixture · Web Audio**.
4. Complete RL-SPE-13 by comparing phone/TV/both/neither across all three
   methods in equivalent runs.
5. Repeat the comparison in Safari and Home Screen mode for RL-SPE-14.
6. Play typical workout music and repeat the methods for RL-SPE-15.
7. For RL-SPE-16, play a static path at least 20 times across a representative
   long session. Note every route change, dropout, duplicate, or interruption.
8. Exercise background/restore, rotation, and a practical audio interruption
   in separate RL-SPE-17 through RL-SPE-19 runs.
9. For RL-SPE-20, choose the buffered playback path, prepare the static fixture,
   wait for **buffered**, then press **Simulate transition + play**. Compare the
   `speech.transition` and `speech.playback-started` monotonic timestamps. The
   observed start threshold is approximately 250 ms.
10. If live generation is configured, repeat preparation for RL-SPE-21 and use
    request-to-first-byte plus media-ready/decode timing to select a prefetch
    lead time. Live generation need not meet 250 ms itself.
11. For RL-SPE-22, disable the network before one live request and during a
    separate live request. Operate the timer throughout.
12. For RL-SPE-23, cancel an in-flight preparation. In a separate run, trigger
    the intended transition before preparation finishes. Confirm no audio is
    emitted at a later transition.
13. For RL-SPE-24, generate, play, stop, and fail speech while pausing/resuming
    the timer. Confirm its phase projection remains correct.

## Optional live proxy

The checked-in adapter accepts only `generic-transition-v1` and its exact
synthetic sentence. It binds to localhost, sends the provider key only in an
upstream authorization header, disables caching, and logs only the fixture ID.

1. Copy `.env.live.example` to `.env.local`.
2. Set `OPENAI_API_KEY` in the server process environment. Never prefix it with
   `VITE_`, save it in the repository, or expose it to the device bundle.
3. Run `pnpm tts-proxy` and `pnpm dev` in separate terminals. Vite proxies
   `/api/tts` to the local adapter.
4. For a physical phone, deploy the adapter behind HTTPS on the same origin as
   the lab and keep `VITE_TTS_PROXY_URL=/api/tts`. Localhost on the phone refers
   to the phone, not the development computer.

Do not enable live mode on public static hosting without a secured server route
and ordinary abuse controls. A second provider should be added behind the same
fixed request/ordinary-audio response boundary, not in the playback UI.
