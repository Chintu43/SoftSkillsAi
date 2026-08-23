import os
import tempfile
import io
import numpy as np

def load_audio_as_numpy(audio_bytes: bytes, target_sample_rate: int = 16000):
    """
    Load raw audio bytes (webm, ogg, wav, mp3) into a 16kHz mono float32 numpy array.
    Supports PyAV, SoundFile, and SciPy decoding without system ffmpeg binaries.
    """
    if not audio_bytes or len(audio_bytes) == 0:
        raise ValueError("Audio payload is empty")

    # 1. Try PyAV for native WebM/OGG/WAV container decoding
    try:
        import av
        container = av.open(io.BytesIO(audio_bytes))
        resampler = av.AudioResampler(format='s16', layout='mono', rate=target_sample_rate)
        pcm_frames = []

        for frame in container.decode(audio=0):
            resampled = resampler.resample(frame)
            for r in resampled:
                pcm_frames.append(r.to_ndarray())

        if pcm_frames:
            pcm_bytes = b"".join(f.tobytes() for f in pcm_frames)
            audio_array = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            return audio_array, target_sample_rate
    except Exception as e:
        pass

    # 2. Fallback: try SoundFile
    try:
        import soundfile as sf
        audio_array, sr = sf.read(io.BytesIO(audio_bytes))
        if len(audio_array.shape) > 1:
            audio_array = np.mean(audio_array, axis=1)
        audio_array = audio_array.astype(np.float32)
        if sr != target_sample_rate:
            duration = len(audio_array) / sr
            new_len = int(duration * target_sample_rate)
            audio_array = np.interp(np.linspace(0, len(audio_array), new_len), np.arange(len(audio_array)), audio_array).astype(np.float32)
        return audio_array, target_sample_rate
    except Exception as e:
        pass

    # 3. Fallback: SciPy wavfile
    try:
        from scipy.io import wavfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            sr, audio_array = wavfile.read(tmp_path)
            if audio_array.ndim > 1:
                audio_array = audio_array.mean(axis=1)
            audio_array = audio_array.astype(np.float32)
            if audio_array.max() > 1.0:
                audio_array = audio_array / 32768.0
            return audio_array, sr
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        raise ValueError(f"Could not decode audio payload: {e}")
