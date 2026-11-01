import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { API, http } from "@/lib/api";

const newSession = () => `s-${crypto.randomUUID()}`;
const greeting = { role: "assistant", content: "Namaskar! I'm Laado from AAICHELADOO. May I know your name, and what sweets or namkin you'd like?" };

async function streamReply(sessionId, message, onDelta) {
  const res = await fetch(`${API}/chat/message`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok || !res.body) throw new Error("chat failed");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const p of parts) {
      if (!p.startsWith("data: ")) continue;
      const ev = JSON.parse(p.slice(6));
      if (ev.delta) onDelta(ev.delta);
    }
  }
}

const Bubble = ({ m, i }) => (
  <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
    <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "rounded-br-sm bg-amber-500 text-[#0A0F1D]" : "rounded-bl-sm bg-[#1E293B] text-slate-100"}`} data-testid={`laado-msg-${i}`}>
      {m.content || "…"}
    </p>
  </div>
);

export const LaadoChat = () => {
  const [open, setOpen] = useState(false);
  const [sid, setSid] = useState(newSession);
  const [msgs, setMsgs] = useState([greeting]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: t }, { role: "assistant", content: "" }]);
    try {
      await streamReply(sid, t, (d) => setMsgs((m) => [...m.slice(0, -1), { ...m[m.length - 1], content: m[m.length - 1].content + d }]));
    } catch {
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "'Aaiche Laado' will call back for serving you..." }]);
    } finally {
      setBusy(false);
    }
  };

  const endChat = async () => {
    const userSent = msgs.some((m) => m.role === "user");
    if (userSent) {
      setEnding(true);
      try {
        await http.post("/chat/end", { session_id: sid });
        toast.success("Thank you! Aaiche Laado will call you back soon.");
      } catch {
        toast.error("Could not save the chat. Please try again.");
        setEnding(false);
        return;
      }
      setEnding(false);
    }
    setSid(newSession());
    setMsgs([greeting]);
    setOpen(false);
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-amber-500 px-5 py-3.5 font-semibold text-[#0A0F1D] shadow-[0_10px_30px_rgba(245,158,11,0.35)]"
        data-testid="laado-chat-toggle"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />} <span className="text-sm">{open ? "Close" : "Ask Laado"}</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-3 right-3 z-50 flex h-[70vh] max-h-[560px] flex-col overflow-hidden rounded-3xl border border-amber-500/25 bg-slate-950/90 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-5 sm:w-[380px]"
            data-testid="laado-chat-window"
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#1E3A8A] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-500 font-cinzel font-bold text-[#0A0F1D]">L</span>
                <div><p className="text-sm font-bold">Laado</p><p className="text-[11px] text-sky-200">AAICHELADOO assistant</p></div>
              </div>
              <button onClick={endChat} disabled={ending || busy} className="rounded-full border border-amber-400/60 px-3 py-1 text-xs font-semibold text-amber-300 transition-colors duration-200 hover:bg-amber-500 hover:text-[#0A0F1D] disabled:opacity-50" data-testid="laado-end-chat-button">
                {ending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "End chat"}
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="laado-messages">
              {msgs.map((m, i) => <Bubble key={i} m={m} i={i} />)}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-slate-800 p-3">
              <input
                value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message…" maxLength={1000}
                className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-400"
                data-testid="laado-chat-input"
              />
              <button disabled={busy || !text.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-amber-500 text-[#0A0F1D] disabled:opacity-50" data-testid="laado-send-button">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
