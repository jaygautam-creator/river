# Real-time voice architecture

River's current Groq voice experience is deliberately **turn based**: capture audio, transcribe it, obtain a model reply, synthesize speech, then resume listening. The browser applies ambient calibration, adaptive pauses, interim transcript awareness, barge-in, and a press-to-talk fallback, but a REST pipeline cannot eliminate provider round trips.

## Required production topology

```text
Browser microphone
  -> authenticated River API (short-lived session request)
  -> regional live-voice gateway (WebSocket / WebRTC relay)
  -> realtime speech and model provider
  -> audio + transcript events back to the browser
```

The gateway must be a long-lived regional service, separate from the Vercel request handler. It holds provider credentials, creates a short-lived per-user session, verifies River access tokens, enforces rate limits, and never writes raw audio by default.

## Event contract

- `session.ready`: contains a short-lived opaque session identifier; never a long-lived provider key.
- `input.audio`: encrypted transport audio frames from the browser.
- `input.transcript.partial` and `input.transcript.final`: interim text for end-of-turn decisions.
- `turn.started`, `turn.completed`, and `turn.cancelled`: state transitions visible to the client.
- `output.text.delta` and `output.audio.delta`: streamed model output.
- `barge_in`: user speech stops output only after voice activity is sustained above the calibrated noise floor.
- `error`: code-only operational error; no raw transcript in logs.

## Turn-taking policy

1. Calibrate an ambient noise floor before the first turn.
2. Require sustained user speech before opening a turn.
3. Use interim transcript punctuation, speech duration, and silence to adapt the end-of-turn window rather than relying on one timer.
4. Do not start River output while interim speech is still arriving.
5. During River output, allow barge-in only after sustained fresh speech, not echo or incidental noise.
6. Always expose press-to-talk and a mute/stop control as a reliable fallback.

## Security and operating requirements

- Place the gateway close to the selected data/provider region and measure gateway-to-first-audio latency.
- Sessions expire in 60 seconds or less and are bound to one authenticated River account.
- Avoid storing audio. Persist only opt-in, content-free timing events needed for reliability analysis.
- Apply origin checks, per-user and per-IP rate limits, message-size limits, reconnect backoff, and abuse monitoring.
- Run load/soak tests with interrupted turns, muted tabs, denied microphone permission, poor networks, and noisy rooms before release.

`GET /api/voice/live/session` is an availability contract only. It returns `501` until `REALTIME_VOICE_GATEWAY_URL` points to an independently deployed gateway; this prevents River from falsely advertising streaming voice before it exists.
