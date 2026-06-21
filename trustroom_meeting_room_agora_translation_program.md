---
name: feature:deal-room-workspace:meeting-room-agora-translation
description: Detailed Agent-ready specification and phased program for adding Agora meeting room, realtime transcript, translation, speech-to-speech, RAG, and Scam Guard intelligence to TrustRoom AI.
keywords:
  - trustroom
  - deal room
  - meeting room
  - agora
  - realtime call
  - transcript
  - translation
  - speech-to-speech
  - tts
  - rag
  - qdrant
  - bge-m3
  - scam guard
  - evidence vault
  - solana escrow
type: feature-spec
date: 2026-06-20
status: proposed
complexity: complex-multi-phase
---

# TrustRoom AI — Meeting-Enabled Deal Room Program

## 0. Executive Summary

This document develops the pasted planning note into a clearer Agent-ready technical program.

**Core decision:** TrustRoom AI should not build a generic Zoom/Google Meet clone. The meeting/call feature must be designed as a **transaction-specific Deal Room capability**.

The meeting layer exists to support:

1. realtime negotiation between buyer, seller, arbiter, guest, and AI Observer;
2. transcript generation for AI Deal Notary;
3. realtime Scam Guard warnings;
4. optional translated transcript;
5. optional speech-to-speech translation;
6. evidence capture for disputes;
7. RAG/Q&A over meeting transcript and deal history.

The safest implementation order is:

```text
Meeting foundation
→ Agora RTC call UI
→ Realtime transcript
→ Scam Guard on transcript
→ Text translation
→ Transcript RAG
→ Speech-to-speech TTS
→ Hardening
```

Do **not** start with speech-to-speech. It is the hardest part because latency, language coverage, speaker overlap, and audio playback UX are all non-trivial.

---

## 1. Product Boundary

### 1.1 What this feature is

A **Meeting-Enabled Deal Room** is a live call workspace attached to a specific TrustRoom AI deal.

It includes:

- voice/video call through Agora;
- secure invite/join flow;
- participant roles;
- live transcript;
- translated transcript;
- AI risk monitoring;
- optional voice translation;
- transcript evidence timeline;
- post-meeting transcript search and Q&A.

### 1.2 What this feature is not

It is **not**:

- a standalone meeting SaaS;
- a calendar/scheduling product;
- a webinar/live-streaming product;
- a general chat app;
- a full Zoom/Meet competitor;
- an autonomous AI arbitration system.

The call layer must always be subordinate to the deal lifecycle and escrow safety rules.

---

## 2. Key Design Principles

### 2.1 Deal-first architecture

Every meeting session must be scoped to a `dealId`.

A meeting without deal context is out of scope for MVP because Scam Guard, Evidence Vault, escrow state validation, and AI Deal Notary all depend on deal metadata.

### 2.2 AI is a risk assistant, not a judge

The AI can:

- detect risk;
- summarize terms;
- ask clarification questions;
- recommend safe next steps;
- prepare dispute evidence.

The AI must not:

- release funds;
- refund funds;
- slash stake;
- resolve disputes alone;
- mark a participant as scammer without appeal/review.

### 2.3 Evidence is private by default

Meeting transcript, uploaded files, generated summaries, translation chunks, and audio/TTS artifacts are sensitive.

Store them off-chain in database/storage. Anchor only hashes or minimal metadata on-chain.

### 2.4 Degrade gracefully

If translation, TTS, embeddings, or RAG fail, the call must still work.

Core call + transcript + escrow safety must remain usable.

---

## 3. Current Assumptions from Provided Context

The pasted planning note says the repo already has or is expected to have:

- Deal Room web foundation;
- WebSocket realtime;
- wallet auth;
- AI/Scam Guard base;
- NestJS backend;
- Prisma;
- Qdrant;
- Groq;
- planned Agora integration.

It also says the repo does not yet have:

- real voice/video meeting room;
- membership/join-by-link;
- mic/cam/screen controls;
- realtime transcript translation;
- speech-to-speech translation;
- transcript RAG;
- meeting moderation;
- participant roles;
- device state sync.

This program assumes those statements are directionally correct. Before implementation, the Agent must inspect the repo and update this spec if the actual code differs.

---

## 4. Corrected Technical Decisions

### 4.1 Realtime call

Use:

- **Agora RTC/Web SDK** for buyer/seller/arbiter/guest audio/video.
- **Agora token issuance** from backend.
- **Agora Conversational AI / transcript event path** where applicable for AI Observer and live transcript.

### 4.2 STT / transcript source

Primary:

- Agora realtime STT/transcript stream.

Fallback:

- Groq Whisper or another STT provider for chunked audio or delayed fallback mode.

Important:

- Speaker attribution is critical. If transcript speaker mapping is wrong, Scam Guard, Deal Notary, Evidence Vault, and dispute reports become unreliable.

### 4.3 LLM

Use Groq for:

- intent classification;
- deal term extraction;
- transcript summarization;
- dispute report drafting;
- translation MVP if a dedicated translation provider is not integrated yet.

### 4.4 Embeddings and vector database

Use:

- `bge-m3` for multilingual embeddings;
- Qdrant for vector storage and similarity search.

Why:

- TrustRoom AI must handle Vietnamese, English, and mixed Web3 language.
- bge-m3 is better aligned with multilingual transcript search than English-only embeddings.

### 4.5 TTS / speech-to-speech

Do **not** hard-code Groq TTS as the only TTS provider.

Use a provider interface:

```ts
interface TTSProvider {
  synthesize(input: {
    text: string;
    sourceLanguage?: string;
    targetLanguage: string;
    voice?: string;
    format: "mp3" | "wav" | "opus";
  }): Promise<{
    audioUrl?: string;
    audioBuffer?: ArrayBuffer;
    durationMs?: number;
    providerSegmentId: string;
  }>;
}
```

Reason:

- Groq TTS can be used when its supported languages/voices match the target use case.
- For Vietnamese/Korean/Chinese/Japanese or broader multilingual dubbing, another TTS provider may be required.
- Speech-to-speech must remain pluggable.

Recommended MVP behavior:

- MVP-1: no TTS.
- MVP-2: text translation only.
- MVP-3: TTS provider abstraction + one supported language path.

### 4.6 Translation

Use a translation provider abstraction:

```ts
interface TranslationProvider {
  translate(input: {
    text: string;
    sourceLanguage?: string;
    targetLanguage: string;
    context?: string;
  }): Promise<{
    translatedText: string;
    sourceLanguage?: string;
    targetLanguage: string;
    confidence?: number;
  }>;
}
```

MVP options:

1. use Groq LLM translation for fast prototyping;
2. later replace or supplement with specialist translation services;
3. cache translations by transcript chunk hash + target language.

---

## 5. Domain Model

### 5.1 MeetingSession

Represents one call session attached to a deal.

```ts
type MeetingSession = {
  id: string;
  dealId: string;
  agoraChannelName: string;
  status: "scheduled" | "live" | "ended" | "archived";
  title?: string;
  createdByWallet: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 5.2 MeetingParticipant

Represents a participant in a meeting.

```ts
type MeetingParticipant = {
  id: string;
  meetingId: string;
  userId?: string;
  walletAddress?: string;
  role: "host" | "buyer" | "seller" | "arbiter" | "guest" | "observer_ai";
  displayName?: string;
  agoraUid?: string;
  preferredLanguage?: string;
  translationTargetLanguage?: string;
  voiceTranslationEnabled: boolean;
  joinedAt?: string;
  leftAt?: string;
  isMuted?: boolean;
  isCameraOff?: boolean;
};
```

### 5.3 MeetingInvite

Represents a secure invite link.

```ts
type MeetingInvite = {
  id: string;
  meetingId: string;
  tokenHash: string;
  role: "guest" | "arbiter" | "buyer" | "seller";
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  walletBinding?: string;
  revokedAt?: string;
  createdByWallet: string;
  createdAt: string;
};
```

### 5.4 MeetingTranscriptChunk

Represents one normalized transcript segment.

```ts
type MeetingTranscriptChunk = {
  id: string;
  meetingId: string;
  dealId: string;
  speakerParticipantId?: string;
  speakerRole?: "buyer" | "seller" | "arbiter" | "guest" | "observer_ai";
  language?: string;
  text: string;
  normalizedText?: string;
  startedAtMs?: number;
  endedAtMs?: number;
  confidence?: number;
  source: "agora_stt" | "groq_stt" | "manual" | "fallback";
  createdAt: string;
};
```

### 5.5 MeetingTranslation

Represents translated transcript text for a specific target language.

```ts
type MeetingTranslation = {
  id: string;
  transcriptChunkId: string;
  meetingId: string;
  sourceLanguage?: string;
  targetLanguage: string;
  originalText: string;
  translatedText: string;
  provider: "groq" | "custom" | "other";
  confidence?: number;
  createdAt: string;
};
```

### 5.6 MeetingTTSSegment

Represents a generated translated voice segment.

```ts
type MeetingTTSSegment = {
  id: string;
  meetingId: string;
  transcriptChunkId: string;
  translationId: string;
  targetParticipantId?: string;
  targetLanguage: string;
  voice?: string;
  storagePath?: string;
  audioUrl?: string;
  durationMs?: number;
  status: "queued" | "rendering" | "ready" | "played" | "failed" | "skipped";
  provider: string;
  createdAt: string;
};
```

### 5.7 MeetingRiskEvent

Meeting-specific risk event linked to transcript span.

```ts
type MeetingRiskEvent = {
  id: string;
  meetingId: string;
  dealId: string;
  transcriptChunkId?: string;
  speakerParticipantId?: string;
  intent:
    | "early_release_request"
    | "move_off_platform"
    | "external_wallet_request"
    | "credential_request"
    | "fake_payment_pressure"
    | "time_pressure"
    | "term_change_after_deposit"
    | "ambiguous_terms"
    | "unverified_delivery"
    | "impersonation"
    | "unknown";
  riskLevel: "low" | "medium" | "high" | "critical";
  scoreDelta: number;
  confidence?: number;
  triggerText?: string;
  reason: string;
  suggestedAction: string;
  createdAt: string;
};
```

### 5.8 MeetingArtifact

Stores derived artifacts.

```ts
type MeetingArtifact = {
  id: string;
  meetingId: string;
  dealId: string;
  type:
    | "full_transcript"
    | "summary"
    | "translated_transcript"
    | "dispute_report"
    | "audio_segment"
    | "evidence_bundle";
  storagePath?: string;
  sha256Hash?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};
```

---

## 6. Backend API Contract

### 6.1 Meeting lifecycle

```http
POST   /meetings
GET    /meetings/:id
POST   /meetings/:id/start
POST   /meetings/:id/end
POST   /meetings/:id/join
POST   /meetings/:id/leave
GET    /meetings/:id/participants
```

### 6.2 Agora token

```http
POST /meetings/:id/token
```

Input:

```json
{
  "role": "buyer",
  "device": "web"
}
```

Output:

```json
{
  "meetingId": "meeting_123",
  "channelName": "deal_abc_meeting_123",
  "agoraUid": "123456",
  "token": "agora_rtc_token",
  "expiresAt": "2026-06-20T10:00:00Z"
}
```

### 6.3 Invites

```http
POST   /meetings/:id/invites
GET    /meetings/invites/:token/preview
POST   /meetings/invites/:token/accept
DELETE /meetings/:id/invites/:inviteId
```

Invite constraints:

- expiry required;
- max uses required;
- role required;
- optional wallet binding;
- invite must be revocable.

### 6.4 Transcript

```http
GET  /meetings/:id/transcripts
POST /meetings/:id/transcripts/ingest
```

`POST /ingest` is internal/service-only unless Agora webhook/event delivery requires an exposed endpoint.

### 6.5 Translation preferences

```http
GET  /meetings/:id/translation/preferences
POST /meetings/:id/translation/preferences
```

Input:

```json
{
  "targetLanguage": "en",
  "showOriginal": true,
  "showTranslated": true,
  "voiceTranslationEnabled": false
}
```

### 6.6 Risk events

```http
GET /meetings/:id/risk-events
```

### 6.7 Meeting Q&A / RAG

```http
POST /meetings/:id/query
```

Input:

```json
{
  "question": "Seller đã từng yêu cầu release trước chưa?",
  "language": "vi"
}
```

Output:

```json
{
  "answer": "Có. Seller đã nói: 'release trước đi rồi tôi gửi file sau'.",
  "citations": [
    {
      "transcriptChunkId": "chunk_123",
      "timestampMs": 183000,
      "speakerRole": "seller"
    }
  ]
}
```

---

## 7. WebSocket Event Contract

### 7.1 Client receives

```ts
type ServerToClientEvent =
  | "meeting.participant_joined"
  | "meeting.participant_left"
  | "meeting.device_state_changed"
  | "meeting.transcript_chunk"
  | "meeting.translation_chunk"
  | "meeting.tts_segment_ready"
  | "meeting.risk_detected"
  | "meeting.summary_updated"
  | "meeting.ended"
  | "meeting.error";
```

### 7.2 Client sends

```ts
type ClientToServerEvent =
  | "meeting.device_state_update"
  | "meeting.translation_preference_update"
  | "meeting.request_summary"
  | "meeting.request_tts_replay"
  | "meeting.raise_manual_flag";
```

### 7.3 Transcript event payload

```ts
type TranscriptChunkEvent = {
  meetingId: string;
  dealId: string;
  chunkId: string;
  speakerParticipantId?: string;
  speakerRole?: string;
  language?: string;
  text: string;
  startedAtMs?: number;
  endedAtMs?: number;
  confidence?: number;
};
```

### 7.4 Risk event payload

```ts
type RiskDetectedEvent = {
  meetingId: string;
  dealId: string;
  riskEventId: string;
  transcriptChunkId?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  intent: string;
  reason: string;
  suggestedAction: string;
  triggerText?: string;
};
```

---

## 8. Worker and Queue Architecture

### 8.1 Queues

Use BullMQ queues:

```text
meeting.transcript-ingest
meeting.translation
meeting.tts-render
meeting.embedding-index
meeting.risk-analysis
meeting.summary
meeting.artifact-export
```

### 8.2 Worker responsibilities

#### transcript-ingest

- receives Agora transcript chunks;
- normalizes text;
- maps speaker to participant;
- stores chunk in DB;
- emits `meeting.transcript_chunk`.

#### translation

- reads transcript chunks;
- resolves per-user target language preferences;
- translates text;
- stores translations;
- emits `meeting.translation_chunk`.

#### tts-render

- consumes translated segments;
- generates audio through configured TTS provider;
- stores audio in private storage if needed;
- emits `meeting.tts_segment_ready`.

#### embedding-index

- chunks transcript semantically;
- embeds with bge-m3;
- stores vector in Qdrant with metadata:
  - `dealId`;
  - `meetingId`;
  - `speakerRole`;
  - `language`;
  - `timestamp`;
  - `riskFlags`.

#### risk-analysis

- consumes transcript chunks;
- runs keyword/rule detector;
- runs LLM intent classifier;
- runs scam-playbook similarity;
- checks deal state and escrow state;
- creates `MeetingRiskEvent`;
- emits `meeting.risk_detected`;
- writes event into Evidence Vault.

#### meeting-summary

- creates rolling summary;
- extracts deal terms;
- updates AI Deal Notary output.

---

## 9. Frontend Design

### 9.1 Route strategy

Preferred MVP route:

```text
/deals/[dealId]/room
```

Within the Deal Room workspace, show the call as a main tab or primary panel.

Optional later route:

```text
/meetings/[meetingId]
```

Only use this route if meetings become independently shareable. Even then, keep strict deal permissions.

### 9.2 Deal Room layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: Deal title | Escrow state | Meeting state | Invite │
├──────────────────────────────┬──────────────────────────────┤
│                              │ Deal Control Panel           │
│ Agora Video/Voice Grid        │ - Deposit / Release          │
│ Buyer / Seller / AI Observer  │ - Confirm Terms              │
│                              │ - Submit Delivery            │
│                              │ - Raise Dispute              │
├──────────────────────────────┼──────────────────────────────┤
│ Transcript Panel              │ AI Monitor / Risk Panel      │
│ Original + translated text    │ warnings + suggested actions │
└──────────────────────────────┴──────────────────────────────┘
```

### 9.3 Core UI components

Create reusable components:

```text
MeetingVideoGrid
ParticipantTile
ParticipantSidebar
CallControls
DeviceSelector
InviteDialog
TranscriptPanel
TranslationPanel
RiskAlertPanel
TTSPlaybackQueue
MeetingSummaryPanel
```

### 9.4 Local state

Use Zustand for:

- local mic/camera state;
- selected devices;
- active layout;
- transcript panel toggles;
- translation preferences;
- TTS playback queue;
- temporary UI warning state.

Use TanStack Query for:

- meeting metadata;
- participants;
- transcripts;
- risk events;
- invite preview;
- translation preferences.

---

## 10. Scam Guard in Meeting Context

### 10.1 Detection layers

Pipeline:

```text
TranscriptChunk
→ normalize text
→ keyword/rule detector
→ LLM intent classifier
→ scam-playbook similarity search
→ deal-state checker
→ escrow-state checker
→ wallet/address parser
→ evidence verifier
→ risk aggregator
→ risk event
→ websocket alert
→ Evidence Vault
```

### 10.2 Required intents

MVP must detect:

- early release request;
- off-platform migration;
- external wallet address request;
- seed phrase/private key/OTP request;
- fake payment proof pressure;
- time pressure / urgency;
- term change after deposit;
- vague or missing terms;
- unverified delivery claim.

### 10.3 Escrow-state rules

Examples:

```text
IF intent = early_release_request
AND deal.status NOT IN [DeliverySubmitted, ReadyToRelease]
THEN risk = High or Critical
```

```text
IF transcript contains wallet address
AND address NOT IN [buyer_wallet, seller_wallet, escrow_address]
THEN risk = Critical
```

```text
IF speaker requests seed phrase OR private key OR OTP
THEN risk = Critical
```

### 10.4 Evidence integration

Every risk event must store:

- transcript chunk ID;
- speaker role;
- raw quote;
- risk intent;
- risk level;
- reason;
- suggested action;
- timestamp;
- meeting ID;
- deal ID.

This allows Evidence Vault to build a dispute timeline.

---

## 11. Translation and Speech-to-Speech Design

### 11.1 Text translation MVP

Implement first.

Flow:

```text
TranscriptChunk
→ language detection
→ translation worker
→ translated text stored
→ websocket to target participants
→ UI shows original + translated text
```

Acceptance:

- User A speaks Vietnamese.
- User B selects English.
- User B sees English translated transcript near realtime.
- Reloading the page still shows stored original and translated transcript.

### 11.2 Speech-to-speech later

Flow:

```text
TranscriptChunk
→ translate text
→ TTS render
→ audio segment ready
→ participant playback queue
```

Do not attempt true simultaneous interpretation in MVP. Use segment-based translated playback.

### 11.3 Audio UX rules

To avoid chaotic audio:

- dub only active speaker by default;
- do not dub overlapping speakers simultaneously;
- allow user to enable/disable translated voice;
- allow user to lower original audio volume while dubbed audio plays;
- queue TTS segments in order;
- skip stale segments if latency becomes too high;
- always show translated text even if TTS fails.

### 11.4 Latency budget

Target:

```text
Transcript display: 1–3 seconds
Text translation: 2–5 seconds
Speech dub: 3–8 seconds, best-effort
Risk warning: 1–4 seconds after risky utterance
```

If TTS exceeds latency budget, mark segment as stale and skip playback.

---

## 12. RAG over Meeting Transcript

### 12.1 Purpose

RAG enables questions such as:

- “Buyer đã cam kết deadline nào?”
- “Seller có yêu cầu release trước không?”
- “Điều kiện release cuối cùng là gì?”
- “Có địa chỉ ví ngoài escrow nào được nhắc đến không?”
- “Tóm tắt các điểm có thể gây tranh chấp.”

### 12.2 Indexing

Index:

- transcript chunks;
- AI summaries;
- confirmed deal terms;
- risk events;
- evidence metadata.

Vector metadata:

```json
{
  "dealId": "deal_123",
  "meetingId": "meeting_123",
  "chunkId": "chunk_123",
  "speakerRole": "seller",
  "language": "vi",
  "timestampMs": 123000,
  "riskIntent": "early_release_request"
}
```

### 12.3 Retrieval

Use hybrid strategy:

- vector search via Qdrant;
- filters by `dealId` and `meetingId`;
- exact filters for risk intent, speaker role, language when needed;
- answer with transcript citations.

### 12.4 Safety

RAG must never retrieve across deals unless caller has explicit permission.

All query endpoints must check deal participation or arbiter/admin role.

---

## 13. Phase Program

## Phase 0 — Product and Architecture Lock

### Goal

Lock scope, data contracts, provider boundaries, and MVP cuts.

### Tasks

- Define MVP meeting use cases:
  - buyer + seller call;
  - arbiter joins later;
  - guest joins by invite link.
- Confirm Agora mode:
  - RTC for audio/video;
  - transcript event path;
  - token issuance.
- Confirm translation MVP:
  - text-first;
  - TTS later.
- Confirm provider interfaces:
  - STT;
  - translation;
  - TTS;
  - embeddings;
  - LLM.
- Define latency targets.

### Deliverables

- meeting room spec;
- event contract;
- data model draft;
- provider interfaces;
- MVP acceptance checklist.

### Acceptance

- Agent can implement Phase 1 without making product decisions.

---

## Phase 1 — Meeting Foundation

### Goal

Create backend meeting lifecycle and secure invite system.

### Tasks

- Add Prisma models:
  - MeetingSession;
  - MeetingParticipant;
  - MeetingInvite.
- Add NestJS `MeetingsModule`.
- Implement APIs:
  - create;
  - get;
  - start;
  - end;
  - join;
  - leave;
  - invite.
- Implement permission model:
  - buyer/seller from deal;
  - arbiter/admin optional;
  - guest restricted.
- Implement Agora token endpoint.

### Acceptance

- Deal owner can create a meeting for a deal.
- Invite link can be created, accepted, expired, and revoked.
- User can join only if permission/invite is valid.
- Backend returns Agora token for valid participant.

---

## Phase 2 — Agora RTC UI and Participation

### Goal

Users can enter live audio/video call.

### Tasks

- Integrate Agora Web SDK.
- Build MeetingVideoGrid.
- Build CallControls.
- Build ParticipantSidebar.
- Implement mic/camera toggle.
- Implement device selector.
- Implement join/leave lifecycle.
- Implement basic reconnect handling.

### Acceptance

- Two browser sessions join the same meeting.
- Mic/camera toggle works.
- Participant join/leave is visible realtime.
- Meeting state persists if page reloads.

---

## Phase 3 — Realtime Transcript

### Goal

Display and store live transcript.

### Tasks

- Connect Agora transcript/STT path.
- Normalize transcript chunk.
- Map speaker to participant.
- Store transcript chunks.
- Emit `meeting.transcript_chunk`.
- Show TranscriptPanel.
- Allow transcript history reload.

### Acceptance

- Spoken words appear as transcript near realtime.
- Transcript has speaker + timestamp.
- Transcript persists in DB.
- Reloaded page can fetch previous chunks.

---

## Phase 4 — Scam Guard on Transcript

### Goal

Run live fraud detection from meeting transcript.

### Tasks

- Connect transcript chunks to `meeting.risk-analysis` queue.
- Implement MVP scam rules:
  - early release;
  - off-platform;
  - external wallet;
  - seed/private key/OTP;
  - fake proof pressure.
- Add LLM intent classifier.
- Add deal/escrow-state checker.
- Emit risk events.
- Show RiskAlertPanel.
- Write risk events into Evidence Vault.

### Acceptance

- A phrase like “release trước đi rồi tôi gửi file sau” triggers High Risk.
- Warning links back to transcript chunk.
- Risk event is stored and appears in evidence timeline.

---

## Phase 5 — Text Translation

### Goal

Show translated transcript per user target language.

### Tasks

- Add translation preferences.
- Add translation provider interface.
- Add translation worker.
- Store translations.
- Emit `meeting.translation_chunk`.
- Add TranslationPanel.
- Cache by chunk hash + target language.

### Acceptance

- User A speaks Vietnamese.
- User B selects English and sees translated transcript.
- User can switch target language without breaking session.
- If translation fails, original transcript remains visible.

---

## Phase 6 — RAG over Transcript

### Goal

Enable meeting Q&A with cited transcript spans.

### Tasks

- Add transcript chunking/indexing strategy.
- Generate bge-m3 embeddings.
- Store in Qdrant.
- Add `/meetings/:id/query`.
- Build MeetingQAPanel.
- Return answers with cited transcript chunks.

### Acceptance

- User can ask “điều kiện release là gì?”
- System answers based on transcript and deal metadata.
- Answer cites transcript chunks.
- Query cannot access another deal’s transcript.

---

## Phase 7 — Speech-to-Speech Translation

### Goal

Allow opt-in translated voice playback.

### Tasks

- Add TTS provider interface.
- Add TTS worker.
- Add TTS segment model.
- Add playback queue.
- Add user-level toggle.
- Add stale segment skipping.
- Add original volume ducking option.

### Acceptance

- User enables translated voice.
- System plays translated audio segments.
- Audio does not overlap excessively.
- If TTS fails, text translation still works.

---

## Phase 8 — Hardening

### Goal

Make the feature robust enough for demo and pilot.

### Tasks

- Rate limit invite creation and join attempts.
- Rotate Agora tokens.
- Add reconnect resilience.
- Add expired invite handling.
- Add fallback when STT/translation/TTS is unavailable.
- Add observability:
  - Sentry errors;
  - structured logs;
  - latency metrics;
  - risk warning metrics.
- Add E2E tests.

### Acceptance

- Expired invite cannot join.
- Guest cannot access transcript after leaving unless permitted.
- Network reconnect does not corrupt participant state.
- TTS/translation failures do not crash call.
- Logs are sufficient to debug a failed meeting.

---

## 14. MVP Cut Recommendation

### MVP-1: Call + Transcript + Evidence

Build:

- meeting session;
- invite link;
- Agora audio/video;
- participant list;
- mic/cam toggle;
- transcript panel;
- transcript persistence.

Do not build:

- TTS;
- RAG;
- advanced translation;
- complex moderation.

### MVP-2: Scam Guard + Text Translation

Build:

- risk detection on transcript;
- RiskAlertPanel;
- evidence timeline integration;
- text translation per user.

### MVP-3: RAG + Speech-to-Speech

Build:

- transcript indexing in Qdrant;
- meeting Q&A;
- TTS audio segment queue;
- voice translation toggle.

This ordering minimizes technical risk while preserving demo value.

---

## 15. Technical Risks and Mitigations

### 15.1 Latency

Risk:

- STT → translation → TTS can exceed natural conversation timing.

Mitigation:

- text-first MVP;
- TTS best-effort;
- skip stale audio;
- show latency indicator.

### 15.2 Speaker attribution

Risk:

- transcript assigned to wrong speaker causes wrong risk evidence.

Mitigation:

- map Agora UID to participant ID;
- show low-confidence speaker labels;
- allow correction in dispute view.

### 15.3 Audio overlap

Risk:

- voice dub becomes chaotic with multiple speakers.

Mitigation:

- dub active speaker only;
- queue short segments;
- skip overlapping segments;
- user-controlled toggle.

### 15.4 Cost

Risk:

- STT + LLM + translation + TTS + embeddings become expensive.

Mitigation:

- per-room feature toggles;
- cache translations;
- index only final transcript chunks;
- avoid TTS by default.

### 15.5 Privacy

Risk:

- transcript and evidence leak sensitive deal info.

Mitigation:

- private storage;
- signed URLs;
- deal-scoped access checks;
- retention policy;
- no raw transcript on-chain.

### 15.6 Invite abuse

Risk:

- invite links leak or are reused.

Mitigation:

- expiry;
- max uses;
- revoke;
- optional wallet binding;
- guest restrictions.

---

## 16. Verification Plan

### Unit tests

- invite token validation;
- participant permission;
- meeting state transitions;
- transcript normalization;
- translation preference resolution;
- scam rule scoring;
- external wallet parser.

### Integration tests

- create meeting from deal;
- join by invite;
- issue Agora token;
- store transcript;
- create translation;
- trigger risk event;
- index transcript into Qdrant;
- query transcript with citation.

### E2E tests

- two browser sessions join same room;
- mic/cam controls work;
- transcript appears;
- translated text appears;
- risky phrase triggers warning;
- evidence timeline contains transcript + warning.

### Manual tests

- expired invite;
- revoked invite;
- guest join;
- wallet-bound invite;
- network disconnect/reconnect;
- overlapping speakers;
- language switching;
- translation/TTS provider failure.

---

## 17. Files and Areas Likely Touched

```text
apps/web/
  app/deals/[dealId]/room/
  components/meeting/
  components/transcript/
  components/risk/
  stores/meeting-store.ts

apps/api/
  src/meetings/
  src/agora/
  src/transcripts/
  src/translation/
  src/scam-guard/
  src/evidence/
  src/websocket/

packages/types/
  meeting.ts
  transcript.ts
  risk.ts
  events.ts

packages/ai/
  prompts/
  risk-rules/
  translation/
  embeddings/

packages/db/
  prisma/schema.prisma

infra/
  docker/docker-compose.yml
  qdrant/
  env examples
```

If `packages/db` does not exist, adapt to the current repo's Prisma location.

---

## 18. Agent Execution Guidance

### 18.1 Do first

1. Inspect actual repo structure.
2. Locate existing Deal Room, WebSocket, AI, Prisma, Qdrant, Groq, and auth modules.
3. Compare current code against this spec.
4. Create a feature plan under:

```text
process/features/deal-room-workspace/active/meeting-room-agora-translation_2026-06-20/
```

5. Implement phases sequentially.

### 18.2 Do not do

- Do not implement speech-to-speech before transcript works.
- Do not build generic meeting scheduling.
- Do not make AI release/refund funds.
- Do not store raw transcripts/audio on-chain.
- Do not make public evidence URLs.
- Do not skip permission checks on transcript/RAG queries.

### 18.3 Stop conditions

Stop and ask for product decision if:

- the desired target languages for TTS are not known;
- Agora transcript integration cannot provide acceptable speaker attribution;
- invite link guest mode conflicts with deal privacy;
- escrow state model in code differs from this spec;
- TTS provider cannot support required languages.

---

## 19. Open Decisions

These should be resolved before Phase 5 or 7:

1. Target languages for text translation:
   - VI ↔ EN only?
   - VI/EN/KR/CN/JP?
2. Target languages for speech-to-speech:
   - English only for hackathon?
   - Vietnamese voice required?
3. Should guests be allowed without wallet?
   - if yes, what can they see?
4. Does arbiter join need transcript access before joining?
5. Retention policy:
   - 7 days?
   - 30 days?
   - until dispute closed?
6. Is raw audio recording required?
   - recommended default: no raw recording for MVP; transcript + events only.
7. Should translation be visible in Evidence Vault?
   - recommended: store original transcript as source of truth; translation as derived artifact.

---

## 20. Final Recommendation

Build the meeting-enabled Deal Room as a **complex multi-phase program**, not as one giant feature branch.

Recommended execution order:

```text
Phase 0: Product + architecture lock
Phase 1: Meeting foundation
Phase 2: Agora RTC UI
Phase 3: Realtime transcript
Phase 4: Scam Guard on transcript
Phase 5: Text translation
Phase 6: Transcript RAG
Phase 7: Speech-to-speech
Phase 8: Hardening
```

For a hackathon/demo, the highest-value slice is:

```text
Deal Room call
+ transcript
+ AI warning on risky phrase
+ evidence timeline
+ optional translated text
```

This proves the core TrustRoom AI product thesis without getting blocked by the hardest part: low-latency multilingual speech-to-speech.

---

## 21. Reference Notes for Agent

Use official docs during implementation because APIs may change:

- Agora Conversational AI transcripts: https://docs.agora.io/en/conversational-ai/develop/transcripts
- Agora backend/client build guide: https://docs.agora.io/en/conversational-ai/develop/build-server-client
- Agora event notifications: https://docs.agora.io/en/conversational-ai/develop/event-notifications
- Groq text-to-speech docs: https://console.groq.com/docs/text-to-speech
- Groq speech-to-text docs: https://console.groq.com/docs/speech-to-text
- Groq text/chat docs: https://console.groq.com/docs/text-chat

Treat these links as implementation references, not product requirements.
