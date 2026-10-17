import { ImageResponse } from "next/og";

// The preview card shown when the site is shared (WhatsApp, Instagram, X, iMessage…)
export const alt = "Moss & Moon: slow coffee, pink lattes and warm bakes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f6eee7", fontFamily: "Georgia, serif", position: "relative" }}>
        <div style={{ position: "absolute", right: -80, top: -80, width: 520, height: 520, borderRadius: 520, background: "#f9dce3" }} />
        <div style={{ position: "absolute", left: -60, bottom: -120, width: 380, height: 380, borderRadius: 380, background: "#e6cfbd" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px", width: 760, zIndex: 1 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: "#b97f52", textTransform: "uppercase", fontFamily: "Helvetica" }}>a slow-coffee café</div>
          <div style={{ display: "flex", fontSize: 96, color: "#3b2720", marginTop: 18, lineHeight: 1 }}>
            Moss <span style={{ color: "#c25b78", fontStyle: "italic", margin: "0 18px" }}>&amp;</span> Moon
          </div>
          <div style={{ fontSize: 38, color: "#84665a", marginTop: 28, lineHeight: 1.3 }}>Pink lattes, warm bakes &amp; a sunny window seat. Order ahead, collect stamps ☕</div>
        </div>
        <div style={{ position: "absolute", right: 120, top: 150, width: 300, height: 300, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 300, background: "#3b2720" }}>
          <div style={{ width: 170, height: 170, borderRadius: 170, background: "#e391a8", display: "flex" }} />
          <div style={{ position: "absolute", width: 150, height: 150, borderRadius: 150, background: "#3b2720", left: 110, top: 50 }} />
        </div>
      </div>
    ),
    size
  );
}
