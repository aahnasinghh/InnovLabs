/**
 * TemplateGallery.jsx
 * -----------------------------------------------------------------------------
 * Modal gallery of common wet-organic lab experiment setups. Each card shows a
 * number, name, category badge, common temperature + time ranges, and a small
 * vector PREVIEW rendered from the very same builder that loads onto the canvas
 * (so the preview always matches the result). Clicking a card loads the setup.
 *
 * Pure presentational component — the heavy lifting (Fabric drawing, thumbnail
 * rendering) lives in templates.js / labKit.js.
 * -----------------------------------------------------------------------------
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderThumbnail } from "../templates/labKit";

const CAT_COLOR = {
  Reaction: "#0d9488",
  Separation: "#2563eb",
  Purification: "#7c3aed",
  Technique: "#d97706",
  Workup: "#e11d48",
  General: "#0891b2",
};

/* A single card. The thumbnail is rendered lazily (and cached) once visible. */
function TemplateCard({ tpl, onLoad }) {
  const [thumb, setThumb] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    const draw = () => {
      const url = renderThumbnail(tpl);
      if (alive) setThumb(url);
    };
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          draw();
          obs.disconnect();
        }
      },
      { root: null, threshold: 0.05 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => {
      alive = false;
      obs.disconnect();
    };
  }, [tpl]);

  const accent = CAT_COLOR[tpl.category] || "#0d9488";

  return (
    <button ref={ref} style={styles.card} onClick={() => onLoad(tpl)} title={`Load “${tpl.name}”`}>
      <div style={styles.cardHead}>
        <span style={styles.no}>{String(tpl.no).padStart(2, "0")}</span>
        <span style={{ ...styles.badge, background: accent }}>{tpl.category}</span>
      </div>
      <div style={styles.preview}>
        {thumb ? (
          <img src={thumb} alt={tpl.name} style={styles.previewImg} draggable={false} />
        ) : (
          <span style={styles.previewLoading}>drawing…</span>
        )}
      </div>
      <div style={styles.cardName}>{tpl.name}</div>
      <div style={styles.meta}>
        <span style={styles.metaItem}>🌡 {tpl.temp}</span>
        <span style={styles.metaItem}>⏱ {tpl.time}</span>
      </div>
    </button>
  );
}

export default function TemplateGallery({ open, onClose, onLoad, groups }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
  }, [groups, query]);

  if (!open) return null;
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Experiment Setup Gallery</div>
            <div style={styles.subtitle}>{total} common wet organic lab setups · click a card to load it onto the canvas</div>
          </div>
          <div style={styles.headerRight}>
            <input style={styles.search} placeholder="Search setups…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            <button style={styles.closeBtn} onClick={onClose} title="Close (Esc)">
              ✕
            </button>
          </div>
        </div>

        <div style={styles.scroll}>
          {filtered.length === 0 && <div style={styles.noResults}>No setups match “{query}”.</div>}
          {filtered.map((g) => (
            <div key={g.category} style={styles.group}>
              <div style={styles.groupLabel}>
                <span style={{ ...styles.groupDot, background: CAT_COLOR[g.category] || "#0d9488" }} />
                {g.category}
                <span style={styles.groupCount}>{g.items.length}</span>
              </div>
              <div style={styles.grid}>
                {g.items.map((tpl) => (
                  <TemplateCard key={tpl.id} tpl={tpl} onLoad={onLoad} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24, boxSizing: "border-box", backdropFilter: "blur(2px)" },
  modal: { width: "min(1080px, 96vw)", height: "min(760px, 92vh)", background: "#f8fafc", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 24px 60px rgba(15,23,42,0.35)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 20px", background: "#fff", borderBottom: "1px solid #e2e8f0" },
  title: { fontSize: 17, fontWeight: 800, color: "#0f172a" },
  subtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  search: { width: 220, padding: "8px 11px", borderRadius: 9, border: "1px solid #e2e8f0", fontSize: 13, outline: "none" },
  closeBtn: { width: 34, height: 34, borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 15, cursor: "pointer" },
  scroll: { flex: 1, overflowY: "auto", padding: "16px 20px 28px" },
  noResults: { fontSize: 13, color: "#64748b", padding: 20 },
  group: { marginBottom: 22 },
  groupLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6, color: "#475569", marginBottom: 10 },
  groupDot: { width: 9, height: 9, borderRadius: 9 },
  groupCount: { fontSize: 11, fontWeight: 700, color: "#94a3b8" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  card: { display: "flex", flexDirection: "column", textAlign: "left", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, cursor: "pointer", transition: "transform 0.08s, box-shadow 0.08s, border-color 0.08s", fontFamily: "inherit" },
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  no: { fontSize: 12, fontWeight: 800, color: "#94a3b8" },
  badge: { fontSize: 9.5, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 0.4, padding: "2px 7px", borderRadius: 20 },
  preview: { height: 124, borderRadius: 9, background: "#f8fafc", border: "1px solid #eef2f6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewImg: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
  previewLoading: { fontSize: 11, color: "#cbd5e1" },
  cardName: { fontSize: 12.5, fontWeight: 700, color: "#0f172a", marginTop: 8, lineHeight: 1.25 },
  meta: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 },
  metaItem: { fontSize: 10.5, fontWeight: 600, color: "#64748b" },
};
