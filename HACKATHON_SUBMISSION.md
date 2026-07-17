# River — Build Week submission checklist

Use this document to prepare the submission. Rewrite all narrative fields in your own voice before posting them to Devpost.

## Final links

- Repository: https://github.com/jaygautam-creator/river
- Local demo: `http://127.0.0.1:8787`
- Demo video: _add the public YouTube URL_
- Devpost project: _add the Devpost URL_
- Codex `/feedback` Session ID: _add the ID from the primary build session_

## One-sentence starting point

River is a consent-first AI companion that keeps ongoing conversations connected through user-approved memories rather than silently profiling people.

Use that only as an outline. Before submitting, explain in your own words why continuity and user control matter to you.

## What to demonstrate

1. Start or open a conversation and send a real message.
2. Show River proposing a memory, then approve it from the Memory panel.
3. Create a second thread and use Search to find the earlier topic.
4. Show the Today follow-up view and editable memory controls.
5. Show Account & privacy: memory consent, retention, export, device sessions, and MFA.
6. Optionally show hands-free voice after confirming it works with the configured Groq account.

## Final recording checklist

- [ ] Use a clean demo account with no personal data.
- [ ] Confirm Groq chat is responding before recording.
- [ ] Confirm the Groq Orpheus model terms are accepted if voice will be shown.
- [ ] Record a two- to three-minute walkthrough based on `HACKATHON_DEMO.md`.
- [ ] Upload the video to YouTube as **public**.
- [ ] Copy the video URL above.

## Devpost checklist

- [ ] Start the Devpost submission before the deadline.
- [ ] Use **River** as the project name.
- [ ] Add yourself as the sole team member.
- [ ] Write the description in your own voice; make every claim match this repository.
- [ ] Add repository and public video links.
- [ ] Paste the Codex `/feedback` Session ID from the primary build session.
- [ ] Add product screenshots.
- [ ] If the repository is private, share it with `testing@devpost.com` and `build-week-event@openai.com`; otherwise verify that the public repository opens while signed out.

## Last local checks

```bash
npm run build
npm run test:smoke
npm audit --audit-level=high
```

Then open River on both a laptop-size and phone-size browser viewport. Check the text composer, Memory panel, mobile menu, Today view, search, settings, and one voice turn if voice is in the recording.
