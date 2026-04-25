import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0f172a 0%, #134e4a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "80px",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 72,
            height: 72,
            background: "#0F766E",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-1px",
            marginBottom: 32,
          }}
        >
          IF
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-1.5px",
            marginBottom: 20,
          }}
        >
          InvoiceFlow
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "-0.5px",
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          Invoicing that gets out of your way.
        </div>

        {/* Sub-line */}
        <div
          style={{
            marginTop: 24,
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0px",
          }}
        >
          GoBD-compliant · PDF export · Open source
        </div>
      </div>
    ),
    { ...size }
  );
}
