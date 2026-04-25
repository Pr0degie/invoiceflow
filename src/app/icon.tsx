import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0F766E",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: "-0.5px",
        }}
      >
        IF
      </div>
    ),
    { ...size }
  );
}
