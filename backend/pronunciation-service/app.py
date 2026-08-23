from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pronunciation_engine import analyze_pronunciation, get_pronunciation_assessor

app = FastAPI(title="SkillForge AI Pronunciation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    print("[Pronunciation] Service started on 127.0.0.1:8001")
    # Pre-warm model cache
    get_pronunciation_assessor()

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "pronunciation"
    }

@app.post("/analyze-pronunciation")
async def handle_pronunciation_analysis(
    audio: UploadFile = File(...),
    referenceText: str = Form(...),
    language: str = Form("en-US")
):
    print(f"[Pronunciation] Audio received: filename='{audio.filename}', content_type='{audio.content_type}'")
    print(f"[Pronunciation] Reference text length: {len(referenceText)} chars")

    try:
        audio_bytes = await audio.read()
        res = analyze_pronunciation(audio_bytes, referenceText, language)
        print(f"[Pronunciation] Assessment completed. Success: {res.get('success')}, Available: {res.get('pronunciationAvailable')}")
        return res
    except Exception as err:
        print(f"[Pronunciation] Error processing request: {err}")
        return {
            "success": False,
            "pronunciationAvailable": False,
            "error": str(err)
        }
