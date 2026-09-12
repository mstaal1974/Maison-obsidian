import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Fragrance } from "../../lib/data";
import { imagine, scentAiAvailable, type ImaginedScent } from "../../lib/scentai";
import { identityOf, type Scentprint } from "../../lib/scentdna";
import ScentprintRing from "./ScentprintRing";
import { SD, SERIF, ctaGhost, ctaGold, ctaQuiet, eyebrow, glass, goldA, ink, micro } from "./theme";

interface MemoryProps {
  fragrances: Fragrance[];
  onComplete: (print: Scentprint) => void;
  onExit: () => void;
}

/** Longest edge in the upload. Enough for the model, small enough to post. */
const MAX_EDGE = 1024;

/**
 * Re-encodes a chosen photograph in the browser: downscaled, JPEG, and
 * stripped of everything but pixels. The original file never leaves the device
 * — only this re-render is posted, and only for as long as the request takes.
 */
function prepareImage(file: File): Promise<{ data: string; mediaType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like an image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("This browser can't prepare the image."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", 0.82);
        resolve({ data: url.split(",")[1] ?? "", mediaType: "image/jpeg", preview: url });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * A photograph or a memory, turned into a Scentprint. The most shareable way
 * in: people post the picture and the scent it became, which is a better
 * advertisement for the house than any of its own copy.
 */
export default function ScentMemory({ fragrances, onComplete, onExit }: MemoryProps) {
  const [memory, setMemory] = useState("");
  const [image, setImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null);
  const [result, setResult] = useState<ImaginedScent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const pick = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      setImage(await prepareImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That image couldn't be used.");
    }
  }, []);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (busy || (!memory.trim() && !image)) return;
      setBusy(true);
      setError(null);
      const r = await imagine({ memory: memory.trim() || undefined, image: image ? { data: image.data, mediaType: image.mediaType } : undefined }, fragrances);
      setBusy(false);
      if (r.ok) setResult(r.result);
      else setError(r.error);
    },
    [busy, memory, image, fragrances],
  );

  return (
    <section data-screen-label="Scent DNA — memory" style={{ position: "relative", zIndex: 1, minHeight: "calc(100vh - 68px)" }}>
      <div className="sd-pad" style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 32px 70px" }}>
        <div style={eyebrow}>Discover · from a moment</div>
        <h2 style={{ margin: "14px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: "clamp(30px, 4.2vw, 50px)", color: SD.text, lineHeight: 1.03 }}>
          What should it smell like?
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.7, color: ink(0.55), maxWidth: 620 }}>
          A photograph, or a place you remember. The coast in October, your grandmother's kitchen, the drive home. We'll read it as a scent and find the fragrances closest to it.
        </p>

        <div className="sd-result-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 460px)", gap: 40, marginTop: 34, alignItems: "start" }}>
          <form onSubmit={submit} style={{ ...glass, padding: "26px 24px 24px" }}>
            <label style={{ ...micro, color: ink(0.5), display: "block" }} htmlFor="sd-memory">
              Describe the moment
            </label>
            <textarea
              id="sd-memory"
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              rows={5}
              maxLength={600}
              placeholder="Late September, the sea a few streets away, someone cutting rosemary in the next garden…"
              style={{
                width: "100%",
                marginTop: 10,
                background: "rgba(245,242,234,0.03)",
                border: `1px solid ${ink(0.12)}`,
                outline: "none",
                color: SD.text,
                fontFamily: "inherit",
                fontSize: 14.5,
                lineHeight: 1.7,
                padding: "14px 16px",
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
              <input ref={fileInput} type="file" accept="image/*" onChange={(e) => void pick(e)} style={{ display: "none" }} />
              <button type="button" className="sd-cta" style={{ ...ctaGhost, height: 44 }} onClick={() => fileInput.current?.click()}>
                {image ? "Change photograph" : "Add a photograph"}
              </button>
              {image && (
                <>
                  <img src={image.preview} alt="" style={{ width: 54, height: 54, objectFit: "cover", border: `1px solid ${goldA(0.3)}` }} />
                  <button type="button" className="sd-cta" style={{ ...ctaQuiet, height: 38 }} onClick={() => setImage(null)}>
                    Remove
                  </button>
                </>
              )}
            </div>
            <p style={{ ...micro, marginTop: 12, color: ink(0.32), lineHeight: 1.9 }}>
              The photograph is resized in your browser and sent only to read the scene. It is never stored.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
              <button className="sd-cta" type="submit" style={ctaGold} disabled={busy || (!memory.trim() && !image)}>
                {busy ? "Reading it…" : "Turn it into a scent"}
              </button>
              <button type="button" className="sd-cta" style={{ ...ctaQuiet, height: 56 }} onClick={onExit}>
                Take the visual version
              </button>
            </div>
            {error && <p style={{ ...micro, color: "#E08A6A", marginTop: 16, lineHeight: 1.8 }}>{error}</p>}
            {!scentAiAvailable() && !error && (
              <p style={{ ...micro, marginTop: 16, color: ink(0.34), lineHeight: 1.8 }}>
                Reading photographs needs the concierge, which isn't switched on here — a written memory still works.
              </p>
            )}
          </form>

          <aside style={{ display: "grid", gap: 20, justifyItems: "center" }}>
            {result ? (
              <>
                <ScentprintRing dims={identityOf(result.print).top} size={360} animate id="sd-memory-ring" />
                <div style={{ textAlign: "center", maxWidth: 380 }}>
                  <div style={{ ...micro, color: goldA(0.85) }}>It smells like</div>
                  <h3 style={{ margin: "10px 0 0", fontFamily: SERIF, fontWeight: 300, fontSize: 34, color: SD.text, lineHeight: 1.1 }}>{result.title}</h3>
                  <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.75, color: ink(0.6) }}>{result.story}</p>
                  {result.cues.length > 0 && (
                    <p style={{ ...micro, marginTop: 14, color: ink(0.4), lineHeight: 2 }}>{result.cues.join(" · ")}</p>
                  )}
                </div>
                <button className="sd-cta" style={ctaGold} onClick={() => onComplete(result.print)}>
                  Find my matches
                </button>
              </>
            ) : (
              <div style={{ display: "grid", gap: 16, justifyItems: "center", opacity: 0.75 }}>
                <ScentprintRing dims={IDLE} size={300} labels={false} values={false} ambient id="sd-memory-idle" />
                <span style={{ ...micro, color: ink(0.32), textAlign: "center", maxWidth: 300, lineHeight: 1.9 }}>
                  Your Scentprint appears here, then the fragrances that sit closest to it.
                </span>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

const IDLE = [
  { dim: "fresh", value: 30 },
  { dim: "aquatic", value: 26 },
  { dim: "green", value: 30 },
  { dim: "floral", value: 26 },
  { dim: "amber", value: 30 },
  { dim: "woody", value: 32 },
  { dim: "musk", value: 26 },
  { dim: "clean", value: 30 },
] as { dim: import("../../lib/scentdna").ScentDim; value: number }[];
