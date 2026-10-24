// "Ачаалж байна · радар" from the design: a tilted radar disc with a sweeping
// beam and blinking students, over a loading bar.

const BLIPS = [
  { left: "66%", top: "28%", color: "#3FE0B0", ping: true },
  { left: "30%", top: "60%", color: "#FFB547", ping: true },
  { left: "58%", top: "70%", color: "#3FE0B0", ping: false },
  { left: "22%", top: "30%", color: "#3FE0B0", ping: false },
];

const ring = (inset: string) => (
  <div
    style={{
      position: "absolute",
      inset,
      borderRadius: "50%",
      border: "1px solid rgba(155,132,238,0.28)",
    }}
  />
);

export const RadarLoading = ({ label = "Уншиж байна ..." }: { label?: string }) => (
  <div
    role="status"
    aria-live="polite"
    className="classradar:flex classradar:flex-col classradar:items-center classradar:justify-center"
    style={{ flex: 1, gap: 32, padding: 24, minHeight: 0 }}
  >
    <div
      aria-hidden
      style={{
        perspective: 1100,
        width: "min(520px, 90%)",
        height: "min(300px, 40vh)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(460px, 100%)",
          aspectRatio: "1 / 1",
          transform: "rotateX(58deg)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,77,255,0.18) 0%, rgba(11,7,22,0) 70%)",
          boxShadow: "0 0 0 1px rgba(155,132,238,0.35), 0 40px 120px -20px rgba(124,77,255,0.65)",
        }}
      >
        {ring("12%")}
        {ring("26%")}
        {ring("40%")}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "rgba(155,132,238,0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            background: "rgba(155,132,238,0.22)",
          }}
        />
        <div
          className="classradar-spin"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, rgba(138,99,255,0.70), rgba(138,99,255,0) 22%, rgba(138,99,255,0) 100%)",
          }}
        />
        {BLIPS.map((blip) => (
          <span key={`${blip.left}-${blip.top}`}>
            <span
              style={{
                position: "absolute",
                left: blip.left,
                top: blip.top,
                width: 12,
                height: 12,
                borderRadius: 6,
                background: blip.color,
                boxShadow: `0 0 16px ${blip.color}`,
              }}
            />
            {blip.ping && (
              <span
                className="classradar-ping"
                style={{
                  position: "absolute",
                  left: blip.left,
                  top: blip.top,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  border: `2px solid ${blip.color}`,
                  boxSizing: "border-box",
                }}
              />
            )}
          </span>
        ))}
        <span
          style={{
            position: "absolute",
            left: "48%",
            top: "48%",
            width: 16,
            height: 16,
            borderRadius: 8,
            background: "#FFFFFF",
            boxShadow: "0 0 24px #B9A2FF",
          }}
        />
      </div>
    </div>
    <div
      className="classradar:flex classradar:flex-col classradar:items-center"
      style={{ gap: 14 }}
    >
      <h1
        style={{
          margin: 0,
          fontWeight: 600,
          fontSize: "clamp(24px, 3.2vw, 36px)",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </h1>
      <div
        style={{
          width: 280,
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          className="classradar-load"
          style={{
            height: 6,
            borderRadius: 3,
            background: "linear-gradient(90deg, #5629B6, #B9A2FF)",
            boxShadow: "0 0 12px rgba(138,99,255,0.9)",
          }}
        />
      </div>
    </div>
  </div>
);
