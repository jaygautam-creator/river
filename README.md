# River

River is a continuous, memory-aware AI companion. It keeps an ongoing thread instead of treating every conversation as a blank slate.

## Local development

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:8787`.

## Current state

- Responsive chat shell for mobile, tablet, and laptop layouts.
- Separate chat and memory scrolling surfaces.
- Editable storyline memory cards.
- Local SQLite persistence and demo seed flow.
- Deterministic local reply fallback while model integration is pending.
- Voice interface placeholder; realtime voice is not connected yet.

## Next build priorities

1. Connect the production model and structured storyline extraction pipeline.
2. Add realtime voice with interruption handling and transcript persistence.
3. Add automated browser regression coverage at mobile and desktop breakpoints.
4. Add production auth, secrets management, rate limiting, and deployment configuration.
