import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob;
    if (!audio) return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    const backendForm = new FormData();
    backendForm.append("audio", audio, "recording.webm");
    const response = await fetch("http://localhost:8000/transcribe", { method: "POST", body: backendForm });
    if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
    const data = await response.json();
    return NextResponse.json({ transcript: data.transcript });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
