from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import whisper
import tempfile
import os
import subprocess

app = FastAPI(title="Rounds Transcription API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading Whisper model...")
model = whisper.load_model("base")
print("Whisper model loaded.")

@app.get("/")
def health_check():
    return {"status": "ok", "model": "whisper-base"}

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if not audio:
        raise HTTPException(status_code=400, detail="No audio file provided")
    suffix = ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name
    wav_path = tmp_path.replace(".webm", ".wav")
    try:
        subprocess.run(
            ["ffmpeg", "-i", tmp_path, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav_path, "-y"],
            capture_output=True,
            check=True,
        )
        result = model.transcribe(
            wav_path,
            language="en",
            fp16=False,
            initial_prompt="Medical consultation between doctor and patient. Medical terminology expected.",
        )
        transcript = result["text"].strip()
        return {"transcript": transcript, "language": result.get("language", "en")}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Audio conversion failed. Is ffmpeg installed? Error: {e.stderr.decode()}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        if os.path.exists(wav_path):
            os.remove(wav_path)
