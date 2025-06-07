import os
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv

# --- NEW: Import Google Gemini ---
import google.generativeai as genai

# Import our custom TTS service
import kokoro_tts_service

# Load environment variables from .env file
load_dotenv()

# --- NEW: Configure Gemini API ---
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in .env file. Please add it.")

genai.configure(api_key=GOOGLE_API_KEY)

# Initialize the Gemini Model once for efficiency
# We use 'gemini-1.5-flash' because it's fast and excellent for this kind of task.
try:
    gemini_model = genai.GenerativeModel('gemini-1.5-flash-latest')
    print("Successfully initialized Gemini model.")
except Exception as e:
    print(f"Error initializing Gemini model: {e}")
    gemini_model = None
# --- END NEW ---

# This is the hardcoded Ngrok URL from your previous request.
NGROK_URL = "http://100.90.222.30:3000"

# --- Initialize Flask App ---
app = Flask(__name__)

# --- CORS Configuration ---
# Allow requests from our Next.js frontend (http://localhost:3000) and Ngrok
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://100.90.222.30:3000"]}})

# --- Initialize TTS Service ---
kokoro_tts_service.initialize_service()


# --- NEW: Helper function to clean text with Gemini ---
def clean_text_with_gemini(text_to_clean: str) -> str:
    """
    Sends text to the Gemini API for cleaning and returns the result.
    If the API call fails, it returns the original text as a fallback.
    """
    if not gemini_model:
        print("Gemini model not available, returning original text.")
        return text_to_clean

    # The prompt you provided
    prompt_template = f"""
    You are a text-cleaning assistant. Your task is to process the following paragraph of text that was extracted from a PDF.

    Instructions:
    1. Remove any irrelevant or unnecessary text, such as:
        - Page numbers (e.g., "Page 56")
        - Section or chapter headings ONLY if they are clearly standalone or on their own line.
        - Footnote markers or references (e.g., "[1]", "(See Figure 2)", "*")
    2. Do NOT remove any inline text that is part of a sentence, even if it contains words like "Chapter", "Section", or "Introduction".
    3. Correct all punctuation and spelling mistakes while preserving the original meaning and tone of the paragraph.
    4. Return ONLY the cleaned paragraph text, with no extra explanations or introductory phrases.

    Here is the paragraph to clean:
    ---
    {text_to_clean}
    ---
    """

    try:
        print("Sending text to Gemini for cleaning...")
        response = gemini_model.generate_content(prompt_template)
        cleaned_text = response.text.strip()
        print("Received cleaned text from Gemini.")
        return cleaned_text
    except Exception as e:
        print(f"Error calling Gemini API: {e}. Falling back to original text.")
        return text_to_clean # Fallback to original text on error
# --- END NEW ---


# --- API Routes ---
@app.route('/api/speak', methods=['POST'])
def speak():
    """
    API endpoint to clean text with Gemini, then generate and stream TTS audio.
    Accepts JSON: { "text": "Hello world", "voice": "am_sara" }
    """
    if not kokoro_tts_service.KOKORO_INITIALIZED:
        return jsonify({"error": "TTS service is not available"}), 503

    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Text is required"}), 400

    text_to_speak = data['text']
    requested_voice = data.get('voice')
    default_voice = os.getenv("DEFAULT_VOICE", "am_michael")
    voice_to_use = requested_voice if requested_voice else default_voice

    print("-" * 40)
    print(f"Received original text: '{text_to_speak[:90]}...'")
    print(f"Selected voice: {voice_to_use}")

    # --- MODIFIED: Use the helper function to clean the text first ---
    cleaned_text = clean_text_with_gemini(text_to_speak)
    print(f"Using cleaned text for TTS: '{cleaned_text[:90]}...'")
    # --- END MODIFIED ---

    # Generate audio using the CLEANED text
    audio_bytes = kokoro_tts_service.generate_audio_stream(cleaned_text, voice_to_use)

    if audio_bytes:
        return Response(audio_bytes, mimetype='audio/mpeg')
    else:
        return jsonify({"error": "Failed to generate audio"}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """A simple health check endpoint."""
    return jsonify({
        "status": "ok",
        "tts_service_initialized": kokoro_tts_service.KOKORO_INITIALIZED,
        "gemini_model_initialized": gemini_model is not None
    })

if __name__ == '__main__':
    app.run(host="100.90.222.30", debug=True, port=5001)