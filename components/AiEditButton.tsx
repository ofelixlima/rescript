"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { runAiTranscriptEdit } from "@/lib/aiEdit";
import { isWordCutOut } from "@/lib/edits";
import { useEditorStore } from "@/lib/store";
import { useCutRanges } from "@/hooks/useCutRanges";

export default function AiEditButton() {
  const words = useEditorStore((s) => s.words);
  const deleteWords = useEditorStore((s) => s.deleteWords);
  const correctWords = useEditorStore((s) => s.correctWords);
  const cuts = useCutRanges();

  const [loading, setLoading] = useState(false);
  const [badge, setBadge] = useState<string | null>(null);

  async function handleAiEdit() {
    if (loading) return;
    const activeWords = words.filter((w) => !w.deleted && !isWordCutOut(w, cuts));
    if (activeWords.length === 0) return;

    setLoading(true);
    setBadge(null);

    try {
      const result = await runAiTranscriptEdit(activeWords);

      for (const [idStr, newText] of Object.entries(result.corrections)) {
        const id = Number(idStr);
        const current = activeWords.find((w) => w.id === id);
        if (current && current.text !== newText) {
          correctWords([id], newText);
        }
      }

      if (result.deleteIds.length > 0) {
        deleteWords(result.deleteIds);
      }

      const modeLabel =
        result.mode === "roteirizado" ? "Roteirizado" : "Orgânico";
      const corrCount = Object.keys(result.corrections).length;
      setBadge(`${modeLabel} · -${result.deleteIds.length}w / ~${corrCount}c`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao editar com IA.";
      setBadge(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {badge && (
        <span
          title={badge}
          className="max-w-[11rem] truncate rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {badge}
        </span>
      )}
      <button
        type="button"
        onClick={() => void handleAiEdit()}
        disabled={loading || words.length === 0}
        title="Classificar vídeo (Roteirizado/Orgânico), corrigir grafia e cortar falhas com IA"
        className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} />
        )}
        <span>Editar com IA</span>
      </button>
    </div>
  );
}
