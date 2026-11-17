"use client";

import { useCallback, useEffect, useRef } from "react";
import { transcribeWithFreeLlmApi } from "@/lib/freellmapi";
import { en } from "@/lib/i18n/messages/en";
import { isModelId } from "@/lib/models";
import { reportError } from "@/lib/sentry";
import { useEditorStore } from "@/lib/store";
import { trackEvent } from "@/lib/telemetry";
import type { WorkerResponse } from "@/lib/types";

let activeWorker: Worker | null = null;

/** Stop an in-flight ASR job (e.g. after importing a transcript). */
export function cancelTranscription() {
  activeWorker?.terminate();
  activeWorker = null;
}

/** Owns the transcription web worker and pipes its messages into the store. */
export function useTranscriber() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      cancelTranscription();
      workerRef.current = null;
    };
  }, []);

  const transcribe = useCallback((audio: Float32Array, duration: number) => {
    const store = useEditorStore.getState();
    if (!isModelId(store.source)) {
      store.setError(en["error.selectModel"]);
      return;
    }
    const model = store.source;
    const transcriptLanguage = store.transcriptLanguage;
    store.setStatus("transcribing");
    store.setProgress({ message: en["progress.loadingSpeechModel"], value: null });

    cancelTranscription();

    if (model === "freellmapi") {
      store.setProgress({
        message: "Transcrevendo via FreeLLMAPI (Nuvem)...",
        value: null,
      });
      void transcribeWithFreeLlmApi(audio, transcriptLanguage)
        .then((words) => {
          const s = useEditorStore.getState();
          if (s.skipTranscription) return;
          s.setWords(words);
          s.setStatus("ready");
          s.setPartialText("");
          trackEvent("transcription_completed", {
            model,
            language: transcriptLanguage,
          });
        })
        .catch((err: unknown) => {
          const s = useEditorStore.getState();
          if (s.skipTranscription) return;
          const message =
            err instanceof Error
              ? err.message
              : "Falha ao transcrever via FreeLLMAPI.";
          s.setError(message);
        });
      return;
    }

    workerRef.current = new Worker(
      new URL("../workers/transcription.worker.ts", import.meta.url),
      { type: "module" }
    );
    activeWorker = workerRef.current;
    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const s = useEditorStore.getState();
      if (s.skipTranscription) return;
      const msg = event.data;
      switch (msg.type) {
        case "progress":
          s.setProgress({ message: msg.message, value: msg.value });
          break;
        case "partial":
          s.setPartialText(msg.text);
          break;
        case "complete":
          s.setWords(msg.words);
          s.setStatus("ready");
          s.setPartialText("");
          trackEvent("transcription_completed", {
            model,
            language: transcriptLanguage,
          });
          cancelTranscription();
          workerRef.current = null;
          break;
        case "error":
          s.setError(msg.message);
          if (msg.cause !== "network") {
            reportError(new Error(msg.message), "transcription");
          }
          break;
      }
    };
    workerRef.current.onerror = (err) => {
      const s = useEditorStore.getState();
      if (s.skipTranscription) return;
      s.setError(err.message || en["error.workerCrashed"]);
      reportError(
        new Error(err.message || en["error.workerCrashed"]),
        "transcription-worker"
      );
    };

    workerRef.current.postMessage(
      { audio, duration, model, language: transcriptLanguage },
      [audio.buffer]
    );
  }, []);

  return { transcribe, cancel: cancelTranscription };
}
