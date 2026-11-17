import { getCutRanges, isWordCutOut } from "./edits";
import { VAD_SAMPLE_RATE } from "./vad";
import { peakBetween, type WaveformPeaks } from "./waveform";
import type { ManualCut, TimeRange, Word } from "./types";

export const MIN_SILENCE_DURATION = 0.35;
export const SILENCE_PAD = 0.05;
export const PAD_BEFORE_SPEECH = 0.12;
export const PAD_AFTER_SPEECH = 0.15;

const SCAN_STEP_S = 0.01;
const MIN_VOICE_THRESHOLD = 0.015;
const MAX_VOICE_THRESHOLD = 0.12;
const NOISE_MULTIPLIER = 2.4;

function estimateSpeechThreshold(
  peaks: WaveformPeaks,
  candidateGaps: TimeRange[],
  sampleRate = VAD_SAMPLE_RATE
): number {
  const quietSamples: number[] = [];
  for (const gap of candidateGaps) {
    const startSample = Math.floor(gap.start * sampleRate);
    const endSample = Math.floor(gap.end * sampleRate);
    const stepSamples = Math.max(1, Math.floor(SCAN_STEP_S * sampleRate));
    for (let s = startSample; s + stepSamples <= endSample; s += stepSamples) {
      quietSamples.push(peakBetween(peaks, s, s + stepSamples));
    }
  }
  if (quietSamples.length === 0) return 0.025;
  quietSamples.sort((a, b) => a - b);
  const p35 = quietSamples[Math.floor(quietSamples.length * 0.35)] ?? 0.008;
  return Math.min(
    MAX_VOICE_THRESHOLD,
    Math.max(MIN_VOICE_THRESHOLD, p35 * NOISE_MULTIPLIER)
  );
}

function extractQuietSubranges(
  peaks: WaveformPeaks,
  range: TimeRange,
  threshold: number,
  padAfterSpeech: boolean,
  padBeforeSpeech: boolean,
  minDuration: number,
  sampleRate = VAD_SAMPLE_RATE
): TimeRange[] {
  const stepSamples = Math.max(1, Math.floor(SCAN_STEP_S * sampleRate));
  const totalSteps = Math.floor((range.end - range.start) / SCAN_STEP_S);
  if (totalSteps <= 0) return [];

  const quietRuns: TimeRange[] = [];
  let runStart: number | null = null;

  for (let i = 0; i < totalSteps; i++) {
    const t0 = range.start + i * SCAN_STEP_S;
    const t1 = Math.min(range.end, t0 + SCAN_STEP_S);
    const s0 = Math.floor(t0 * sampleRate);
    const s1 = Math.max(s0 + 1, Math.floor(t1 * sampleRate));
    const amp = peakBetween(peaks, s0, s1);

    if (amp <= threshold) {
      if (runStart === null) runStart = t0;
    } else if (runStart !== null) {
      quietRuns.push({ start: runStart, end: t0 });
      runStart = null;
    }
  }
  if (runStart !== null) {
    quietRuns.push({ start: runStart, end: range.end });
  }

  const valid: TimeRange[] = [];
  for (const run of quietRuns) {
    const touchesStart = Math.abs(run.start - range.start) <= SCAN_STEP_S * 1.5;
    const touchesEnd = Math.abs(run.end - range.end) <= SCAN_STEP_S * 1.5;
    const leftPad = touchesStart && !padAfterSpeech ? 0 : PAD_AFTER_SPEECH;
    const rightPad = touchesEnd && !padBeforeSpeech ? 0 : PAD_BEFORE_SPEECH;

    const cutStart = run.start + leftPad;
    const cutEnd = run.end - rightPad;

    if (cutEnd - cutStart >= minDuration - 1e-4) {
      valid.push({ start: cutStart, end: cutEnd });
    }
  }
  return valid;
}

export function findSilenceCuts(
  words: Word[],
  manualCuts: ManualCut[]
): TimeRange[] {
  return manualCuts
    .filter(
      (c) =>
        c.end - c.start > 1e-4 &&
        !words.some((w) => w.end > c.start + 1e-4 && w.start < c.end - 1e-4)
    )
    .map((c) => ({ start: c.start, end: c.end }));
}

function subtractCuts(range: TimeRange, cuts: TimeRange[]): TimeRange[] {
  let parts: TimeRange[] = [range];
  for (const cut of cuts) {
    parts = parts.flatMap((p) => {
      if (cut.end <= p.start + 1e-4 || cut.start >= p.end - 1e-4) return [p];
      const out: TimeRange[] = [];
      if (cut.start > p.start + 1e-4) out.push({ start: p.start, end: cut.start });
      if (cut.end < p.end - 1e-4) out.push({ start: cut.end, end: p.end });
      return out;
    });
  }
  return parts;
}

export function findSilenceRanges(
  words: Word[],
  duration: number,
  manualCuts: ManualCut[] = [],
  waveform: WaveformPeaks | null = null,
  minDuration = MIN_SILENCE_DURATION
): TimeRange[] {
  if (duration <= 0) return [];

  const cuts = getCutRanges(words, duration, manualCuts);
  const kept = words
    .filter((w) => !isWordCutOut(w, cuts))
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);

  type Gap = { start: number; end: number; padStart: boolean; padEnd: boolean };
  const gaps: Gap[] = [];
  let cursor = 0;
  let prevWasSpeech = false;

  for (const w of kept) {
    const searchStart = prevWasSpeech
      ? Math.max(0, cursor - PAD_AFTER_SPEECH)
      : cursor;
    const searchEnd = Math.min(duration, w.start + PAD_BEFORE_SPEECH);

    if (searchEnd > searchStart + 1e-4) {
      gaps.push({
        start: searchStart,
        end: searchEnd,
        padStart: prevWasSpeech,
        padEnd: true,
      });
    }
    cursor = Math.max(cursor, w.end);
    prevWasSpeech = true;
  }

  if (duration > cursor + 1e-4) {
    const searchStart = prevWasSpeech
      ? Math.max(0, cursor - PAD_AFTER_SPEECH)
      : cursor;
    gaps.push({
      start: searchStart,
      end: duration,
      padStart: prevWasSpeech,
      padEnd: false,
    });
  }

  const candidateParts: Array<{
    range: TimeRange;
    padAfterSpeech: boolean;
    padBeforeSpeech: boolean;
  }> = [];

  for (const gap of gaps) {
    if (gap.end - gap.start < minDuration - 1e-4) continue;
    for (const part of subtractCuts(
      { start: gap.start, end: gap.end },
      cuts
    )) {
      if (part.end - part.start < minDuration - 1e-4) continue;
      const padAfterSpeech =
        gap.padStart && Math.abs(part.start - gap.start) < 1e-4;
      const padBeforeSpeech =
        gap.padEnd && Math.abs(part.end - gap.end) < 1e-4;
      candidateParts.push({ range: part, padAfterSpeech, padBeforeSpeech });
    }
  }

  if (!waveform) {
    const out: TimeRange[] = [];
    for (const item of candidateParts) {
      const start = item.range.start + (item.padAfterSpeech ? PAD_AFTER_SPEECH : 0);
      const end = item.range.end - (item.padBeforeSpeech ? PAD_BEFORE_SPEECH : 0);
      if (end - start >= minDuration - 1e-4) out.push({ start, end });
    }
    return out;
  }

  const threshold = estimateSpeechThreshold(
    waveform,
    candidateParts.map((c) => c.range)
  );

  const out: TimeRange[] = [];
  for (const item of candidateParts) {
    const refined = extractQuietSubranges(
      waveform,
      item.range,
      threshold,
      item.padAfterSpeech,
      item.padBeforeSpeech,
      minDuration
    );
    out.push(...refined);
  }
  return out;
}