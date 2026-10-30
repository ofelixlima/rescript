"use client";

export type MediaEngineSupport = "checking" | "ready" | "no-isolation" | "no-simd";

export function useMediaEngineSupport(): MediaEngineSupport {
  return "ready";
}
