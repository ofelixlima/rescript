import { loadFreeLlmApiConfig } from "./freellmapi";
import type { Word } from "./types";

export interface AiEditResult {
  mode: "roteirizado" | "organico";
  deleteIds: number[];
  corrections: Record<number, string>;
}

const SYSTEM_PROMPT = `Você é um editor de vídeo baseado em texto. Analise a transcrição indexada por [ID] e retorne APENAS um objeto JSON válido (sem markdown, sem explicações).

REGRAS DE DECISÃO (CAUSA E EFEITO):
1. Classifique a transcrição completa em "roteirizado" (frases planejadas para um tema específico) ou "organico" (fala espontânea e improvisada em torno de um tema).
2. NUNCA adicione palavras novas. Apenas corrija a grafia de termos mal transcritos (ex: nomes próprios, marcas, acentuação) no mapa "corrections" mantendo exatamente 1 palavra por ID.
3. Respeite os silêncios já existentes e NUNCA corte palavras isoladas no meio de uma frase íntegra. Corte apenas blocos de erro de gravação, recomeços de frase, gagueiras repetidas ou desvios completamente mortos.
4. Se mode === "roteirizado": sustente o trilho lógico semântico entre uma frase e outra em torno do assunto central do vídeo, sendo flexível quando o roteiro mudar naturalmente de subtópico dentro do mesmo tema principal.
5. Se mode === "organico": ignore a exigência de encadeamento rígido frase-a-frase e avalie apenas se a fala gira em torno do assunto núcleo do vídeo.

FORMATO DE SAÍDA OBRIGATÓRIO:
{
  "mode": "roteirizado" | "organico",
  "deleteIds": [12, 13, 14],
  "corrections": { "25": "grafiaCorreta" }
}`;

export async function runAiTranscriptEdit(
  activeWords: Word[]
): Promise<AiEditResult> {
  const cfg = loadFreeLlmApiConfig();
  if (!cfg.apiKey) {
    throw new Error(
      "Chave do FreeLLMAPI não configurada. Abra as Configurações e cole sua API Key."
    );
  }

  if (activeWords.length === 0) {
    throw new Error("Não há palavras ativas na transcrição para editar.");
  }

  const indexedText = activeWords
    .map((w) => `[${w.id}] ${w.text}`)
    .join(" ");

  const targetUrl = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch("/api/freellmapi", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      "x-target-url": targetUrl,
    },
    body: JSON.stringify({
      model: "auto",
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: indexedText },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Erro no FreeLLMAPI (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawContent = data.choices?.[0]?.message?.content?.trim() ?? "";
  const cleaned = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<AiEditResult>;
  const validIds = new Set(activeWords.map((w) => w.id));

  const deleteIds = Array.isArray(parsed.deleteIds)
    ? parsed.deleteIds
        .map((id) => Number(id))
        .filter((id) => validIds.has(id))
    : [];

  const corrections: Record<number, string> = {};
  if (parsed.corrections && typeof parsed.corrections === "object") {
    for (const [k, v] of Object.entries(parsed.corrections)) {
      const id = Number(k);
      if (!validIds.has(id) || typeof v !== "string") continue;
      const singleToken = v.trim().split(/\s+/)[0];
      if (singleToken) {
        corrections[id] = singleToken;
      }
    }
  }

  return {
    mode: parsed.mode === "roteirizado" ? "roteirizado" : "organico",
    deleteIds,
    corrections,
  };
}
