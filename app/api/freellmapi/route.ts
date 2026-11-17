import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const target = req.headers.get("x-target-url") || "http://127.0.0.1:31415/v1/models";
  const auth = req.headers.get("authorization") || "";

  try {
    const res = await fetch(target, {
      headers: { Authorization: auth },
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao conectar no FreeLLMAPI" },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const target =
    req.headers.get("x-target-url") ||
    "http://127.0.0.1:31415/v1/audio/transcriptions";
  const auth = req.headers.get("authorization") || "";

  try {
    const formData = await req.formData();
    const res = await fetch(target, {
      method: "POST",
      headers: { Authorization: auth },
      body: formData,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao transcrever via FreeLLMAPI" },
      { status: 502 }
    );
  }
}
