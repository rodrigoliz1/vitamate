import { ImageResponse } from "next/og";

export const alt = "VITAMATE — La vida fit que se adapta a tu vida";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "66px 74px",
          color: "#F8F7F0",
          background: "linear-gradient(135deg, #173A27 0%, #2F5233 52%, #5A7D5E 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 94,
              height: 94,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 27,
              color: "#FFFFFF",
              background: "linear-gradient(145deg, #5A7D5E, #2A4A32)",
              border: "2px solid rgba(255,255,255,0.28)",
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: "-0.12em",
              paddingRight: 8,
            }}
          >
            V
          </div>
          <div style={{ display: "flex", fontSize: 43, fontWeight: 800, letterSpacing: "0.13em" }}>VITAMATE</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
          <div style={{ display: "flex", color: "#E9CBB4", fontSize: 22, fontWeight: 800, letterSpacing: "0.18em" }}>TU COMPAÑERO DIARIO</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 70, fontWeight: 800, letterSpacing: "-0.055em", lineHeight: 1.03 }}>
            La vida fit que se adapta a tu vida.
          </div>
          <div style={{ display: "flex", marginTop: 24, color: "#DCE8DF", fontSize: 30, lineHeight: 1.35 }}>
            Entrenamiento, nutrición y VITACOACH en una sola experiencia.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#DCE8DF", fontSize: 22 }}>
          <div style={{ display: "flex" }}>vitamate.mx</div>
          <div style={{ display: "flex", padding: "12px 18px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#FFFFFF", fontWeight: 700 }}>COME · ENTRENA · AVANZA</div>
        </div>
      </div>
    ),
    size,
  );
}
