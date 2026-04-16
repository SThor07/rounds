import { NextRequest, NextResponse } from "next/server";

const SOAP_SYSTEM_PROMPT = `You are a clinical documentation assistant. Given a doctor-patient consultation transcript, generate a structured SOAP note and patient summary.

CRITICAL RULES:
- Extract only what was explicitly mentioned. Never fabricate clinical details.
- If a section has no information, write "Not documented in this session."
- ICD-10 codes must be real, valid codes matching the discussed conditions.
- Patient summary must be in plain English, no medical jargon, written directly to the patient.
- Flag any medications mentioned that could have common interactions.

Respond ONLY with valid JSON in this exact structure:
{
  "subjective": "Patient-reported symptoms, chief complaint, history",
  "objective": "Vitals, physical exam findings, labs if mentioned",
  "assessment": "Clinical impression, diagnoses discussed",
  "plan": "Treatment plan, prescriptions, referrals, follow-up",
  "icd_codes": [{ "code": "E11.9", "description": "Type 2 diabetes mellitus without complications" }],
  "patient_summary": "Dear Patient, Today we discussed...",
  "medications_flagged": []
}`;

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();
    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json({ error: "Transcript too short" }, { status: 400 });
    }
    const ollamaResponse = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        system: SOAP_SYSTEM_PROMPT,
        prompt: `CONSULTATION TRANSCRIPT:\n\n${transcript}\n\nGenerate the SOAP note JSON now:`,
        stream: false,
        options: { temperature: 0.1, num_predict: 1500 },
      }),
    });
    if (!ollamaResponse.ok) throw new Error(`Ollama error: ${ollamaResponse.statusText}`);
    const ollamaData = await ollamaResponse.json();
    const jsonMatch = ollamaData.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Ollama response");
    const soap = JSON.parse(jsonMatch[0]);
    const required = ["subjective", "objective", "assessment", "plan", "icd_codes", "patient_summary", "medications_flagged"];
    for (const field of required) {
      if (!(field in soap)) soap[field] = field === "icd_codes" || field === "medications_flagged" ? [] : "Not documented.";
    }
    return NextResponse.json(soap);
  } catch (error) {
    console.error("SOAP generation error:", error);
    return NextResponse.json({ error: "SOAP generation failed." }, { status: 500 });
  }
}
