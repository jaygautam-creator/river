# River hackathon demo

River is a continuous, memory-aware AI companion. Instead of resetting context on every chat, it helps people carry forward the things they choose to remember.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. For a real AI conversation, add your Groq API key to the ignored `.env` file before starting River. Without a key, River remains fully usable with its local reply fallback. Create a fresh account, then use **Seed a richer memory** if you want an immediate visual storyline demo.

River uses Groq for the real-text demo. Voice mode uses Groq Whisper transcription and Orpheus speech output when the same Groq key is configured; recordings are sent for transcription only and are not stored by River.

## 2-minute video plan

| Time | Show | Say |
| --- | --- | --- |
| 0–10s | River landing screen | “Most AI chats start from zero. River is designed to keep the thread.” |
| 10–25s | Create an account and open the empty state | “This is a private, calm space for ongoing conversations—not another feed.” |
| 25–45s | Send: “I’m planning a two-week Lisbon trip this summer with a tiny notebook.” | “River notices a potentially meaningful detail, but it does not silently save it.” |
| 45–60s | Open Memory, approve the proposed Lisbon storyline | “The person decides what becomes memory. Every memory is visible and editable.” |
| 60–75s | Create a new thread, search for Lisbon, open the result | “The thread continues across conversations, while search makes it easy to return to a moment.” |
| 75–95s | Open Voice, record a short thought, then hear River reply | “Voice is private by default: a short recording is transcribed, never stored by River, and River answers in the same ongoing thread.” |
| 95–120s | Open Account & privacy | “River includes export, deletion, memory consent, session controls, and optional authenticator MFA—privacy is part of the product, not an afterthought.” |

## Demo guardrails

- Keep the demo on local data; do not show personal conversations.
- Voice works when a Groq API key is configured. Keep recordings short: Groq voice limits apply.
- Before recording voice, accept Groq's one-time Orpheus English model terms in its playground.
- Do not present River as therapy or emergency support.
