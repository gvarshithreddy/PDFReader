import os
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv

# Import our custom TTS service
import kokoro_tts_service

# Load environment variables from .env file
load_dotenv()

# --- Initialize Flask App ---
app = Flask(__name__)

# --- CORS Configuration ---
# Allow requests from our Next.js frontend (http://localhost:3000)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# --- Initialize TTS Service ---
# This runs once when the Flask application starts.
kokoro_tts_service.initialize_service()

# --- API Routes ---
@app.route('/api/speak', methods=['POST'])
def speak():
    """
    API endpoint to generate and stream TTS audio.
    Accepts JSON: { "text": "Hello world", "voice": "am_sara" }
    The 'voice' parameter is optional.
    """
    # Check if the TTS service is ready
    if not kokoro_tts_service.KOKORO_INITIALIZED:
        return jsonify({"error": "TTS service is not available"}), 503

    # Get data from the request
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Text is required"}), 400

    text_to_speak = data['text']

    # --- NEW: Logic to select the voice ---
    # 1. Get the voice from the POST request. It's optional, so we use .get().
    requested_voice = data.get('voice')

    # 2. Get the default voice from environment variables as a fallback.
    default_voice = os.getenv("DEFAULT_VOICE", "am_michael")

    # 3. Decide which voice to use: prioritize the requested voice.
    voice_to_use = requested_voice if requested_voice else default_voice
    # --- END OF NEW LOGIC ---

    print(f"Received request to speak: '{text_to_speak[:70]}...'")
    # NEW: Added logging for the voice being used.
    print(f"Using voice: {voice_to_use}")

    # MODIFIED: Pass the determined 'voice_to_use' to the service.
    audio_bytes = kokoro_tts_service.generate_audio_stream(text_to_speak, voice_to_use)

    if audio_bytes:
        # Stream the audio bytes back to the client
        # 'audio/mpeg' is the correct MIME type for MP3 files.
        # Change to 'audio/wav' if your TTS generates WAV files.
        return Response(audio_bytes, mimetype='audio/mpeg')
    else:
        # If generation failed, return an error
        return jsonify({"error": "Failed to generate audio"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """A simple health check endpoint."""
    return jsonify({
        "status": "ok",
        "tts_service_initialized": kokoro_tts_service.KOKORO_INITIALIZED
    })

if __name__ == '__main__':
    # Use port 5001 to avoid conflict with Next.js (3000) and default Flask (5000)
    app.run(debug=True, port=5001)