import { type CSSProperties, useEffect, useRef, useState } from "react";
import { type Fragrance, GOLD } from "../lib/data";
import {
  type ChatMessage,
  catalogueSummary,
  streamChat,
  localFallbackReply,
  logChat,
  linkifyFragrances,
} from "../lib/concierge";

function newConversationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `conv-${Math.random().toString(36).slice(2)}`;
}

const GREETING =
  "Welcome to Maison Obsidian. I'm your concierge — ask me about a scent, how batch commits work, sizes, engraving, VIP, or shipping.";

const SUGGESTIONS = ["How do batch commits work?", "Recommend something with oud", "How does shipping work?"];

interface ChatWidgetProps {
  fragrances: Fragrance[];
  onOpenProduct: (slug: string) => void;
}

export default function ChatWidget({ fragrances, onOpenProduct }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId] = useState(newConversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const history: ChatMessage[] = [...messages.filter((m) => m.content !== GREETING), { role: "user", content: q }];
    setMessages((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setBusy(true);

    const setLast = (content: string) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content };
        return next;
      });

    void logChat(conversationId, "user", q);

    let acc = "";
    let source: "claude" | "fallback" = "claude";
    try {
      await streamChat(history, catalogueSummary(fragrances), (delta) => {
        acc += delta;
        setLast(acc);
      });
      if (!acc.trim()) {
        acc = localFallbackReply(q, fragrances);
        source = "fallback";
        setLast(acc);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "rate_limited") {
        acc = "You're sending messages a little quickly — give me a moment, then try again.";
        source = "fallback";
      } else {
        // Offline / no API key — answer locally.
        acc = localFallbackReply(q, fragrances);
        source = "fallback";
      }
      setLast(acc);
    } finally {
      setBusy(false);
      void logChat(conversationId, "assistant", acc, source);
    }
  };

  const bubble = (role: ChatMessage["role"]): CSSProperties => ({
    maxWidth: "82%",
    alignSelf: role === "user" ? "flex-end" : "flex-start",
    background: role === "user" ? GOLD : "#141419",
    color: role === "user" ? "#0b0b0d" : "#f3ecdc",
    border: role === "user" ? "0" : "1px solid #1f1f27",
    padding: "10px 13px",
    fontSize: 13.5,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  });

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Concierge chat"
          style={{
            position: "fixed",
            bottom: 92,
            right: 24,
            zIndex: 95,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            height: 540,
            maxHeight: "calc(100vh - 130px)",
            background: "#0d0d11",
            border: "1px solid #1f1f27",
            display: "flex",
            flexDirection: "column",
            animation: "moRise 0.28s ease both",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #1f1f27", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#f3ecdc", lineHeight: 1 }}>Concierge</div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 8.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c9a961", marginTop: 5 }}>
                Maison Obsidian
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close concierge"
              style={{ background: "none", border: 0, cursor: "pointer", color: "rgba(243,236,220,0.6)", fontSize: 20, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          <div ref={scrollRef} className="mo-scroll" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={bubble(m.role)}>
                {m.role === "assistant" && m.content
                  ? linkifyFragrances(m.content, fragrances).map((seg, j) =>
                      seg.slug ? (
                        <button
                          key={j}
                          onClick={() => {
                            onOpenProduct(seg.slug!);
                            setOpen(false);
                          }}
                          style={{
                            background: "none",
                            border: 0,
                            padding: 0,
                            cursor: "pointer",
                            color: GOLD,
                            font: "inherit",
                            textDecoration: "underline",
                            textUnderlineOffset: 2,
                          }}
                        >
                          {seg.text}
                        </button>
                      ) : (
                        <span key={j}>{seg.text}</span>
                      ),
                    )
                  : m.content || (busy && i === messages.length - 1 ? "…" : "")}
              </div>
            ))}
            {messages.length <= 1 && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="mo-pill"
                    style={{
                      textAlign: "left",
                      background: "none",
                      border: "1px solid #1f1f27",
                      cursor: "pointer",
                      color: "rgba(243,236,220,0.75)",
                      padding: "9px 12px",
                      fontSize: 12.5,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            style={{ borderTop: "1px solid #1f1f27", padding: 12, display: "flex", gap: 8 }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the concierge…"
              aria-label="Message the concierge"
              className="mo-engrave-input"
              style={{
                flex: 1,
                background: "none",
                border: "1px solid #1f1f27",
                outline: "none",
                height: 42,
                padding: "0 14px",
                color: "#f3ecdc",
                fontFamily: "'Hanken Grotesk',sans-serif",
                fontSize: 13.5,
              }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="mo-cta"
              style={{
                background: GOLD,
                color: "#0b0b0d",
                border: 0,
                cursor: busy || !input.trim() ? "default" : "pointer",
                width: 46,
                fontSize: 16,
                opacity: busy || !input.trim() ? 0.5 : 1,
              }}
            >
              →
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close concierge" : "Open concierge"}
        aria-expanded={open}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 96,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: GOLD,
          color: "#0b0b0d",
          border: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 30px rgba(201,169,97,0.35)",
        }}
      >
        {open ? (
          <span style={{ fontSize: 24, lineHeight: 1 }}>×</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 5h16v11H8l-4 3V5z" stroke="#0b0b0d" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 9h8M8 12h5" stroke="#0b0b0d" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </>
  );
}
