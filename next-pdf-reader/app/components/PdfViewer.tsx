'use client';

import { useEffect, MutableRefObject } from 'react';

type Paragraph = {
  id: number;
  content: string;
};

// CORRECTED: The props interface now correctly defines the types for the refs.
interface PdfViewerProps {
  paragraphs: Paragraph[];
  isLoading: boolean;
  isPlaying: boolean;
  currentParagraphIndex: number | null;
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>;
  paragraphRefs: MutableRefObject<(HTMLParagraphElement | null)[]>;
}

export default function PdfViewer({
  paragraphs,
  isLoading,
  isPlaying,
  currentParagraphIndex,
  scrollContainerRef,
  paragraphRefs,
}: PdfViewerProps) {

  // Scroll to the currently playing paragraph
  useEffect(() => {
    if (isPlaying && currentParagraphIndex !== null) {
      const currentRef = paragraphRefs.current[currentParagraphIndex];
      if (currentRef) {
        currentRef.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentParagraphIndex, isPlaying, paragraphRefs]);

  if (isLoading) {
    return (
        <div className="flex-grow flex items-center justify-center">
            <p className="text-xl animate-pulse">Processing Document...</p>
        </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-grow w-full bg-white overflow-y-auto"
      style={{ scrollbarWidth: 'thin' }}
    >
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-12 sm:py-20">
        {paragraphs.map((p, index) => (
          <p
            key={p.id}
            // CORRECTED: The ref callback now uses curly braces `{}` to ensure a `void` return type.
            ref={el => { paragraphRefs.current[index] = el; }}
            className={`
              text-lg sm:text-xl leading-relaxed mb-6 font-serif transition-all duration-500 ease-in-out
              ${isPlaying 
                ? (index === currentParagraphIndex ? 'opacity-100 font-bold text-black' : 'opacity-40 text-gray-500')
                : 'opacity-100'
              }
            `}
          >
            {p.content}
          </p>
        ))}
      </div>
    </div>
  );
}