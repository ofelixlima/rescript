/** Local speech models offered on the upload screen. */
export type WhisperModel =
  | "base"
  | "small"
  // | "medium"
  /** CrisperWhisper 2.0 Small, exported by tools/crisperwhisper-onnx. */
  // | "crisperSmall"
  /** CrisperWhisper 2.0 Turbo, published ONNX export. */
  // | "crisperTurbo";
/** NVIDIA Parakeet TDT 0.6B v3 via parakeet.js (ONNX / WebGPU). */
export type ParakeetModel = "parakeet";
export type FreeLlmApiModel = "freellmapi";
export type ModelId = WhisperModel | ParakeetModel | FreeLlmApiModel;

type DType = "fp32" | "fp16" | "q8" | "int8" | "uint8" | "q4" | "q4f16" | "bnb4";

/** Shared UI fields for every speech backend. */
type ModelDisplay = {
  label: string;
  description: string;
  /** Approximate download size shown in the UI. */
  size: string;
};

export type WhisperModelInfo = ModelDisplay & {
  backend: "whisper";
  id: string;
  dtype: {
    webgpu: Record<string, DType>;
    wasm: Record<string, DType>;
  };
  crisper?: boolean;
  local?: boolean;
};

export type ParakeetModelInfo = ModelDisplay & {
  backend: "parakeet";
  id: string;
  repoId: string;
};

export type FreeLlmApiModelInfo = ModelDisplay & {
  backend: "freellmapi";
  id: string;
};

export type ModelInfo = WhisperModelInfo | ParakeetModelInfo | FreeLlmApiModelInfo;

/** Display order for model rows in the source dropdown. */
export const MODEL_ORDER: ModelId[] = [
  "base",
  "small",
  "parakeet",
  "freellmapi",
];

const WHISPER_DTYPE = {
  webgpu: { encoder_model: "fp32", decoder_model_merged: "q4" },
  wasm: { encoder_model: "fp32", decoder_model_merged: "q4" },
} satisfies WhisperModelInfo["dtype"];

export const MODELS: {
  base: WhisperModelInfo;
  small: WhisperModelInfo;
  parakeet: ParakeetModelInfo;
  freellmapi: FreeLlmApiModelInfo;
} = {
  base: {
    backend: "whisper",
    id: "onnx-community/whisper-base_timestamped",
    label: "Whisper Base",
    description: "Faster download and transcription. Good for most clips.",
    size: "~200 MB",
    dtype: WHISPER_DTYPE,
  },
  small: {
    backend: "whisper",
    id: "onnx-community/whisper-small_timestamped",
    label: "Whisper Small",
    description: "More accurate on longer or noisier audio. Larger download.",
    size: "~600 MB",
    dtype: WHISPER_DTYPE,
  },
  parakeet: {
    backend: "parakeet",
    id: "parakeet-tdt-0.6b-v3",
    repoId: "ysdede/parakeet-tdt-0.6b-v3-onnx",
    label: "Parakeet v3",
    description:
      "NVIDIA FastConformer — faster on WebGPU, strong EU-language accuracy. Auto-detects language.",
    size: "~1.3 GB",
  },
  freellmapi: {
    backend: "freellmapi",
    id: "freellmapi-hub",
    label: "FreeLLMAPI (Nuvem)",
    description:
      "Usa o hub local FreeLLMAPI (127.0.0.1:31415) para transcrever na nuvem sem pesar na máquina.",
    size: "Nuvem",
  },
};

export function isCrisperModel(model: ModelId): boolean {
  const info = MODELS[model];
  return info.backend === "whisper" && info.crisper === true;
}

export function isLocalModel(model: ModelId): boolean {
  const info = MODELS[model];
  return info.backend === "whisper" && info.local === true;
}

export function isWhisperModel(value: unknown): value is WhisperModel {
  return (
    value === "base" ||
    value === "small" ||
    value === "medium" ||
    value === "crisperSmall" ||
    value === "crisperTurbo"
  );
}

export function isParakeetModel(value: unknown): value is ParakeetModel {
  return value === "parakeet";
}

export function isFreeLlmApiModel(value: unknown): value is FreeLlmApiModel {
  return value === "freellmapi";
}

export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MODELS, value);
}

const MODEL_STORAGE_KEY = "rescript.model";

export function loadModelPreference(): ModelId {
  if (typeof window === "undefined") return "base";
  try {
    const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (isModelId(raw)) return raw;
  } catch {
    // private mode / disabled storage
  }
  return "base";
}

export function saveModelPreference(model: ModelId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch {
    // private mode / disabled storage
  }
}
