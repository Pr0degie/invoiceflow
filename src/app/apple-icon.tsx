import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#0F766E",
          borderRadius: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 72,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: "-2px",
        }}
      >
        IF
      </div>
    ),
    { ...size }
  );
}
