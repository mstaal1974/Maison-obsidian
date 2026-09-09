import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { type Fragrance, GOLD } from "../lib/data";
import {
  type Conception,
  ConceiveError,
  type ImageInfo,
  conceiveFragrance,
  conceptionToFragrance,
  IMAGE_ACCEPT,
  inspectImage,
  slugify,
} from "../lib/conceive";
import { label, field, btnGold, btnGhost, chip, bottleBackdrop } from "./adminStyles";

interface ConceiveFragranceProps {
  fragrances: Fragrance[];
  busy: boolean;
  /** Adds the draft straight to the catalogue (image uploaded first). */
  onAdd: (draft: Fragrance, image: File | null) => Promise<void> | void;
  /** Opens the draft in the full editor for adjustments before saving. */
  onRefine: (draft: Fragrance, image: File | null) => void;
  onClose: () => void;
}

type Status = "idle" | "thinking" | "done";

const panel: CSSProperties = {
  border: "1px solid #1f1f27",
  background: "#101015",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const panelTitle: CSSProperties = {
  ...label,
  color: "rgba(201,169,97,0.85)",
  letterSpacing: "0.26em",
};
const serif: CSSProperties = { fontFamily: "'Cormorant Garamond',serif", color: "#f3ecdc" };

/**
 * "Conceive with AI" — type a reference fragrance, Claude returns the house
 * name, copy and olfactory pyramid; attach an image of the bottle (PNG, JPG or WebP);
 * add the product. Everything is editable afterwards in the regular editor.
 */
export default function ConceiveFragrance({ fragrances, busy, onAdd, onRefine, onClose }: ConceiveFragranceProps) {
  const [reference, setReference] = useState("");
  const [brief, setBrief] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conception, setConception] = useState<Conception | null>(null);
  const [chosenName, setChosenName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Object URL for the preview; revoked when the file changes or we unmount.
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const existingNames = useMemo(() => fragrances.map((f) => f.name), [fragrances]);
  const nameTaken = useMemo(
    () => existingNames.some((n) => n.toLowerCase() === chosenName.trim().toLowerCase()),
    [existingNames, chosenName],
  );

  const conceive = async () => {
    const ref = reference.trim();
    if (!ref || status === "thinking") return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus("thinking");
    setError(null);
    try {
      const c = await conceiveFragrance(ref, existingNames, brief.trim() || undefined, ac.signal);
      setConception(c);
      setChosenName(c.name);
      setStatus("done");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ConceiveError ? e.message : "Conception failed — please try again.");
      setStatus(conception ? "done" : "idle");
    }
  };

  const pickFile = async (f: File | null) => {
    if (!f) return;
    const info = await inspectImage(f);
    setImageInfo(info);
    setImage(info.ok ? f : null);
  };

  // The chosen (possibly alternate) name also replaces the proposed one inside
  // the copy, so the packaging text never names a scent that doesn't exist.
  const draft = (): Fragrance | null => {
    if (!conception) return null;
    const name = chosenName.trim() || conception.name;
    const rename = (t: string) => (name === conception.name ? t : t.split(conception.name).join(name));
    return conceptionToFragrance(
      { ...conception, name, slug: slugify(name), story: rename(conception.story), copy: rename(conception.copy) },
      fragrances,
    );
  };

  const canAdd = !!conception && !!chosenName.trim() && !nameTaken && !busy;
  const accent = conception?.accent ?? GOLD;
  const liquid = conception?.liquid ?? "#3b2a18";

  return (
    <section
      aria-label="Conceive a fragrance with AI"
      style={{ border: "1px solid rgba(201,169,97,0.35)", background: "rgba(20,20,26,0.5)", padding: 24 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={panelTitle}>AI Brand Conception</div>
          <div style={{ ...serif, fontSize: 28, marginTop: 6 }}>
            Conceive a <span style={{ fontStyle: "italic", color: GOLD }}>fragrance.</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.55)", maxWidth: 620 }}>
            Type the fragrance the atelier sourced. Claude proposes a Maison Obsidian name for its profile, writes the
            packaging copy, and deconstructs the scent into top, heart and base notes. Attach an image of the
            bottle and add it to the catalogue.
          </p>
        </div>
        <button style={{ ...btnGhost, height: 34 }} onClick={onClose}>
          Close
        </button>
      </div>

      {/* ── Input ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void conceive();
        }}
        style={{ display: "grid", gridTemplateColumns: "minmax(240px,1.4fr) minmax(200px,1fr) auto", gap: 12, alignItems: "end", marginTop: 20 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Reference fragrance</span>
          <input
            style={field}
            placeholder="e.g. Tom Ford Black Lacquer"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            autoFocus
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Brief (optional)</span>
          <input
            style={field}
            placeholder="e.g. lean smokier, evening wear"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </label>
        <button type="submit" style={{ ...btnGold, opacity: reference.trim() && status !== "thinking" ? 1 : 0.5 }} disabled={!reference.trim() || status === "thinking"}>
          {status === "thinking" ? "Conceiving…" : conception ? "Regenerate" : "Conceive"}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ margin: "14px 0 0", fontSize: 12.5, color: "#d98a6a", lineHeight: 1.6 }}>
          {error}
        </p>
      )}

      {status === "thinking" && !conception && (
        <p aria-live="polite" style={{ margin: "18px 0 0", ...serif, fontStyle: "italic", fontSize: 18, color: "rgba(243,236,220,0.6)" }}>
          The perfumer is at the organ… naming, writing, and pulling the pyramid apart.
        </p>
      )}

      {conception && (
        <div style={{ marginTop: 22, display: "grid", gap: 14, opacity: status === "thinking" ? 0.5 : 1, transition: "opacity .2s" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {/* ── 1. Brand conception ── */}
            <div style={panel}>
              <div style={panelTitle}>01 · Brand Conception</div>
              <input
                aria-label="House name"
                style={{ ...field, ...serif, fontSize: 30, height: 52, border: 0, borderBottom: `1px solid ${nameTaken ? "#d98a6a" : "rgba(201,169,97,0.4)"}`, padding: "0 2px" }}
                value={chosenName}
                onChange={(e) => setChosenName(e.target.value)}
              />
              {nameTaken && <div style={{ fontSize: 11, color: "#d98a6a" }}>Already in the catalogue — pick an alternate.</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {conception.profile.map((p) => (
                  <span key={p} style={{ ...label, color: "rgba(243,236,220,0.75)", fontSize: 10 }}>
                    {p}
                  </span>
                )).flatMap((el, i) => (i ? [<span key={`dot-${i}`} style={{ color: GOLD, opacity: 0.6 }}>·</span>, el] : [el]))}
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(243,236,220,0.6)", lineHeight: 1.6 }}>{conception.inspiration}</div>
              <div style={{ display: "flex", gap: 14, ...label }}>
                <span>{conception.family}</span>
                <span>{conception.gender}</span>
              </div>
              {conception.alternates.length > 0 && (
                <div>
                  <div style={{ ...label, fontSize: 8, marginBottom: 6 }}>Alternates</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[conception.name, ...conception.alternates].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setChosenName(n)}
                        style={{
                          ...chip,
                          cursor: "pointer",
                          borderColor: n === chosenName ? GOLD : "rgba(201,169,97,0.35)",
                          color: n === chosenName ? GOLD : "#f3ecdc",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── 2. Copywriting ── */}
            <div style={panel}>
              <div style={panelTitle}>02 · Copywriting</div>
              <div style={{ ...serif, fontSize: 20, lineHeight: 1.25 }}>{conception.tagline}</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "rgba(243,236,220,0.8)" }}>{conception.story}</p>
              <div style={{ ...label, fontSize: 8 }}>Packaging copy</div>
              {conception.copy.split(/\n\s*\n/).map((para, i) => (
                <p key={i} style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "rgba(243,236,220,0.6)" }}>
                  {para}
                </p>
              ))}
            </div>

            {/* ── 3. Olfactory breakdown ── */}
            <div style={panel}>
              <div style={panelTitle}>03 · Olfactory Breakdown</div>
              {(["top", "heart", "base"] as const).map((tier) => (
                <div key={tier}>
                  <div style={{ ...label, fontSize: 8, marginBottom: 6 }}>{tier} notes</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {conception[tier].map((n) => (
                      <span key={n} style={chip}>
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                <span title={`Liquid ${conception.liquid}`} style={{ width: 22, height: 22, background: conception.liquid, border: "1px solid #1f1f27" }} />
                <span title={`Accent ${conception.accent}`} style={{ width: 22, height: 22, background: conception.accent, border: "1px solid #1f1f27" }} />
                <span style={{ ...label, fontSize: 8 }}>{conception.experience.join(" · ")}</span>
              </div>
            </div>
          </div>

          {/* ── Bottle image ── */}
          <div style={{ ...panel, flexDirection: "row", flexWrap: "wrap", gap: 20, alignItems: "stretch" }}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              style={{
                width: 220,
                height: 260,
                background: bottleBackdrop(accent, liquid),
                border: `1px ${dragging ? "solid" : "dashed"} ${dragging ? GOLD : "rgba(201,169,97,0.35)"}`,
                display: "grid",
                placeItems: "center",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Bottle preview"
                  style={imageInfo?.format === "jpeg" ? { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" } : { width: "100%", height: "100%", objectFit: "contain", padding: "8% 12%", boxSizing: "border-box" }}
                />
              ) : (
                <img
                  src="/assets/bottle-portrait.webp"
                  alt="Placeholder bottle"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", opacity: 0.35, filter: "grayscale(0.6)" }}
                />
              )}
              {!preview && (
                <span style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", ...label, fontSize: 8 }}>
                  Placeholder
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={panelTitle}>Bottle image</div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "rgba(243,236,220,0.55)" }}>
                Drop a <strong style={{ color: "#f3ecdc", fontWeight: 500 }}>PNG, JPG or WebP</strong> of the bottle (up to 4 MB). A
                transparent PNG sits on a backdrop tinted with the scent's colours; a JPG shows as full-frame photography.
                Skip it and the placeholder photography is used until you upload one.
              </p>
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_ACCEPT}
                hidden
                onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={{ ...btnGhost, height: 34 }} onClick={() => fileInput.current?.click()}>
                  {image ? "Replace image" : "Choose image"}
                </button>
                {image && (
                  <button
                    type="button"
                    style={{ ...btnGhost, height: 34, color: "#d98a6a" }}
                    onClick={() => {
                      setImage(null);
                      setImageInfo(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {imageInfo && !imageInfo.ok && <div style={{ fontSize: 12, color: "#d98a6a" }}>{imageInfo.reason}</div>}
              {imageInfo?.ok && (
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: imageInfo.transparent || imageInfo.format === "jpeg" ? "#8bb98a" : "#d98a6a" }}>
                  {image?.name} · {imageInfo.width}×{imageInfo.height}
                  {imageInfo.format === "jpeg"
                    ? " · JPG — shown as full-frame photography"
                    : imageInfo.transparent
                      ? " · transparent ✓"
                      : " · no alpha channel — export with a transparent background for the best result"}
                </div>
              )}
            </div>
          </div>

          {/* ── Actions ── */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              style={{ ...btnGold, opacity: canAdd ? 1 : 0.5 }}
              disabled={!canAdd}
              onClick={() => {
                const d = draft();
                if (d) void onAdd(d, image);
              }}
            >
              {busy ? "Adding…" : "Add to catalogue"}
            </button>
            <button
              type="button"
              style={btnGhost}
              disabled={busy || !conception}
              onClick={() => {
                const d = draft();
                if (d) onRefine(d, image);
              }}
            >
              Refine in editor
            </button>
            <span style={{ ...label, fontSize: 8 }}>
              Priced at the catalogue median · stock starts at 0 · edit anytime
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
