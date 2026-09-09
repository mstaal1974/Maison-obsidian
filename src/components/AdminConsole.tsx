import { type CSSProperties, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { type Fragrance, money } from "../lib/data";
import { IMAGE_ACCEPT, inspectImage, isPhotoImage, uploadFragranceImage } from "../lib/conceive";
import ConceiveFragrance from "./ConceiveFragrance";
import FormatMatrix from "./FormatMatrix";
import { label, field, btnGold, btnGhost, bottleBackdrop } from "./adminStyles";
import {
  adminUpsertFragrance,
  adminDeleteFragrance,
  adminSetStock,
  adminSetOil,
  adminCreateShipment,
  auspostTrackingUrl,
  fetchAllCommits,
  fetchCommitSizeCounts,
  demoFulfil,
  type AdminCommitRow,
} from "../lib/admin";

// Outstanding commitments per size, keyed by fragrance id.
type SizeCounts = Record<string, { 10: number; 30: number; 50: number }>;

function emptyCounts(): { 10: number; 30: number; 50: number } {
  return { 10: 0, 30: 0, 50: 0 };
}
import { demoShipments, subscribeShipments } from "../lib/catalogue";
import ScentRequests from "./ScentRequests";
import AdminSubscriptions from "./AdminSubscriptions";

interface AdminConsoleProps {
  fragrances: Fragrance[];
  configured: boolean;
  onReload: () => void;
  demoCommits: AdminCommitRow[];
}

const BLANK: Fragrance = {
  id: "",
  slug: "",
  name: "",
  inspiration: "",
  tagline: "",
  story: "",
  price: 0,
  price10: 0,
  price30: 0,
  gender: "unisex",
  moq: 20,
  committed: 0,
  liquid: "#3b2a18",
  accent: "#c9a961",
  vipOnly: false,
  top: [],
  heart: [],
  base: [],
  stock10: 0,
  stock30: 0,
  stock50: 0,
  lowStock: 5,
  oilMl: 0,
  profile: [],
  imageUrl: undefined,
};

export default function AdminConsole({ fragrances, configured, onReload, demoCommits }: AdminConsoleProps) {
  const [tab, setTab] = useState<"catalogue" | "matrix" | "fulfillment" | "requests" | "subscriptions">("catalogue");

  return (
    <main data-screen-label="Admin" style={{ maxWidth: 1340, margin: "0 auto", padding: "48px 32px 90px" }}>
      <div style={{ ...label, color: "rgba(201,169,97,0.85)", letterSpacing: "0.28em" }}>Atelier Admin</div>
      <h1 style={{ margin: "14px 0 0", fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 54, color: "#f3ecdc" }}>
        The <span style={{ fontStyle: "italic", color: "#c9a961" }}>Console.</span>
      </h1>
      {!configured && (
        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "rgba(243,236,220,0.45)" }}>
          Demo mode — edits are in-memory for this session. Connect Supabase to persist.
        </p>
      )}

      <div style={{ display: "flex", gap: 22, margin: "28px 0 30px", borderBottom: "1px solid #1f1f27" }}>
        {(["catalogue", "matrix", "fulfillment", "subscriptions", "requests"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: 0,
              borderBottom: tab === t ? "1px solid #c9a961" : "1px solid transparent",
              cursor: "pointer",
              padding: "0 0 12px",
              color: tab === t ? "#c9a961" : "rgba(243,236,220,0.55)",
              fontSize: 11,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {t === "catalogue" ? "Catalogue & Inventory" : t === "matrix" ? "Product Matrix" : t === "fulfillment" ? "Fulfillment" : t === "subscriptions" ? "Monthly Pour" : "Requests"}
          </button>
        ))}
      </div>

      {tab === "catalogue" ? (
        <Catalogue fragrances={fragrances} configured={configured} onReload={onReload} demoCommits={demoCommits} />
      ) : tab === "matrix" ? (
        <FormatMatrix fragrances={fragrances} configured={configured} onReload={onReload} />
      ) : tab === "fulfillment" ? (
        <Fulfillment fragrances={fragrances} configured={configured} demoCommits={demoCommits} />
      ) : tab === "subscriptions" ? (
        <AdminSubscriptions fragrances={fragrances} configured={configured} />
      ) : (
        <ScentRequests configured={configured} />
      )}
    </main>
  );
}

function Catalogue({
  fragrances,
  configured,
  onReload,
  demoCommits,
}: {
  fragrances: Fragrance[];
  configured: boolean;
  onReload: () => void;
  demoCommits: AdminCommitRow[];
}) {
  const [editing, setEditing] = useState<Fragrance | null>(null);
  // An image chosen in the AI panel travels with the draft into the editor.
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [conceiving, setConceiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remoteCounts, setRemoteCounts] = useState<SizeCounts | null>(null);

  // Demo: aggregate the local commits by fragrance + size.
  const demoCounts = useMemo<SizeCounts>(() => {
    const acc: SizeCounts = {};
    for (const c of demoCommits) {
      const bucket = (acc[c.fragrance_id] ??= emptyCounts());
      if (c.size_ml === 10 || c.size_ml === 30 || c.size_ml === 50) bucket[c.size_ml] += 1;
    }
    return acc;
  }, [demoCommits]);

  // Configured: pull outstanding counts per size from the DB.
  useEffect(() => {
    if (!configured) return;
    let active = true;
    void fetchCommitSizeCounts().then((rows) => {
      if (!active || !rows) return;
      const acc: SizeCounts = {};
      for (const r of rows) {
        const bucket = (acc[r.fragrance_id] ??= emptyCounts());
        if (r.size_ml === 10 || r.size_ml === 30 || r.size_ml === 50) bucket[r.size_ml] += Number(r.outstanding);
      }
      setRemoteCounts(acc);
    });
    return () => {
      active = false;
    };
  }, [configured, fragrances]);

  const counts = configured ? remoteCounts ?? {} : demoCounts;

  // Saves a fragrance, uploading a freshly chosen bottle image first so the row
  // is written with its final image URL.
  const save = async (f: Fragrance, image: File | null = null) => {
    setBusy(true);
    setSaveError(null);
    try {
      const imageUrl = image ? await uploadFragranceImage(image, f.slug) : f.imageUrl;
      const id = await adminUpsertFragrance({ ...f, imageUrl });
      if (!id) throw new Error("The catalogue rejected the save — check the slug is unique.");
      await adminSetOil(id, f.oilMl ?? 0);
      if (configured) onReload();
      setEditing(null);
      setEditingImage(null);
      setConceiving(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove “${name}” from the catalogue?`)) return;
    await adminDeleteFragrance(id);
    if (configured) onReload();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "rgba(243,236,220,0.55)" }}>
          {fragrances.length} fragrances
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{ ...btnGhost, borderColor: "rgba(201,169,97,0.45)", color: "#c9a961" }}
            onClick={() => {
              setConceiving(true);
              setEditing(null);
            }}
          >
            ✦ Conceive with AI
          </button>
          <button
            style={btnGold}
            onClick={() => {
              setEditing({ ...BLANK });
              setEditingImage(null);
              setConceiving(false);
            }}
          >
            + Add Fragrance
          </button>
        </div>
      </div>

      {saveError && (
        <p role="alert" style={{ margin: "0 0 14px", fontSize: 12.5, color: "#d98a6a" }}>
          {saveError}
        </p>
      )}

      {conceiving && !editing && (
        <ConceiveFragrance
          fragrances={fragrances}
          busy={busy}
          onAdd={save}
          onRefine={(draft, image) => {
            setEditing(draft);
            setEditingImage(image);
          }}
          onClose={() => setConceiving(false)}
        />
      )}

      {editing && (
        <Editor
          initial={editing}
          initialImage={editingImage}
          busy={busy}
          onSave={save}
          onCancel={() => {
            setEditing(null);
            setEditingImage(null);
          }}
        />
      )}

      <div style={{ display: "grid", gap: 10, marginTop: editing || conceiving ? 24 : 0 }}>
        {fragrances.map((f) => (
          <Row
            key={f.id}
            f={f}
            counts={counts[f.id] ?? emptyCounts()}
            configured={configured}
            onEdit={() => setEditing({ ...f })}
            onDelete={() => remove(f.id, f.name)}
            onReload={onReload}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  f,
  counts,
  configured,
  onEdit,
  onDelete,
  onReload,
}: {
  f: Fragrance;
  counts: { 10: number; 30: number; 50: number };
  configured: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReload: () => void;
}) {
  const [s10, setS10] = useState(f.stock10 ?? 0);
  const [s30, setS30] = useState(f.stock30 ?? 0);
  const [s50, setS50] = useState(f.stock50 ?? 0);
  const [oil, setOil] = useState(f.oilMl ?? 0);
  const low = f.lowStock ?? 5;
  const dirty =
    s10 !== (f.stock10 ?? 0) ||
    s30 !== (f.stock30 ?? 0) ||
    s50 !== (f.stock50 ?? 0) ||
    oil !== (f.oilMl ?? 0);

  const saveStock = async () => {
    await adminSetStock(f.id, s10, s30, s50);
    if (oil !== (f.oilMl ?? 0)) await adminSetOil(f.id, oil);
    if (configured) onReload();
  };

  // Oil demanded by outstanding commitments, per size.
  const oilNeeded = counts[10] * 10 + counts[30] * 30 + counts[50] * 50;
  const covered = oil >= oilNeeded;

  const stockBox = (v: number, set: (n: number) => void, size: string) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...label, fontSize: 8 }}>
        {size}
        {v <= low && <span style={{ color: "#d98a6a" }}> · low</span>}
      </span>
      <input
        type="number"
        min={0}
        value={v}
        onChange={(e) => set(Math.max(0, Number(e.target.value)))}
        aria-label={`${f.name} ${size} stock`}
        style={{ ...field, width: 62, height: 34, color: v <= low ? "#d98a6a" : "#f3ecdc" }}
      />
    </label>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
        border: "1px solid #1f1f27",
        background: "#101015",
        padding: "16px 18px",
      }}
    >
      <div style={{ minWidth: 200, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {f.imageUrl ? (
            <img
              src={f.imageUrl}
              alt=""
              style={{ width: 34, height: 44, objectFit: "contain", background: bottleBackdrop(f.accent, f.liquid), flexShrink: 0 }}
            />
          ) : (
            <span style={{ width: 10, height: 28, background: f.liquid, flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: "#f3ecdc", lineHeight: 1 }}>{f.name}</div>
            <div style={{ ...label, marginTop: 4 }}>
              {f.gender} · {money(f.price)} {f.vipOnly ? "· VIP" : ""}
            </div>
          </div>
        </div>
      </div>
      {/* Commitments by size + oil coverage */}
      <div style={{ minWidth: 190 }}>
        <div style={{ ...label, fontSize: 8 }}>Commitments by size ({f.committed}/{f.moq} batch)</div>
        <div style={{ marginTop: 5, display: "flex", gap: 12, fontFamily: "'Space Mono',monospace", fontSize: 12, color: "#f3ecdc" }}>
          <span>10 · {counts[10]}</span>
          <span>30 · {counts[30]}</span>
          <span>50 · {counts[50]}</span>
        </div>
        <div style={{ marginTop: 6, fontFamily: "'Space Mono',monospace", fontSize: 11, color: covered ? "#8bb98a" : "#d98a6a" }}>
          {oilNeeded} ml needed / {oil} ml oil{covered ? " · covered" : ` · short ${oilNeeded - oil} ml`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...label, fontSize: 8 }}>Oil (ml)</span>
          <input
            type="number"
            min={0}
            value={oil}
            onChange={(e) => setOil(Math.max(0, Number(e.target.value)))}
            aria-label={`${f.name} oil on hand (ml)`}
            style={{ ...field, width: 78, height: 34 }}
          />
        </label>
        {stockBox(s10, setS10, "10ml")}
        {stockBox(s30, setS30, "30ml")}
        {stockBox(s50, setS50, "50ml")}
        <button onClick={saveStock} disabled={!dirty} style={{ ...btnGhost, height: 34, opacity: dirty ? 1 : 0.4 }}>
          Save
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEdit} style={{ ...btnGhost, height: 34 }}>
          Edit
        </button>
        <button onClick={onDelete} style={{ ...btnGhost, height: 34, color: "#d98a6a" }}>
          Delete
        </button>
      </div>
    </div>
  );
}

function Editor({
  initial,
  initialImage = null,
  busy,
  onSave,
  onCancel,
}: {
  initial: Fragrance;
  initialImage?: File | null;
  busy: boolean;
  onSave: (f: Fragrance, image: File | null) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Fragrance>(initial);
  const [image, setImage] = useState<File | null>(initialImage);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Object URL for the preview; revoked when the file changes or we unmount.
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickImage = async (file: File | null) => {
    if (!file) return;
    const info = await inspectImage(file);
    if (!info.ok) {
      setImageError(info.reason ?? "Invalid image.");
      return;
    }
    setImageNote(
      info.format === "jpeg"
        ? "JPG — shown as full-frame photography on the tiles. A transparent PNG sits on the tinted backdrop instead."
        : info.transparent
          ? null
          : "No transparency — a transparent PNG looks best on the tiles.",
    );
    setImageError(null);
    setImage(file);
  };
  const shownImage = preview ?? f.imageUrl;
  // A chosen JPG (or a stored one) fills the preview edge to edge like a photo.
  const shownAsPhoto = image ? image.type === "image/jpeg" : isPhotoImage(f.imageUrl);
  const set = <K extends keyof Fragrance>(k: K, v: Fragrance[K]) => setF((p) => ({ ...p, [k]: v }));
  const dollars = (cents: number) => (cents ? String(cents / 100) : "");
  const notes = (arr: string[]) => arr.join(", ");
  const parseNotes = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const valid = f.name.trim() && f.slug.trim();

  const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 };
  const cell = (labelText: string, node: React.ReactNode) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={label}>{labelText}</span>
      {node}
    </label>
  );

  return (
    <div style={{ border: "1px solid rgba(201,169,97,0.35)", background: "rgba(20,20,26,0.5)", padding: 24 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: "#f3ecdc", marginBottom: 18 }}>
        {initial.id ? "Edit fragrance" : "New fragrance"}
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={grid}>
          {cell("Name", <input style={field} value={f.name} onChange={(e) => set("name", e.target.value)} />)}
          {cell("Slug", <input style={field} value={f.slug} onChange={(e) => set("slug", e.target.value)} />)}
          {cell(
            "Gender",
            <select
              style={{ ...field, appearance: "auto" }}
              value={f.gender}
              onChange={(e) => set("gender", e.target.value as Fragrance["gender"])}
            >
              <option value="masculine">masculine</option>
              <option value="feminine">feminine</option>
              <option value="unisex">unisex</option>
            </select>,
          )}
        </div>
        {cell("Inspiration", <input style={field} value={f.inspiration} onChange={(e) => set("inspiration", e.target.value)} />)}
        {cell("Tagline", <input style={field} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} />)}
        {cell(
          "Story",
          <textarea
            style={{ ...field, height: 70, padding: 12, resize: "vertical" }}
            value={f.story}
            onChange={(e) => set("story", e.target.value)}
          />,
        )}
        <div style={grid}>
          {cell("Price 10ml ($)", <input type="number" style={field} value={dollars(f.price10)} onChange={(e) => set("price10", Math.round(Number(e.target.value) * 100))} />)}
          {cell("Price 30ml ($)", <input type="number" style={field} value={dollars(f.price30)} onChange={(e) => set("price30", Math.round(Number(e.target.value) * 100))} />)}
          {cell("Price 50ml ($)", <input type="number" style={field} value={dollars(f.price)} onChange={(e) => set("price", Math.round(Number(e.target.value) * 100))} />)}
        </div>
        <div style={grid}>
          {cell("MOQ", <input type="number" style={field} value={f.moq} onChange={(e) => set("moq", Number(e.target.value))} />)}
          {cell("Liquid (hex)", <input style={field} value={f.liquid} onChange={(e) => set("liquid", e.target.value)} />)}
          {cell("Accent (hex)", <input style={field} value={f.accent} onChange={(e) => set("accent", e.target.value)} />)}
        </div>
        {cell("Top notes (comma-separated)", <input style={field} value={notes(f.top)} onChange={(e) => set("top", parseNotes(e.target.value))} />)}
        {cell("Heart notes", <input style={field} value={notes(f.heart)} onChange={(e) => set("heart", parseNotes(e.target.value))} />)}
        {cell("Base notes", <input style={field} value={notes(f.base)} onChange={(e) => set("base", parseNotes(e.target.value))} />)}
        {cell(
          "Scent profile (three words, comma-separated)",
          <input style={field} placeholder="Dark, Resinous, Woody" value={notes(f.profile ?? [])} onChange={(e) => set("profile", parseNotes(e.target.value).slice(0, 3))} />,
        )}
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div
            style={{
              width: 120,
              height: 150,
              flexShrink: 0,
              background: bottleBackdrop(f.accent, f.liquid),
              border: "1px solid #1f1f27",
              overflow: "hidden",
            }}
          >
            {shownImage ? (
              <img
                src={shownImage}
                alt="Bottle"
                style={shownAsPhoto ? { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" } : { width: "100%", height: "100%", objectFit: "contain", padding: "8% 12%", boxSizing: "border-box" }}
              />
            ) : (
              <img src="/assets/bottle-portrait.webp" alt="Placeholder bottle" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", opacity: 0.35 }} />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 220 }}>
            <span style={label}>Bottle image (PNG, JPG or WebP)</span>
            <input ref={fileInput} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => void pickImage(e.target.files?.[0] ?? null)} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={{ ...btnGhost, height: 34 }} onClick={() => fileInput.current?.click()}>
                {shownImage ? "Replace image" : "Choose image"}
              </button>
              {(image || f.imageUrl) && (
                <button
                  type="button"
                  style={{ ...btnGhost, height: 34, color: "#d98a6a" }}
                  onClick={() => {
                    setImage(null);
                    set("imageUrl", undefined);
                    setImageError(null);
                    setImageNote(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            <span style={{ fontSize: 11.5, lineHeight: 1.5, color: imageError ? "#d98a6a" : "rgba(243,236,220,0.45)" }}>
              {imageError ??
                (image
                  ? `${image.name} — uploads when you save.${imageNote ? ` ${imageNote}` : ""}`
                  : f.imageUrl
                    ? "Current render kept — replace or remove it here."
                    : "Without an image the placeholder bottle photography is shown.")}
            </span>
          </div>
        </div>
        <div style={grid}>
          {cell("Stock 10ml", <input type="number" style={field} value={f.stock10 ?? 0} onChange={(e) => set("stock10", Math.max(0, Number(e.target.value)))} />)}
          {cell("Stock 30ml", <input type="number" style={field} value={f.stock30 ?? 0} onChange={(e) => set("stock30", Math.max(0, Number(e.target.value)))} />)}
          {cell("Stock 50ml", <input type="number" style={field} value={f.stock50 ?? 0} onChange={(e) => set("stock50", Math.max(0, Number(e.target.value)))} />)}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, ...label }}>
          <input type="checkbox" checked={!!f.vipOnly} onChange={(e) => set("vipOnly", e.target.checked)} />
          VIP only
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button style={{ ...btnGold, opacity: valid && !busy ? 1 : 0.5 }} disabled={!valid || busy} onClick={() => onSave(f, image)}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button style={btnGhost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Fulfillment({
  fragrances,
  configured,
  demoCommits,
}: {
  fragrances: Fragrance[];
  configured: boolean;
  demoCommits: AdminCommitRow[];
}) {
  const [remote, setRemote] = useState<AdminCommitRow[] | null>(null);
  const demoShip = useSyncExternalStore(subscribeShipments, demoShipments);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    void fetchAllCommits().then((rows) => {
      if (active) setRemote(rows);
    });
    return () => {
      active = false;
    };
  }, [configured]);

  const commits = configured ? remote ?? [] : demoCommits;
  const nameOf = (id: string) => fragrances.find((f) => f.id === id)?.name ?? id;

  if (configured && remote === null) {
    return <p style={{ fontSize: 13, color: "rgba(243,236,220,0.5)" }}>Loading commits…</p>;
  }
  if (commits.length === 0) {
    return <p style={{ fontSize: 13, color: "rgba(243,236,220,0.5)" }}>No commits to fulfill yet.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {commits.map((c) => (
        <FulfillRow
          key={c.id}
          commit={c}
          name={nameOf(c.fragrance_id)}
          configured={configured}
          demoStatus={demoShip[c.fragrance_id]}
        />
      ))}
    </div>
  );
}

function FulfillRow({
  commit,
  name,
  configured,
  demoStatus,
}: {
  commit: AdminCommitRow;
  name: string;
  configured: boolean;
  demoStatus?: { status: string; carrier?: string; trackingNumber?: string };
}) {
  const [carrier, setCarrier] = useState("Australia Post");
  const [tracking, setTracking] = useState("");
  const [done, setDone] = useState<string | null>(demoStatus ? `${demoStatus.status} · ${demoStatus.trackingNumber ?? ""}` : null);
  const [busy, setBusy] = useState(false);

  const ship = async () => {
    setBusy(true);
    const article = tracking || `MO${Math.random().toString().slice(2, 12)}`;
    if (configured) {
      const ok = await adminCreateShipment(commit.id, carrier, tracking, "");
      setDone(ok ? `label_created · ${tracking || "—"}` : "failed");
    } else {
      demoFulfil(commit.fragrance_id, {
        status: "label_created",
        carrier,
        trackingNumber: article,
        trackingUrl: carrier === "Australia Post" ? auspostTrackingUrl(article) : undefined,
      });
      setDone(`label_created · ${article}`);
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", border: "1px solid #1f1f27", background: "#101015", padding: "14px 18px" }}>
      <div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: "#f3ecdc" }}>{name}</div>
        <div style={{ ...label, marginTop: 4 }}>
          {commit.format ? commit.format.toUpperCase() : `${commit.size_ml} ml`} · {commit.charge_cents != null ? money(commit.charge_cents) : "—"}
          {commit.engraving ? ` · “${commit.engraving}”` : ""} · {commit.status}
        </div>
      </div>
      {done ? (
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#8bb98a" }}>✓ {done}</span>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input aria-label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} style={{ ...field, width: 130 }} />
          <input aria-label="Tracking number" placeholder="AusPost article id" value={tracking} onChange={(e) => setTracking(e.target.value)} style={{ ...field, width: 150 }} />
          <button style={{ ...btnGold, height: 40 }} disabled={busy} onClick={ship}>
            {busy ? "…" : "Create Shipment"}
          </button>
        </div>
      )}
    </div>
  );
}
