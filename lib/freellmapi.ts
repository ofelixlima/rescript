import type { TranscriptLanguage } from "./languages";
import type { Word } from "./types";
import { VAD_SAMPLE_RATE } from "./vad";

export interface FreeLlmApiConfig {
  baseUrl: string;
  apiKey: string;
  audioModel: string;
}

const STORAGE_KEY = "rescript.freellmapi";

const DEFAULT_CONFIG: FreeLlmApiConfig = {
  baseUrl: "http://127.0.0.1:31415/v1",
  apiKey: "",
  audioModel: "whisper-large-v3-turbo",
};

export function loadFreeLlmApiConfig(): FreeLlmApiConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<FreeLlmApiConfig>;
    return {
      baseUrl: parsed.baseUrl?.trim() || DEFAULT_CONFIG.baseUrl,
      apiKey: parsed.apiKey?.trim() || "",
      audioModel: parsed.audioModel?.trim() || DEFAULT_CONFIG.audioModel,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveFreeLlmApiConfig(config: FreeLlmApiConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        baseUrl: config.baseUrl.trim() || DEFAULT_CONFIG.baseUrl,
        apiKey: config.apiKey.trim(),
        audioModel: config.audioModel.trim() || DEFAULT_CONFIG.audioModel,
      })
    );
  } catch {
    // storage unavailable
  }
}

function encodeWav16k(samples: Float32Array, sampleRate = VAD_SAMPLE_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function distributeSegmentWords(
  text: string,
  segStart: number,
  segEnd: number,
  startId: number
): Word[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const duration = Math.max(0.05 * tokens.length, segEnd - segStart);
  const totalChars = tokens.reduce((acc, t) => acc + Math.max(1, t.length), 0);
  let cursor = segStart;
  let id = startId;
  const out: Word[] = [];

  for (const token of tokens) {
    const share = (Math.max(1, token.length) / totalChars) * duration;
    const wStart = cursor;
    const wEnd = Math.max(wStart + 0.02, cursor + share);
    out.push({
      id: id++,
      text: token,
      start: wStart,
      end: wEnd,
      speaker: 0,
      deleted: false,
    });
    cursor = wEnd;
  }
  return out;
}

export async function transcribeWithFreeLlmApi(
  audio: Float32Array,
  language: TranscriptLanguage
): Promise<Word[]> {
  const cfg = loadFreeLlmApiConfig();
  if (!cfg.apiKey) {
    throw new Error(
      "Chave do FreeLLMAPI não configurada. Abra as Configurações (engrenagem) e cole sua API Key."
    );
  }

  const totalAudioSeconds = audio.length / VAD_SAMPLE_RATE;
  const wavBlob = encodeWav16k(audio, VAD_SAMPLE_RATE);
  const form = new FormData();
  form.append("file", wavBlob, "audio.wav");
  form.append("model", cfg.audioModel);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  if (language) {
    form.append("language", language);
  }

  const targetUrl = `${cfg.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`;
  const res = await fetch("/api/freellmapi", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "x-target-url": targetUrl,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Erro no FreeLLMAPI (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    text?: string;
    words?: Array<{ word?: string; text?: string; start?: number; end?: number }>;
    segments?: Array<{
      text?: string;
      start?: number;
      end?: number;
      words?: Array<{ word?: string; text?: string; start?: number; end?: number }>;
    }>;
  };

  console.log("[FreeLLMAPI] Resposta de transcrição:", data);

  const rawWords =
    data.words && data.words.length > 0
      ? data.words
      : (data.segments ?? []).flatMap((seg) => seg.words ?? []);

  if (rawWords.length > 0) {
    const words: Word[] = [];
    let id = 1;
    for (const item of rawWords) {
      const text = (item.word ?? item.text ?? "").trim();
      if (!text) continue;
      const start = Number(item.start ?? 0);
      const end = Math.max(start + 0.02, Number(item.end ?? start + 0.05));
      words.push({
        id: id++,
        text,
        start,
        end,
        speaker: 0,
        deleted: false,
      });
    }
    if (words.length > 0) return words;
  }

  if (Array.isArray(data.segments) && data.segments.length > 0) {
    const words: Word[] = [];
    let nextId = 1;
    for (const seg of data.segments) {
      if (!seg.text) continue;
      const segWords = distributeSegmentWords(
        seg.text,
        Number(seg.start ?? 0),
        Number(seg.end ?? Number(seg.start ?? 0) + 0.5),
        nextId
      );
      words.push(...segWords);
      nextId += segWords.length;
    }
    if (words.length > 0) return words;
  }

  if (typeof data.text === "string" && data.text.trim().length > 0) {
    return distributeSegmentWords(data.text, 0, Math.max(1, totalAudioSeconds), 1);
  }

  throw new Error(
    `O FreeLLMAPI retornou uma resposta vazia. Chaves recebidas: ${Object.keys(data).join(", ")}`
  );
}
