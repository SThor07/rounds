"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, FileText, User, Loader2, ChevronRight, Download, RotateCcw } from "lucide-react";

type AppState = "idle" | "recording" | "transcribing" | "generating" | "done";

interface SOAPNote {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    icd_codes: { code: string; description: string }[];
    patient_summary: string;
    medications_flagged: string[];
}

export default function RoundsApp() {
    const [state, setState] = useState<AppState>("idle");
    const [transcript, setTranscript] = useState("");
    const [soap, setSoap] = useState<SOAPNote | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [activeTab, setActiveTab] = useState<"soap" | "patient">("soap");
    const [editedSoap, setEditedSoap] = useState<SOAPNote | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (state === "recording") {
            timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            if (state === "idle") setRecordingTime(0);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [state]);

    const formatTime = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorder.start(250);
            setState("recording");
        } catch {
            alert("Microphone access required.");
        }
    };

    const stopRecording = async () => {
        if (!mediaRecorderRef.current) return;
        setState("transcribing");
        mediaRecorderRef.current.onstop = async () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            await processAudio(audioBlob);
        };
        mediaRecorderRef.current.stop();
    };

    const processAudio = async (audioBlob: Blob) => {
        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");
            const transcriptRes = await fetch("/api/transcribe", { method: "POST", body: formData });
            const { transcript: rawTranscript } = await transcriptRes.json();
            setTranscript(rawTranscript);
            setState("generating");
            const soapRes = await fetch("/api/generate-soap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transcript: rawTranscript }),
            });
            const soapData: SOAPNote = await soapRes.json();
            setSoap(soapData);
            setEditedSoap(soapData);
            setState("done");
        } catch (err) {
            console.error(err);
            alert("Something went wrong. Make sure both servers are running.");
            setState("idle");
        }
    };

    const reset = () => {
        setState("idle");
        setTranscript("");
        setSoap(null);
        setEditedSoap(null);
        setRecordingTime(0);
    };

    const exportPDF = async () => {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        if (!editedSoap) return;
        const date = new Date().toLocaleDateString();
        doc.setFontSize(18); doc.setFont("helvetica", "bold");
        doc.text("ROUNDS — Clinical Note", 20, 20);
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`Generated: ${date}`, 20, 28);
        doc.line(20, 32, 190, 32);
        let y = 40;
        const addSection = (title: string, content: string) => {
            doc.setFont("helvetica", "bold"); doc.setFontSize(11);
            doc.text(title, 20, y); y += 6;
            doc.setFont("helvetica", "normal"); doc.setFontSize(10);
            const lines = doc.splitTextToSize(content, 170);
            doc.text(lines, 20, y); y += lines.length * 5 + 8;
        };
        addSection("S — Subjective", editedSoap.subjective);
        addSection("O — Objective", editedSoap.objective);
        addSection("A — Assessment", editedSoap.assessment);
        addSection("P — Plan", editedSoap.plan);
        doc.save(`rounds-note-${date}.pdf`);
    };

    return (
        <div style={{ minHeight: "100vh", background: "#0F1117", color: "#E8E8E6", fontFamily: "system-ui, sans-serif" }}>
            <nav style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1D9E75" }} />
                    <span style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Rounds</span>
                    <span style={{ fontSize: "0.7rem", background: "rgba(29,158,117,0.15)", color: "#1D9E75", border: "0.5px solid rgba(29,158,117,0.3)", padding: "2px 8px", borderRadius: 100, marginLeft: 4 }}>AI Medical Scribe</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1D9E75" }} />
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>Local · No data leaves your device</span>
                </div>
            </nav>

            <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem" }}>

                {state === "idle" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: "2rem" }}>
                        <div style={{ textAlign: "center" }}>
                            <h1 style={{ fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.75rem", lineHeight: 1.1 }}>
                                Start your consultation.<br />
                                <span style={{ color: "#1D9E75" }}>We handle the notes.</span>
                            </h1>
                            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.95rem", maxWidth: 420, margin: "0 auto" }}>
                                Speak naturally with your patient. Rounds listens, transcribes locally, and generates a complete SOAP note automatically.
                            </p>
                        </div>
                        <button onClick={startRecording} style={{ width: 100, height: 100, borderRadius: "50%", background: "#1D9E75", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Mic size={36} color="white" />
                        </button>
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>Tap to begin recording</p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                            {["Whisper transcription", "Llama 3 via Ollama", "ICD-10 auto-coding", "PDF export"].map(f => (
                                <span key={f} style={{ fontSize: "0.75rem", padding: "4px 12px", borderRadius: 100, border: "0.5px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)" }}>{f}</span>
                            ))}
                        </div>
                    </div>
                )}

                {state === "recording" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: "2rem" }}>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "0.75rem", color: "#E24B4A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E24B4A" }} />
                                Recording
                            </div>
                            <div style={{ fontSize: "3.5rem", fontWeight: 700, letterSpacing: "-0.04em" }}>{formatTime(recordingTime)}</div>
                            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem", marginTop: "0.5rem" }}>Speak naturally — symptoms, history, medications</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, height: 48 }}>
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} style={{ width: 3, borderRadius: 2, background: "#1D9E75", height: `${20 + Math.sin(i) * 12}px`, opacity: 0.7 }} />
                            ))}
                        </div>
                        <button onClick={stopRecording} style={{ width: 80, height: 80, borderRadius: "50%", background: "#E24B4A", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <MicOff size={28} color="white" />
                        </button>
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>Tap to stop and generate note</p>
                    </div>
                )}

                {(state === "transcribing" || state === "generating") && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: "1.5rem" }}>
                        <Loader2 size={40} color="#1D9E75" style={{ animation: "spin 1s linear infinite" }} />
                        <div style={{ textAlign: "center" }}>
                            <p style={{ fontSize: "1.1rem", fontWeight: 500 }}>{state === "transcribing" ? "Transcribing with Whisper..." : "Generating SOAP note with Llama 3..."}</p>
                            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.85rem", marginTop: "0.4rem" }}>Running locally on your device</p>
                        </div>
                        {transcript && (
                            <div style={{ maxWidth: 560, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "1rem 1.25rem", width: "100%" }}>
                                <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", marginBottom: "0.5rem" }}>Transcript</p>
                                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{transcript}</p>
                            </div>
                        )}
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {state === "done" && editedSoap && (
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                            <div>
                                <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Clinical Note</h2>
                                <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 1rem", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "0.8rem" }}>
                                    <RotateCcw size={14} /> New session
                                </button>
                                <button onClick={exportPDF} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 1rem", borderRadius: 8, background: "#1D9E75", border: "none", color: "white", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 }}>
                                    <Download size={14} /> Export PDF
                                </button>
                            </div>
                        </div>

                        {editedSoap.medications_flagged.length > 0 && (
                            <div style={{ background: "rgba(226,75,74,0.1)", border: "0.5px solid rgba(226,75,74,0.3)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ fontSize: "0.7rem", background: "#E24B4A", color: "white", padding: "2px 6px", borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>FLAG</span>
                                <p style={{ fontSize: "0.82rem", color: "#F09595" }}>Potential interaction: <strong>{editedSoap.medications_flagged.join(", ")}</strong> — verify with pharmacist.</p>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 2, marginBottom: "1rem", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3, width: "fit-content" }}>
                            {(["soap", "patient"] as const).map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 500, background: activeTab === tab ? "rgba(255,255,255,0.1)" : "transparent", color: activeTab === tab ? "#E8E8E6" : "rgba(255,255,255,0.35)" }}>
                                    {tab === "soap" ? <span style={{ display: "flex", alignItems: "center", gap: 5 }}><FileText size={13} /> SOAP Note</span> : <span style={{ display: "flex", alignItems: "center", gap: 5 }}><User size={13} /> Patient Summary</span>}
                                </button>
                            ))}
                        </div>

                        {activeTab === "soap" && (
                            <div style={{ display: "grid", gap: "1rem" }}>
                                {(["subjective", "objective", "assessment", "plan"] as const).map((section) => (
                                    <div key={section} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
                                        <div style={{ padding: "0.6rem 1rem", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#1D9E75", letterSpacing: "0.08em" }}>
                                                {section[0].toUpperCase()} — {section.charAt(0).toUpperCase() + section.slice(1)}
                                            </span>
                                        </div>
                                        <textarea value={editedSoap[section]} onChange={e => setEditedSoap({ ...editedSoap, [section]: e.target.value })}
                                            style={{ width: "100%", padding: "0.75rem 1rem", background: "transparent", border: "none", color: "#E8E8E6", fontSize: "0.875rem", lineHeight: 1.7, resize: "vertical", minHeight: 80, fontFamily: "inherit", outline: "none" }} />
                                    </div>
                                ))}
                                {editedSoap.icd_codes.length > 0 && (
                                    <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "0.75rem 1rem" }}>
                                        <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#1D9E75", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>ICD-10 Codes</p>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                            {editedSoap.icd_codes.map((c) => (
                                                <span key={c.code} style={{ fontSize: "0.78rem", padding: "3px 10px", borderRadius: 6, background: "rgba(29,158,117,0.1)", border: "0.5px solid rgba(29,158,117,0.25)", color: "#5DCAA5" }}>
                                                    {c.code} — {c.description}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "patient" && (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
                                <div style={{ padding: "0.6rem 1rem", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#1D9E75", letterSpacing: "0.08em" }}>Patient Visit Summary</span>
                                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>Plain English — safe to share</span>
                                </div>
                                <textarea value={editedSoap.patient_summary} onChange={e => setEditedSoap({ ...editedSoap, patient_summary: e.target.value })}
                                    style={{ width: "100%", padding: "1rem", background: "transparent", border: "none", color: "#E8E8E6", fontSize: "0.9rem", lineHeight: 1.8, resize: "vertical", minHeight: 200, fontFamily: "inherit", outline: "none" }} />
                                <div style={{ padding: "0.75rem 1rem", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
                                    <button onClick={() => navigator.clipboard.writeText(editedSoap.patient_summary)} style={{ padding: "0.4rem 0.9rem", borderRadius: 6, background: "transparent", border: "0.5px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "0.78rem" }}>Copy text</button>
                                    <button style={{ padding: "0.4rem 0.9rem", borderRadius: 6, background: "#1D9E75", border: "none", color: "white", cursor: "pointer", fontSize: "0.78rem" }}>
                                        Email to patient <ChevronRight size={12} style={{ display: "inline" }} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <details style={{ marginTop: "1rem" }}>
                            <summary style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "0.5rem 0" }}>View raw transcript</summary>
                            <div style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "0.75rem 1rem", marginTop: "0.5rem" }}>
                                <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>{transcript}</p>
                            </div>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
}