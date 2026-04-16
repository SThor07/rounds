# Rounds — AI Medical Scribe

> Doctors spend 2 hours on documentation for every 1 hour with patients. Rounds fixes that.

Rounds is an ambient AI scribe that listens to doctor-patient consultations and automatically generates complete, structured clinical notes — running entirely on your local machine. No cloud. No subscription. No patient data leaving your device.


---

## The Problem

Physician burnout is at **63%** in the US. The #1 driver isn't difficult diagnoses — it's paperwork.

EHR systems like Epic were designed by billing departments, not clinicians. The average doctor spends **49% of their working hours** on administrative tasks and only **27% with actual patients**. They didn't go through 12 years of medical school to click dropdown menus.

The downstream effects are real:
- Shorter appointments → missed diagnoses
- Cognitive overload → medication errors
- Burnout → early retirement → physician shortage

Companies like [Abridge](https://www.abridge.com) ($150M raised), [Nabla](https://www.nabla.com) ($30M raised), and [Suki](https://www.suki.ai) ($165M raised) are solving this — but exclusively for large hospital systems at $500+/month per physician. A solo GP, a rural clinic, or a physician in a developing country has no access to these tools.

Rounds is the open-source, zero-cost, fully local alternative.

---

## What It Does

Record a natural doctor-patient conversation. Stop recording. Within 60 seconds you get:

- **SOAP Note** — Subjective, Objective, Assessment, Plan — fully structured and editable
- **ICD-10 Billing Codes** — suggested automatically from the clinical content
- **Drug Interaction Flags** — medications mentioned are flagged for pharmacist review
- **Patient Summary** — plain-English visit summary the doctor can email directly to the patient
- **PDF Export** — one click, formatted clinical note ready to file

The doctor's job: review, correct in 90 seconds, approve. Done.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Doctor's Device                       │
│                                                         │
│  Browser (Next.js)                                      │
│       │                                                 │
│       │  audio blob (webm)                              │
│       ▼                                                 │
│  FastAPI Backend  ──── ffmpeg ────► Whisper (base)      │
│       │                              speech-to-text     │
│       │  raw transcript                                  │
│       ▼                                                 │
│  Ollama API  ──────────────────────► Llama 3 8B         │
│       │                              clinical reasoning  │
│       │  structured JSON                                 │
│       ▼                                                 │
│  Next.js UI                                             │
│       │                                                 │
│       ├──► SOAP Note (editable)                         │
│       ├──► ICD-10 codes                                 │
│       ├──► Drug interaction flags                       │
│       ├──► Patient summary                              │
│       └──► PDF export                                   │
│                                                         │
│  Nothing leaves this box                                │
└─────────────────────────────────────────────────────────┘
```

---

## Why This Is Not Just A ChatGPT Wrapper

This is a production pipeline with multiple specialized components:

**Whisper** runs locally with a clinical initial prompt to bias transcription toward medical terminology. It handles messy real-world speech — crosstalk, accents, drug names — far better than generic speech-to-text.

**Structured output enforcement** — Llama 3 is prompted with strict JSON schema requirements and the response is parsed with a regex fallback to handle malformed output. Temperature is set to 0.1 for consistent, non-hallucinated clinical language.

**ICD-10 classification** is performed by the LLM reasoning over the clinical content and mapping to real billing codes — not keyword matching.

**Drug interaction flagging** extracts medication mentions from the transcript and surfaces them for pharmacist review, reducing one of the most common causes of preventable patient harm.

**Zero data egress** — audio, transcripts, and clinical notes never touch an external API. This is what makes it viable in healthcare contexts where HIPAA considerations are paramount.

---

## Tech Stack

| Component | Technology | Why |
|---|---|---|
| Frontend | Next.js 15 + TypeScript | App Router, fast, type-safe |
| Styling | Tailwind CSS | Utility-first, no runtime |
| Transcription | OpenAI Whisper (base) | Best local speech-to-text, medical-tuned |
| LLM | Llama 3 8B via Ollama | Local inference, zero cost, strong reasoning |
| Backend | Python 3.11 + FastAPI | Async, fast, great for ML pipelines |
| Audio conversion | ffmpeg | webm to wav for Whisper compatibility |
| PDF export | jsPDF | Client-side, no server needed |
| **Total API cost** | **$0** | **Forever** |

---

## Market Context

| Product | Funding | Monthly Cost | Runs Locally |
|---|---|---|---|
| Abridge | $150M | Enterprise contract | No |
| Nabla | $30M | Enterprise contract | No |
| DAX Copilot (Microsoft) | — | $500+/physician | No |
| Suki | $165M | Enterprise contract | No |
| Freed | — | $99/physician | No |
| **Rounds** | **$0** | **Free, open source** | **Yes** |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- [Ollama](https://ollama.ai) installed and running
- ffmpeg installed

```bash
# Mac
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

### Installation

**1. Clone the repo**
```bash
git clone https://github.com/SThor07/rounds.git
cd rounds
```

**2. Pull the LLM**
```bash
ollama pull llama3
```

**3. Install frontend dependencies**
```bash
npm install
```

**4. Install Python dependencies**
```bash
pip3.11 install fastapi uvicorn openai-whisper python-multipart torch
```

### Running

Open two terminal windows:

**Terminal 1 — Whisper backend**
```bash
python3.11 -m uvicorn backend:app --reload --port 8000
```

**Terminal 2 — Next.js frontend**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> On Mac, Ollama runs as a background app automatically — no third terminal needed.

---

## Testing Without A Microphone

Paste this in your browser console at localhost:3000 to test the full pipeline:

```js
fetch('/api/generate-soap', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    transcript: "Patient is a 52-year-old male presenting with chest pain for 2 days. Pain is 6 out of 10, radiating to the left arm. History of hypertension and type 2 diabetes. Currently taking lisinopril 10mg and metformin 500mg. Blood pressure today 148 over 92. Heart rate 88. EKG ordered. Plan to refer to cardiology if troponin is elevated."
  })
}).then(r => r.json()).then(console.log)
```

---

## Switching Models

In `src/app/api/generate-soap/route.ts`:

```ts
model: "llama3"       // default
model: "llama3.1:8b"  // newer, slightly better
model: "mistral"      // faster
model: "meditron"     // Llama fine-tuned on medical literature (best accuracy)
```

```bash
ollama pull meditron
```

---

## Project Structure

```
rounds/
├── src/
│   └── app/
│       ├── page.tsx                      # Main UI
│       └── api/
│           ├── transcribe/route.ts       # Whisper proxy
│           └── generate-soap/route.ts   # Ollama SOAP generation
├── backend.py                            # FastAPI Whisper server
└── README.md
```

---

## Roadmap

- [ ] spaCy medical NER for structured entity extraction
- [ ] Whisper large-v3 for higher accuracy
- [ ] Session persistence with Supabase
- [ ] Meditron model integration
- [ ] OpenFDA drug interaction API layer
- [ ] Epic FHIR API integration
- [ ] IRB-approved pilot — ASU College of Health Solutions / Mayo Clinic Alliance

---

## Contributing

Pull requests welcome. If you are a physician, nurse, or medical student and want to help validate clinical output quality, open an issue — that feedback is the most valuable thing this project needs right now.

---

## Built By

**Shrivatsasingh Rathore**
MS in Data Science, Analytics & Engineering — Arizona State University (May 2026)

Published researcher in AI applied to healthcare domains. Background in full-stack engineering, ML pipelines, and computer vision systems.

- Portfolio: [shriv-portfolio.vercel.app](https://shriv-portfolio.vercel.app)
- GitHub: [github.com/SThor07](https://github.com/SThor07)

---

## License

MIT — use it, fork it, build on it.

---

## Disclaimer

Rounds is a research and productivity tool. It does not provide medical diagnoses and is not a substitute for clinical judgment. All AI-generated notes must be reviewed and approved by a licensed physician before use in any clinical context.
