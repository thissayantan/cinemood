/**
 * use-speech-recognition.ts — wraps the Web Speech API.
 *
 * Returns { supported, listening, transcript, interimTranscript, start, stop, error }.
 * - `transcript`        — the latest *final* result (committed text).
 * - `interimTranscript` — partial/in-progress result (real-time as the user speaks).
 * - `start()` requests mic permission and begins recognition.
 * - `stop()`  aborts the current session.
 *
 * Graceful no-op when unsupported (Firefox desktop, Safari <14.1, Node test env).
 * Permission denial sets `error` to a user-readable string and `supported` stays
 * true (the API exists, the permission was denied — different failure modes).
 */

import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is not in the standard TypeScript lib — declare the minimum
// shape we need rather than pulling in a third-party types package.
interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  clearTranscript: () => void;
}

function getSpeechRecognitionCtor(): (new () => ISpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const Ctor = getSpeechRecognitionCtor();
  const supported = Ctor !== null;

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;

    // Stop any existing session first.
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    setError(null);
    setInterimTranscript("");

    const recognition = new Ctor();
    recognition.continuous = false;      // single utterance → fires onend automatically
    recognition.interimResults = true;   // stream interim results for real-time feedback
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let finalPart = "";
      let interimPart = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalPart += text;
        else interimPart += text;
      }
      if (finalPart) setTranscript((prev) => (prev + " " + finalPart).trim());
      setInterimTranscript(interimPart);
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission denied. Allow access in your browser settings.");
      } else if (event.error === "no-speech") {
        setError(null); // silently ignore — user didn't speak
      } else {
        setError(`Voice error: ${event.error}`);
      }
      setListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      // start() throws DOMException if already started — shouldn't happen but guard it.
      setError("Could not start voice input.");
      setListening(false);
    }
  }, [Ctor]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterimTranscript("");
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return { supported, listening, transcript, interimTranscript, error, start, stop, clearTranscript };
}
