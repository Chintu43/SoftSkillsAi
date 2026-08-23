import os
import sys
import numpy as np
from audio_utils import load_audio_as_numpy

_model_instance = None
_model_initialized = False

def get_pronunciation_assessor():
    """
    Lazy-load the PronounceAssessModel once and cache it in memory.
    """
    global _model_instance, _model_initialized
    if _model_initialized:
        return _model_instance

    _model_initialized = True
    try:
        import pronounce_assess
        print("[PronunciationEngine] Initializing pronounce-assess model...")

        if hasattr(pronounce_assess, 'PronounceAssessModel'):
            _model_instance = pronounce_assess.PronounceAssessModel()
            print("[PronunciationEngine] Loaded PronounceAssessModel successfully.")
        elif hasattr(pronounce_assess, 'PronunciationAssessor'):
            _model_instance = pronounce_assess.PronunciationAssessor()
            print("[PronunciationEngine] Loaded PronunciationAssessor successfully.")
        elif hasattr(pronounce_assess, 'assess'):
            _model_instance = pronounce_assess
            print("[PronunciationEngine] Loaded pronounce_assess module assessor.")
        else:
            _model_instance = pronounce_assess
            print("[PronunciationEngine] Loaded pronounce_assess package instance.")
    except Exception as e:
        print(f"[PronunciationEngine] Error initializing pronounce-assess model: {e}")
        _model_instance = None

    return _model_instance


def analyze_pronunciation(audio_bytes: bytes, reference_text: str, language: str = "en-US"):
    """
    Analyze actual recorded audio bytes against reference text using pronounce-assess.
    Returns structured JSON output based strictly on actual model results.
    """
    if not reference_text or not reference_text.strip():
        return {
            "success": False,
            "pronunciationAvailable": False,
            "error": "Reference text is empty."
        }

    if not audio_bytes or len(audio_bytes) < 100:
        return {
            "success": False,
            "pronunciationAvailable": False,
            "error": "Recorded audio is missing or too short."
        }

    clean_ref = reference_text.strip()

    # Load audio array at 16kHz
    try:
        audio_array, sr = load_audio_as_numpy(audio_bytes, target_sample_rate=16000)
    except Exception as err:
        return {
            "success": False,
            "pronunciationAvailable": False,
            "error": f"Audio decoding failed: {err}"
        }

    if len(audio_array) < 1600:
        return {
            "success": False,
            "pronunciationAvailable": False,
            "error": "Audio duration is too short for pronunciation analysis."
        }

    assessor = get_pronunciation_assessor()
    if not assessor:
        return {
            "success": False,
            "pronunciationAvailable": False,
            "error": "Pronunciation assessment model could not be loaded."
        }

    try:
        model_result = None
        if hasattr(assessor, 'assess'):
            model_result = assessor.assess(audio_array, clean_ref)
        elif hasattr(assessor, 'predict'):
            model_result = assessor.predict(audio_array, clean_ref)
        elif hasattr(assessor, 'analyze'):
            model_result = assessor.analyze(audio_array, clean_ref)
        elif callable(assessor):
            model_result = assessor(audio_array, clean_ref)

        if not model_result:
            return {
                "success": False,
                "pronunciationAvailable": False,
                "error": "Pronunciation model returned no output."
            }

        result_dict = {}
        if isinstance(model_result, dict):
            result_dict = model_result
        elif hasattr(model_result, '__dict__'):
            result_dict = model_result.__dict__
        else:
            result_dict = {"rawOutput": str(model_result)}

        return {
            "success": True,
            "pronunciationAvailable": True,
            "result": result_dict
        }
    except Exception as err:
        print(f"[PronunciationEngine] Assessment execution error: {err}")
        return {
            "success": False,
            "pronunciationAvailable": False,
            "error": f"Pronunciation assessment failed: {err}"
        }
