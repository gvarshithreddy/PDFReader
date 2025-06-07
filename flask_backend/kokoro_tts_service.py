import os
import io
import uuid
import tempfile
from kokoro_tts_module import initialize_kokoro_pipeline, generate_tts_audio

# This variable will hold the initialized state
KOKORO_INITIALIZED = False

def initialize_service(lang_code='a'):
    """
    Initializes the Kokoro TTS pipeline once when the server starts.
    """
    global KOKORO_INITIALIZED
    if KOKORO_INITIALIZED:
        print("Kokoro TTS service already initialized.")
        return

    try:
        print("Initializing Kokoro TTS pipeline...")
        # Assuming your initialization function exists
        initialize_kokoro_pipeline(lang_code=lang_code)
        KOKORO_INITIALIZED = True
        print("✅ Kokoro TTS pipeline initialized successfully.")
    except Exception as e:
        print(f"🔥 Failed to initialize Kokoro TTS: {e}")
        KOKORO_INITIALIZED = False
        # The app can decide how to handle this (e.g., exit or return errors)

def generate_audio_stream(text: str, voice_name: str) -> bytes | None:
    """
    Generates TTS audio for the given text and returns it as in-memory bytes.

    This function adapts your file-based `generate_tts_audio` function
    for real-time streaming by using a temporary file that is immediately
    read and deleted.

    Args:
        text (str): The text to synthesize.
        voice_name (str): The voice to use for TTS.

    Returns:
        bytes: The raw MP3/WAV audio data, or None if generation failed.
    """
    if not KOKORO_INITIALIZED:
        print("Error: TTS service is not initialized.")
        return None
    if not text.strip():
        print("Warning: Received empty text for TTS.")
        return None

    # Use a temporary directory to avoid clutter
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a unique filename for this request
        # The 'i' (index) argument in your original function is now irrelevant
        # as we process one chunk at a time. We pass 0.
        temp_audio_path = generate_tts_audio(
            text,
            0, # Dummy index for the chunk
            temp_dir,
            voice_name
        )

        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                # Read the generated file's content into memory
                with open(temp_audio_path, 'rb') as f:
                    audio_bytes = f.read()
                
                print(f"✓ Generated {len(audio_bytes)} bytes of audio for voice '{voice_name}'")
                return audio_bytes
            except Exception as e:
                print(f"Error reading temporary audio file: {e}")
                return None
            # The temporary file is automatically deleted when the 'with' block exits
        else:
            print(f"✗ Failed to generate audio file for text: '{text[:50]}...'")
            return None