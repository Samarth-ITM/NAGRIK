"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";

interface VoiceRecorderInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function VoiceRecorderInput({
  value,
  onChange,
  placeholder = "Describe what was fixed on-site (e.g., Pothole filled with cold asphalt mix and compacted)...",
  label = "What did you fix? (Repair Description)",
}: VoiceRecorderInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "";

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await handleTranscription(audioBlob);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn("Microphone error:", err);
      setErrorMsg("The microphone isn't available. Allow microphone access in your browser, or type instead.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "field-repair-note.webm");

      const res = await fetch("/api/ai/transcribe-voice", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.transcript) {
        const cleanTranscript = data.transcript.trim();
        onChange(value ? `${value.trim()} ${cleanTranscript}` : cleanTranscript);
      } else {
        setErrorMsg(data.error || "That recording wasn't clear enough to turn into text. Try again closer to the phone, or type instead.");
      }
    } catch (err: any) {
      console.error("Transcription fetch error:", err);
      setErrorMsg("Couldn't reach the server to transcribe. Check your connection, or type instead.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const fieldId = useId();

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>

      <div className="mt-2 rounded-xl border border-slate-300 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition">
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={placeholder}
          className="block w-full resize-y rounded-t-xl bg-transparent px-3.5 pt-3 pb-2 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-2.5 py-2">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={isTranscribing}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-sm font-semibold text-slate-800 hover:bg-slate-200 transition disabled:opacity-50"
            >
              <Mic className="w-4 h-4" aria-hidden />
              Record voice note
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition"
            >
              <MicOff className="w-4 h-4" aria-hidden />
              Stop, {formatSeconds(recordingDuration)}
            </button>
          )}

          <span className="text-sm text-slate-500" aria-live="polite">
            {isRecording ? (
              <span className="inline-flex items-center gap-1.5 text-red-700">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" aria-hidden />
                Listening
              </span>
            ) : isTranscribing ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Turning your voice note into text
              </span>
            ) : (
              "Speak in English, हिन्दी or मराठी, or type."
            )}
          </span>
        </div>
      </div>

      {errorMsg && <p className="mt-2 text-sm text-amber-800">{errorMsg}</p>}
    </div>
  );
}
