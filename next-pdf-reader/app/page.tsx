'use client';

import { useState, useRef, useEffect } from 'react';
import type * as PDFJS from 'pdfjs-dist';
import PdfViewer from './components/PdfViewer';
import { Upload, BookOpen, Play, Pause, X, Loader2, Mic } from 'lucide-react';

type PdfjsModule = typeof PDFJS;
type Paragraph = { id: number; content: string; };

// --- NEW: Data for Voice Selection ---
const voices = [
  { group: 'American English', id: 'am_michael', name: 'Michael', description: 'American Male' },
  { group: 'American English', id: 'af_bella', name: 'Bella', description: 'American Female (Expressive)' },
  { group: 'American English', id: 'af_heart', name: 'Heart', description: 'American Female (Special)' },
  { group: 'American English', id: 'am_puck', name: 'Puck', description: 'American Male' },
  { group: 'American English', id: 'af_nicole', name: 'Nicole', description: 'American Female (Studio)' },
  { group: 'American English', id: 'am_fenrir', name: 'Fenrir', description: 'American Male' },
  { group: 'British English', id: 'bf_emma', name: 'Emma', description: 'British Female' },
  { group: 'British English', id: 'bm_george', name: 'George', description: 'British Male' },
  { group: 'British English', id: 'bm_fable', name: 'Fable', description: 'British Male' },
  { group: 'British English', id: 'bf_isabella', name: 'Isabella', description: 'British Female' },
];

const LOOKAHEAD_BUFFER = 3; // How many paragraphs to pre-fetch

export default function HomePage() {
  const [pdfjsModule, setPdfjsModule] = useState<PdfjsModule | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- ROBUST STATE MANAGEMENT ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState<number | null>(null);
  const [audioBuffers, setAudioBuffers] = useState(new Map<number, AudioBuffer>());
  const [fetchQueue, setFetchQueue] = useState<number[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // --- NEW: State for selected voice ---
  const [selectedVoice, setSelectedVoice] = useState<string>('am_michael');

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  // --- Setup and File Handling ---
  useEffect(() => {
    const loadPdfjs = async () => {
      try {
        const module = await import('pdfjs-dist');
        module.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        setPdfjsModule(module);
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) { setError("Failed to load PDF engine."); }
    };
    loadPdfjs();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      resetState(true);
      setPdfFile(file);
      parsePdf(file);
    }
  };

  const parsePdf = async (file: File) => {
    if (!pdfjsModule) return;
    setIsLoading(true);
    setParagraphs([]);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsModule.getDocument(arrayBuffer).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
        fullText += pageText.replace(/-\s+/g, '') + ' ';
      }
      const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
      const smartParagraphs: Paragraph[] = [];
      let idCounter = 0;
      let currentParagraph = "";
      sentences.forEach(sentence => {
        if ((currentParagraph + sentence).length > 400 && currentParagraph.length > 0) {
          smartParagraphs.push({ id: idCounter++, content: currentParagraph.trim() });
          currentParagraph = sentence;
        } else {
          currentParagraph += " " + sentence;
        }
      });
      if (currentParagraph.trim()) {
        smartParagraphs.push({ id: idCounter++, content: currentParagraph.trim() });
      }
      setParagraphs(smartParagraphs);
    } catch (e) { setError('Failed to parse the PDF file.'); } finally { setIsLoading(false); }
  };

  // --- STATE-DRIVEN AUDIO ENGINE ---

  // WORKER: Processes one fetch request from the queue at a time.
  useEffect(() => {
    if (isFetching || fetchQueue.length === 0) {
      return;
    }

    const indexToFetch = fetchQueue[0];
    setIsFetching(true);
    console.log(`🚀 Worker is fetching paragraph ${indexToFetch} with voice ${selectedVoice}...`);

    // MODIFIED: Added 'voice' to the request body
    fetch('http://100.90.222.30:5001/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: paragraphs[indexToFetch].content,
        voice: selectedVoice
      }),
    })
    .then(res => {
      if (!res.ok) throw new Error(`Fetch failed for paragraph ${indexToFetch}`);
      return res.arrayBuffer();
    })
    .then(buffer => audioContextRef.current!.decodeAudioData(buffer))
    .then(audioBuffer => {
      setAudioBuffers(prevMap => new Map(prevMap).set(indexToFetch, audioBuffer));
      console.log(`✅ Worker stored audio for paragraph ${indexToFetch}`);
    })
    .catch(err => console.error(err))
    .finally(() => {
      setFetchQueue(prev => prev.slice(1));
      setIsFetching(false);
    });
  // MODIFIED: Added selectedVoice to the dependency array
  }, [fetchQueue, isFetching, paragraphs, selectedVoice]);


  // CONDUCTOR: Manages state, playback, and queuing of fetch requests.
  useEffect(() => {
    if (!isPlaying && audioSourceNodeRef.current) {
      audioSourceNodeRef.current.onended = null;
      audioSourceNodeRef.current.stop();
      audioSourceNodeRef.current = null;
      return;
    }

    if (!isPlaying || currentParagraphIndex === null || audioSourceNodeRef.current) {
      return;
    }

    const audioToPlay = audioBuffers.get(currentParagraphIndex);
    if (audioToPlay) {
      console.log(`▶️ Playing audio for paragraph ${currentParagraphIndex}`);
      const source = audioContextRef.current!.createBufferSource();
      source.buffer = audioToPlay;
      source.connect(audioContextRef.current!.destination);
      audioSourceNodeRef.current = source;
      
      source.onended = () => {
        audioSourceNodeRef.current = null;
        console.log(`⏹️ Finished audio for paragraph ${currentParagraphIndex}`);
        
        if (currentParagraphIndex >= paragraphs.length - 1) {
          setIsPlaying(false);
          setCurrentParagraphIndex(null);
        } else {
          setCurrentParagraphIndex(prev => (prev !== null ? prev + 1 : 0));
        }
      };
      source.start(0);

    } else {
      const requestsToAdd: number[] = [];
      for (let i = 0; i <= LOOKAHEAD_BUFFER; i++) {
        const indexToRequest = currentParagraphIndex + i;
        if (
          indexToRequest < paragraphs.length &&
          !audioBuffers.has(indexToRequest) &&
          !fetchQueue.includes(indexToRequest)
        ) {
          requestsToAdd.push(indexToRequest);
        }
      }
      if (requestsToAdd.length > 0) {
        setFetchQueue(prev => [...prev, ...requestsToAdd]);
      }
    }
  }, [isPlaying, currentParagraphIndex, audioBuffers, fetchQueue, paragraphs]);


  const handleReadClick = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    setIsPlaying(true);

    if (currentParagraphIndex === null) {
      let startIndex = 0;
      const container = scrollContainerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        for (let i = 0; i < paragraphRefs.current.length; i++) {
          const pRef = paragraphRefs.current[i];
          if (pRef) {
            const rect = pRef.getBoundingClientRect();
            if (rect.top >= containerRect.top && rect.top < containerRect.bottom) {
              startIndex = i;
              break;
            }
          }
        }
      }
      setCurrentParagraphIndex(startIndex);
    }
  };
  
  // --- NEW: Handler for voice selection change ---
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVoice = e.target.value;
    console.log(`Voice changed to: ${newVoice}. Clearing existing audio buffers.`);
    setSelectedVoice(newVoice);
    // This is CRITICAL. We must clear old buffers generated with the previous voice.
    setAudioBuffers(new Map());
    // Also clear the fetch queue to avoid fetching with the old voice.
    setFetchQueue([]);

    // If we are currently playing, stop the audio. The user will have to press play again.
    // This simplifies state management immensely.
    if (isPlaying) {
      setIsPlaying(false);
      if (audioSourceNodeRef.current) {
        audioSourceNodeRef.current.onended = null;
        audioSourceNodeRef.current.stop();
        audioSourceNodeRef.current = null;
      }
    }
  };

  const resetState = (isSoftReset = false) => {
    setIsPlaying(false);
    setCurrentParagraphIndex(null);
    setAudioBuffers(new Map());
    setFetchQueue([]);
    setIsFetching(false);

    if (audioSourceNodeRef.current) {
        audioSourceNodeRef.current.onended = null;
        audioSourceNodeRef.current.stop();
        audioSourceNodeRef.current = null;
    }
    
    if (!isSoftReset) {
      setPdfFile(null);
      const input = document.getElementById('file-upload') as HTMLInputElement;
      if (input) input.value = '';
    }
    setParagraphs([]);
    setError(null);
    setIsLoading(false);
  };
  
  // Group voices by their group property for rendering
  const groupedVoices = voices.reduce((acc, voice) => {
    (acc[voice.group] = acc[voice.group] || []).push(voice);
    return acc;
  }, {} as Record<string, typeof voices>);


  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800">
      {!pdfFile ? (
        <div className="text-center p-8 max-w-lg w-full">
            <BookOpen className="mx-auto h-16 w-16 text-indigo-500" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Modern PDF Reader
            </h1>
            <p className="mt-4 text-lg text-gray-600">
                Upload a PDF to extract its text and have it read aloud seamlessly.
            </p>
            <div className="mt-8">
                <label
                  htmlFor="file-upload"
                  className={`cursor-pointer inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white transition-colors
                  ${!pdfjsModule ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {!pdfjsModule ? (
                    <Loader2 className="mr-2 -ml-1 h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="mr-2 -ml-1 h-5 w-5" />
                  )}
                  <span>{!pdfjsModule ? 'Loading Engine...' : 'Upload PDF'}</span>
                </label>
                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf" disabled={!pdfjsModule} />
            </div>
            {isLoading && <p className="mt-4 text-gray-500 animate-pulse">Parsing PDF...</p>}
            {error && <p className="mt-4 text-red-500 font-semibold">{error}</p>}
        </div>
      ) : (
        <div className="w-full h-screen flex flex-col">
            <PdfViewer
                paragraphs={paragraphs}
                isLoading={isLoading}
                isPlaying={isPlaying}
                currentParagraphIndex={currentParagraphIndex}
                scrollContainerRef={scrollContainerRef}
                paragraphRefs={paragraphRefs}
            />
            {paragraphs.length > 0 && !isLoading && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
                    {/* --- NEW: Voice Selector --- */}
                    <div className="relative">
                      <Mic className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        value={selectedVoice}
                        onChange={handleVoiceChange}
                        disabled={isFetching} // Disable while fetching to prevent race conditions
                        className="appearance-none bg-white rounded-full shadow-lg pl-10 pr-4 py-3 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                        aria-label="Select a voice"
                      >
                        {Object.entries(groupedVoices).map(([groupName, voiceList]) => (
                          <optgroup label={groupName} key={groupName}>
                            {voiceList.map(voice => (
                              <option key={voice.id} value={voice.id}>
                                {voice.name} ({voice.description})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <button
                        onClick={handleReadClick}
                        className="flex items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        aria-label={isPlaying ? "Pause Reading" : "Start Reading"}
                    >
                        {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                    </button>
                    <button
                        onClick={() => resetState(false)}
                        className="flex items-center justify-center w-12 h-12 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
                        aria-label="Close PDF"
                    >
                        <X size={24} />
                    </button>
                </div>
            )}
        </div>
      )}
    </main>
  );
}