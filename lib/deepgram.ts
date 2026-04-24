import type { RecallTranscriptSegment } from "./recall";

const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";

interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  speaker?: number;
  start: number;
  end: number;
}

interface DeepgramUtterance {
  speaker: number;
  words: DeepgramWord[];
  transcript: string;
}

interface DeepgramResponse {
  results?: {
    utterances?: DeepgramUtterance[];
    channels?: {
      alternatives?: {
        words?: DeepgramWord[];
        transcript?: string;
      }[];
    }[];
  };
}

/**
 * Transcribe a remote audio URL with Deepgram and return segments in the same
 * shape our existing pipeline (Claude brief + Gamma deck) consumes.
 *
 * We use `utterances=true` + `diarize=true` so Deepgram groups speaker turns
 * for us — much closer to Recall's segment shape than raw word-level output.
 */
export async function transcribeAudioUrl(audioUrl: string): Promise<RecallTranscriptSegment[]> {
  const res = await fetch(
    `${DEEPGRAM_URL}?model=nova-2&diarize=true&utterances=true&smart_format=true&punctuate=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl }),
    }
  );

  if (!res.ok) {
    throw new Error(`Deepgram error ${res.status}: ${await res.text()}`);
  }

  const data: DeepgramResponse = await res.json();
  return adaptDeepgramToSegments(data);
}

function adaptDeepgramToSegments(data: DeepgramResponse): RecallTranscriptSegment[] {
  const utterances = data.results?.utterances;
  if (utterances && utterances.length > 0) {
    return utterances.map((u) => ({
      speaker: `Speaker ${u.speaker}`,
      words: u.words.map((w) => ({ text: w.punctuated_word ?? w.word })),
    }));
  }

  // Fallback: no utterance grouping — synthesize segments by speaker runs from
  // word-level output.
  const words = data.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  if (words.length === 0) return [];

  const segments: RecallTranscriptSegment[] = [];
  let currentSpeaker: number | undefined;
  let currentWords: { text: string }[] = [];

  const flush = () => {
    if (currentWords.length > 0) {
      segments.push({
        speaker: currentSpeaker !== undefined ? `Speaker ${currentSpeaker}` : "Unknown",
        words: currentWords,
      });
    }
  };

  for (const w of words) {
    if (w.speaker !== currentSpeaker) {
      flush();
      currentSpeaker = w.speaker;
      currentWords = [];
    }
    currentWords.push({ text: w.punctuated_word ?? w.word });
  }
  flush();
  return segments;
}
