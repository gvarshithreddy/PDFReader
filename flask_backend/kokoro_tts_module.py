# kokoro_tts_module.py

import os
import soundfile as sf
from kokoro import KPipeline

# --- Global TTS Pipeline Instance ---
# This will be initialized once when the module is first imported.
# It ensures the model is loaded only once and reused across all audio generation calls.
_kokoro_pipeline = None

def initialize_kokoro_pipeline(lang_code='a'):
    """
    Initializes and returns the Kokoro TTS KPipeline instance.
    This function should be called once at the start of your application.
    """
    global _kokoro_pipeline
    if _kokoro_pipeline is None:
        try:
            _kokoro_pipeline = KPipeline(lang_code=lang_code)
            print(f"Kokoro TTS pipeline initialized for language: '{lang_code}'")
        except Exception as e:
            print(f"Error initializing Kokoro TTS pipeline: {e}")
            print("Please ensure 'espeak-ng' is installed and your Kokoro environment is correctly set up locally.")
            raise  # Re-raise to signal initialization failure
    return _kokoro_pipeline

def generate_tts_audio(text_chunk: str, segment_index: int, output_dir: str, voice_name: str = 'am_michael') -> str:
    """
    Generates audio for a given text chunk using the initialized Kokoro TTS pipeline
    and saves it to a WAV file.

    Args:
        text_chunk (str): The text to convert to speech.
        segment_index (int): A unique index for the audio segment (used for filename).
        output_dir (str): The directory where the audio file will be saved.
        voice_name (str): The name of the voice to use (e.g., 'am_michael').

    Returns:
        str: The path to the saved audio file, or an empty string if generation failed.
    """
    if _kokoro_pipeline is None:
        raise RuntimeError("Kokoro TTS pipeline not initialized. Call initialize_kokoro_pipeline() first.")

    os.makedirs(output_dir, exist_ok=True)
    output_filepath = os.path.join(output_dir, f"audio_segment_{segment_index:04d}.wav")

    try:
        # Generate audio. The KPipeline object is designed for concurrent inference.
        generator = _kokoro_pipeline(text_chunk, voice=voice_name)
        audio_segments = []
        for i, (gs, ps, audio_array) in enumerate(generator):
            audio_segments.append(audio_array)
            # You can print internal details here if needed, but keep it concise for concurrent tasks
            # print(f"  [TTS Segment {segment_index}-{i}] Text: {gs[:50]}...")
            # print(f"  [TTS Segment {segment_index}-{i}] Phonemes: {ps}")

        if audio_segments:
            import numpy as np
            final_audio = np.concatenate(audio_segments)
            sf.write(output_filepath, final_audio, 24000) # Kokoro's sample rate is usually 24kHz
            return output_filepath
        else:
            print(f"Warning: No audio data generated for segment {segment_index} (Text: '{text_chunk[:70]}...')")
            return ""
    except Exception as e:
        print(f"Error generating audio for segment {segment_index} (Text: '{text_chunk[:70]}...'): {e}")
        return ""

if __name__ == '__main__':
    # Example usage when running this module directly for testing
    initialize_kokoro_pipeline(lang_code='a')
    test_text = """One frequent guest was a technology executive. He was a 
genius, having designed and patented a key component in Wi-Fi 
routers in his 20s. He had started and sold several companies. He 
was wildly successful. 
He also had a relationship with money I’d describe as a mix of 
insecurity and childish stupidity. 
He carried a stack of hundred dollar bills several inches thick. 
He showed it to everyone who wanted to see it and many who 
didn’t. He bragged openly and loudly about his wealth, often 
while drunk and always apropos of nothing. 
One day he handed one of my colleagues several thousand 
dollars of cash and said, “Go to the jewelry store down the street 
and get me a few $1,000 gold coins.”
 An hour later, gold coins in hand, the tech executive and his 
buddies gathered around by a dock overlooking the Pacific Ocean. 
T
 hey then proceeded to throw the coins into the sea, skipping them 
like rocks, cackling as they argued whose went furthest. Just for fun. 
Days later he shattered a lamp in the hotel’s restaurant. A 
manager told him it was a $500 lamp and he’d have to replace it. 
1
 
THE PSYCHOLOGY OF MONEY
 “You want five hundred dollars?” the executive asked 
incredulously, while pulling a brick of cash from his pocket and 
handing it to the manager. “Here’s five thousand dollars. Now get 
out of my face. And don’t ever insult me like that again.” 
You may wonder how long this behavior could last, and the 
answer was “not long.” I learned years later that he went broke. 
T
 he premise of this book is that doing well with money has a 
little to do with how smart you are and a lot to do with how you 
behave. And behavior is hard to teach, even to really smart people. 
A genius who loses control of their emotions can be a financial 
disaster. The opposite is also true. Ordinary folks with no financial 
education can be wealthy if they have a handful of behavioral skills 
that have nothing to do with formal measures of intelligence. 
***
 My favorite Wikipedia entry begins: “Ronald James Read was 
an American philanthropist, investor, janitor, and gas station 
attendant.”
 Ronald Read was born in rural Vermont. He was the first 
person in his family to graduate high school, made all the more 
impressive by the fact that he hitchhiked to campus each day. 
For those who knew Ronald Read, there wasn’t much else 
worth mentioning. His life was about as low key as they come.  
Read fixed cars at a gas station for 25 years and swept floors 
at JCPenney for 17 years. He bought a two-bedroom house for 
$12,000 at age 38 and lived there for the rest of his life. He was 
widowed at age 50 and never remarried. A friend recalled that his 
main hobby was chopping firewood. 
Read died in 2014, age 92. Which is when the humble rural 
janitor made international headlines. 
2,813,503 Americans died in 2014. Fewer than 4,000 of them 
had a net worth of over $8 million when they passed away. Ronald 
Read was one of them. """
    output_path = generate_tts_audio(test_text, 0, "test_audio_output", "am_michael")
    if output_path:
        print(f"Test audio saved to: {output_path}")
    else:
        print("Test audio generation failed.")

    test_text_2 = "Here is a second sentence for testing multi-segment output."
    output_path_2 = generate_tts_audio(test_text_2, 1, "test_audio_output", "af_nicole")
    if output_path_2:
        print(f"Second test audio saved to: {output_path_2}")
    else:
        print("Second test audio generation failed.")