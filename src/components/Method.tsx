const MOVEMENTS = [
  { no: "/ 01", title: "Source", body: "Absolutes pressed and shipped from Dubai's oldest oud houses." },
  { no: "/ 02", title: "Macerate", body: "Each compound rests four weeks at thirty percent oil before it is judged." },
  { no: "/ 03", title: "Commit", body: "Twenty patrons reserve a batch. No card is charged until the floor is met." },
  { no: "/ 04", title: "Pour", body: "The lab opens, bottles are filled, and each ships engraved with your name." },
];

export default function Method() {
  return (
    <section id="mo-method" style={{ borderTop: "1px solid #1f1f27", marginTop: 60, background: "#0d0d11" }}>
      <div style={{ maxWidth: 1340, margin: "0 auto", padding: "84px 32px" }}>
        <div
          style={{
            fontFamily: "'Space Mono',monospace",
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(201,169,97,0.85)",
          }}
        >
          The Method
        </div>
        <h2
          style={{
            margin: "14px 0 0",
            fontFamily: "'Cormorant Garamond',serif",
            fontWeight: 300,
            fontSize: 46,
            color: "#f3ecdc",
            maxWidth: 640,
            lineHeight: 1.06,
          }}
        >
          Four movements from <span style={{ fontStyle: "italic", color: "#c9a961" }}>absolute to atelier.</span>
        </h2>
        <div
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            borderTop: "1px solid #1f1f27",
          }}
          className="mo-method-grid"
        >
          {MOVEMENTS.map((m, i) => (
            <div
              key={m.no}
              style={{
                padding:
                  i === 0
                    ? "30px 24px 30px 0"
                    : i === MOVEMENTS.length - 1
                      ? "30px 0 30px 24px"
                      : "30px 24px",
                borderLeft: i === 0 ? undefined : "1px solid #1f1f27",
              }}
            >
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#c9a961", letterSpacing: "0.2em" }}>
                {m.no}
              </div>
              <div style={{ marginTop: 18, fontFamily: "'Cormorant Garamond',serif", fontSize: 25, color: "#f3ecdc" }}>
                {m.title}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.65, color: "rgba(243,236,220,0.55)" }}>
                {m.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
