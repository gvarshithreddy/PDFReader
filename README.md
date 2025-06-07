# 🧾 PDF Reader with TTS (Text-to-Speech)

This is a full-stack application that allows users to upload a PDF, view the content in a reader-friendly UI, and use a backend-powered TTS engine (PyTorch + Kokoro TTS) to read the content aloud.

---

## 🔧 Requirements

### System Requirements:

* **Python**: `3.12.8` or higher
  👉 [Download Python](https://www.python.org/downloads/release/python-3128/)
* **Node.js**: `v20.19.2`
  👉 [Download Node.js](https://nodejs.org/en/download)

To check your versions:

```bash
python --version
node -v
```

---

## 📦 Cloning the Repository

```bash
git clone https://github.com/gvarshithreddy/PDFReader.git
cd PDFReader
```

---

## 📁 Project Structure

```
PDFReader/
├── flask_backend/          # Python Flask backend (TTS engine)
└── next-pdf-reader/        # Next.js frontend (PDF viewer + controls)
```

---

## 🔙 Backend Setup (Flask + TTS)

1. **Navigate to the backend directory**:

   ```bash
   cd flask_backend
   ```

2. **Create a virtual environment**:

   ```bash
   python -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   ```

3. **Install Python requirements**:

   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:

   Create a `.env` file in the `flask_backend/` folder with the following content:

   ```
   DEFAULT_VOICE="am_michael"
   GOOGLE_API_KEY="<your_google_api_key>"
   ```

   #### 🔑 How to Get Your Google API Key:

   1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
   2. Create a new project (or select an existing one).
   3. Enable the **Text-to-Speech API** from the [API Library](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com).
   4. Go to **APIs & Services > Credentials** and click **Create Credentials > API key**.
   5. Copy your API key and replace `<your_google_api_key>` in the `.env` file.

5. **Install PyTorch with CUDA**
   Visit [PyTorch Installation Guide](https://pytorch.org/get-started/locally/)

   To determine your CUDA version:

   ```bash
   nvidia-smi
   ```

   Install a PyTorch version that matches **your CUDA version or lower**.
   *This project uses CUDA 12.6.*

   ⚠️ **Note**: Non-GPU (CPU-only) systems are currently **not tested**.

6. **Start the Flask backend**:

   ```bash
   python app.py
   ```

---

## 🌐 Frontend Setup (Next.js)

1. **Navigate to frontend folder**:

   ```bash
   cd ../next-pdf-reader
   ```

2. **Install Node dependencies**:

   ```bash
   npm install
   ```

3. *(Optional but recommended)*: If the frontend needs API base URLs or keys, you can also create a `.env.local` file in `next-pdf-reader/`:

   ```
   NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
   ```

4. **Run the development server**:

   ```bash
   npm run dev
   ```

5. **Open your browser** and go to:

   ```
   http://localhost:3000
   ```

---

## 📝 Notes

* Ensure both backend and frontend are running for the app to work properly.
* Backend provides text-to-speech service using Kokoro TTS and optionally Google's TTS API.
* Use `.env` files to configure environment-specific settings like voice and API keys.
* Frontend is optimized for reading and interaction with the backend TTS engine.

