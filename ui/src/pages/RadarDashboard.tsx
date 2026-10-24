import { useQuery } from "@apollo/client";
import { useEffect, useState, type CSSProperties } from "react";
import type { ClassradarDashboardQuery } from "~/gql/graphql";
import { CLASS_RADAR_QUERY } from "../graphql";
import { RadarLoading } from "./RadarLoading";

// Visuals follow the "Багш · Ангийн радар" design: a dark violet room, the
// seat map tilted like a classroom floor. The right column answers "who needs
// me now": students sorted by how long they have been stuck, and the picked
// seat's details. Exact colors, gradients and 3D transforms are inline
// styles; layout uses the prefixed Tailwind utilities.

type Seat = ClassradarDashboardQuery["classradarSeats"][number];
type Status = Seat["status"];

const ACCENT = "#5629B6";
const POLL_MS = 5000;
const SEATS_PER_ROW = 6;
// The loading radar stays at least this long so it reads as a moment, not a flash.
const MIN_LOADING_MS = 1200;

const STATUS: Record<
  Status,
  {
    short: string;
    label: string;
    fg: string;
    glow: string;
    face: string;
    border: string;
    shadow: string;
  }
> = {
  working: {
    short: "● OK",
    label: "● Ажиллаж байна",
    fg: "#3FE0B0",
    glow: "rgba(63,224,176,0.6)",
    face: "linear-gradient(180deg, rgba(63,224,176,0.20), rgba(63,224,176,0.06))",
    border: "1px solid rgba(63,224,176,0.45)",
    shadow:
      "0 7px 0 #0D2A22, 0 14px 24px -8px rgba(63,224,176,0.35), inset 0 1px 0 rgba(255,255,255,0.10)",
  },
  error: {
    short: "▲ Алдаа",
    label: "▲ Алдаатай",
    fg: "#FFB547",
    glow: "rgba(255,181,71,0.6)",
    face: "linear-gradient(180deg, rgba(255,181,71,0.22), rgba(255,181,71,0.06))",
    border: "1px solid rgba(255,181,71,0.50)",
    shadow:
      "0 7px 0 #33230A, 0 14px 24px -8px rgba(255,181,71,0.35), inset 0 1px 0 rgba(255,255,255,0.10)",
  },
  stuck: {
    short: "■ Гацсан",
    label: "■ Гацсан",
    fg: "#FF8A8A",
    glow: "rgba(255,122,122,0.7)",
    face: "linear-gradient(180deg, rgba(255,122,122,0.28), rgba(255,122,122,0.08))",
    border: "1px solid rgba(255,122,122,0.65)",
    shadow:
      "0 7px 0 #3A1414, 0 16px 30px -8px rgba(255,122,122,0.55), inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  absent: {
    short: "○ Ирээгүй",
    label: "○ Ирээгүй",
    fg: "#8C86A6",
    glow: "rgba(140,134,166,0.4)",
    face: "rgba(255,255,255,0.03)",
    border: "1px dashed rgba(255,255,255,0.16)",
    shadow: "none",
  },
};

const LEGEND: { status: Status; text: string; mark: string }[] = [
  { status: "working", text: "Ажиллаж байна", mark: "●" },
  { status: "error", text: "Алдаатай", mark: "▲" },
  { status: "stuck", text: "5+ мин гацсан", mark: "■" },
  { status: "absent", text: "Ирээгүй", mark: "○" },
];

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const DISPLAY = "'Unbounded', var(--font-sans), sans-serif";

const seatNumber = (seat: string | null) => {
  const number = Number(seat?.replace(/\D/g, ""));
  return seat && Number.isInteger(number) && number > 0 ? number : null;
};

const statusText = (seat: Seat) =>
  seat.status === "stuck" ? `■ ${seat.errorMinutes ?? 5} минут гацсан` : STATUS[seat.status].label;

const errorText = (seat: Seat) => {
  if (seat.status === "absent") return "Холбогдоогүй";
  if (!seat.errorTitle) return "Алдаагүй ажиллаж байна";
  const where = seat.errorFile ? ` · ${seat.errorFile}:${seat.errorLine ?? ""}` : "";
  return `${seat.errorTitle}${where}`;
};

/** Floor plan: rows of six with an aisle in the middle; empty slots stay blank. */
const buildRows = (seats: Seat[]) => {
  const byNumber = new Map<number, Seat>();
  const unnumbered: Seat[] = [];
  for (const seat of seats) {
    const number = seatNumber(seat.seat);
    if (number && !byNumber.has(number)) byNumber.set(number, seat);
    else unnumbered.push(seat);
  }
  const highest = Math.max(SEATS_PER_ROW * 4, ...byNumber.keys());
  const slots: (Seat | null)[] = Array.from(
    { length: Math.ceil(highest / SEATS_PER_ROW) * SEATS_PER_ROW },
    (_, i) => byNumber.get(i + 1) ?? null,
  );
  for (const seat of unnumbered) {
    const free = slots.indexOf(null);
    if (free === -1) slots.push(seat);
    else slots[free] = seat;
  }
  const rows: (Seat | null)[][] = [];
  for (let i = 0; i < slots.length; i += SEATS_PER_ROW) {
    rows.push(slots.slice(i, i + SEATS_PER_ROW));
  }
  return rows;
};

const Dots = ({ used, size = 10 }: { used: number; size?: number }) => (
  <span className="classradar:flex classradar:gap-1" aria-label={`${used}/3 сэжүүр`}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          boxSizing: "border-box",
          background: i < used ? "#9B84EE" : "transparent",
          border: i < used ? 0 : "1px solid #6E6888",
        }}
      />
    ))}
  </span>
);

const firstName = (seat: Seat) =>
  (seat.name ?? seat.studentEmail.split("@")[0] ?? "").split(" ")[0];

/** Who needs the teacher first: stuck longest, then fresh errors. */
const needsAttention = (seats: Seat[]) =>
  seats
    .filter((seat) => seat.status === "stuck" || seat.status === "error")
    .sort(
      (a, b) =>
        Number(b.status === "stuck") - Number(a.status === "stuck") ||
        (b.errorMinutes ?? 0) - (a.errorMinutes ?? 0),
    );

const SeatButton = ({
  seat,
  selected,
  onPick,
}: {
  seat: Seat;
  selected: boolean;
  onPick: () => void;
}) => {
  const look = STATUS[seat.status];
  const footer =
    seat.status === "stuck" ? (
      <span style={{ fontSize: 11, fontWeight: 800, color: look.fg }}>
        ■ {seat.errorMinutes} мин
      </span>
    ) : seat.status === "error" ? (
      <Dots used={seat.hintsUsed} size={7} />
    ) : (
      <span style={{ fontSize: 11, fontWeight: 700, color: look.fg }}>{look.short}</span>
    );
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Суудал ${seat.seat ?? ""}, ${seat.name ?? seat.studentEmail}, ${statusText(seat)}`}
      aria-pressed={selected}
      className={seat.status === "stuck" ? "classradar-alarm" : undefined}
      style={{
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "inherit",
        textAlign: "left",
        color: seat.status === "absent" ? "#8C86A6" : "#F1EEFA",
        borderRadius: 12,
        padding: "8px 10px 9px",
        height: "100%",
        minHeight: 52,
        background: look.face,
        border: selected ? "2px solid #FFFFFF" : look.border,
        boxShadow: selected ? `${look.shadow}, 0 0 0 4px rgba(255,255,255,0.12)` : look.shadow,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 4,
        cursor: "pointer",
        transform: selected ? "translateZ(14px)" : undefined,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <span className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-1">
        <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.75 }}>{seat.seat ?? "—"}</span>
        {seat.understood && (
          <span style={{ fontSize: 11, color: "#3FE0B0" }} title="Ойлгосон">
            ✓
          </span>
        )}
      </span>
      <span
        className="classradar:truncate"
        style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}
      >
        {firstName(seat)}
      </span>
      {footer}
    </button>
  );
};

const SeatMap = ({
  seats,
  selected,
  onPick,
}: {
  seats: Seat[];
  selected: string | null;
  onPick: (id: string | null) => void;
}) => {
  const rows = buildRows(seats);
  return (
    <section
      aria-label="Ангийн суудлын зураг"
      style={{
        perspective: 1400,
        perspectiveOrigin: "50% 0%",
        maxWidth: 860,
        width: "100%",
        margin: "0 auto",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          transform: "rotateX(12deg)",
          transformOrigin: "50% 0%",
          transformStyle: "preserve-3d",
          borderRadius: 22,
          padding: "22px 24px 28px",
          backgroundColor: "#120A26",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(155,132,238,0.07) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, rgba(155,132,238,0.07) 0 1px, transparent 1px 48px)",
          boxShadow:
            "0 50px 70px -30px rgba(124,77,255,0.5), inset 0 0 0 1px rgba(155,132,238,0.20)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          position: "relative",
          overflow: "hidden",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div aria-hidden className="classradar-sweep" />
        <div className="classradar:flex classradar:flex-col classradar:items-center classradar:gap-2">
          <div
            style={{
              width: "60%",
              height: 10,
              borderRadius: 5,
              background:
                "linear-gradient(90deg, rgba(138,99,255,0.2), #8A63FF, rgba(138,99,255,0.2))",
              boxShadow: "0 0 28px rgba(138,99,255,0.8)",
            }}
          />
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: "#A9A3BF" }}>
            САМБАР
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr)) 28px repeat(3, minmax(0, 1fr))",
            // Rows share the height left on screen, so the room always fits.
            gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))`,
            flex: 1,
            minHeight: 0,
            gap: "14px 12px",
            transformStyle: "preserve-3d",
            position: "relative",
          }}
        >
          {rows.flatMap((row, r) => {
            // Three seats, the aisle, three seats.
            const cells = [...row.slice(0, 3), "aisle" as const, ...row.slice(3)];
            return cells.map((seat, c) => {
              const key = `${r}-${c}`;
              if (seat === "aisle" || seat === null || seat === undefined) {
                return <div key={key} aria-hidden />;
              }
              const id = seat.studentEmail;
              return (
                <SeatButton
                  key={key}
                  seat={seat}
                  selected={selected === id}
                  onPick={() => onPick(selected === id ? null : id)}
                />
              );
            });
          })}
        </div>
      </div>
    </section>
  );
};

const StatTile = ({ status, label, count }: { status: Status; label: string; count: number }) => {
  const look = STATUS[status];
  return (
    <div
      className={status === "stuck" && count > 0 ? "classradar-alarm" : undefined}
      style={{
        flex: "1 1 150px",
        borderRadius: 16,
        padding: "14px 18px",
        background: look.glow.replace(/[\d.]+\)$/, "0.08)"),
        border: `1px solid ${look.glow.replace(/[\d.]+\)$/, "0.32)")}`,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, color: "#E3DEF2" }}>{label}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, color: look.fg }}>
        {count}
      </span>
    </div>
  );
};

const panel: CSSProperties = {
  borderRadius: 16,
  padding: "4px 18px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const SeatDetail = ({ seat, onClose }: { seat: Seat; onClose: () => void }) => {
  const look = STATUS[seat.status];
  return (
    <div
      className="classradar-rise"
      style={{
        borderRadius: 16,
        padding: "16px 18px",
        background: "linear-gradient(170deg, rgba(42,26,86,0.97), rgba(18,10,38,0.97))",
        border: `1px solid ${look.fg}`,
        boxShadow: `0 0 30px -8px ${look.glow}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-2">
        <span
          style={{
            fontFamily: MONO,
            fontSize: 12,
            padding: "3px 8px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.08)",
          }}
        >
          {seat.seat ?? "—"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Хаах"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "transparent",
            color: "#C7C1DA",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{seat.name ?? seat.studentEmail}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: look.fg }}>{statusText(seat)}</div>
      <div style={{ fontSize: 13, color: "#E3DEF2" }}>{errorText(seat)}</div>
      {seat.errorMessage && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: "#A9A3BF", wordBreak: "break-word" }}>
          {seat.errorMessage}
        </div>
      )}
      {seat.status !== "absent" && seat.status !== "working" && (
        <div
          className="classradar:flex classradar:items-center classradar:justify-between"
          style={{
            fontSize: 12,
            color: "#C7C1DA",
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span>{seat.understood ? "✓ Ойлгосон" : "Ашигласан сэжүүр"}</span>
          <Dots used={seat.hintsUsed} />
        </div>
      )}
    </div>
  );
};

/** Centered page column shared by every row. */
const column: CSSProperties = {
  width: "100%",
  maxWidth: 1240,
  boxSizing: "border-box",
  paddingLeft: "clamp(16px, 3vw, 32px)",
  paddingRight: "clamp(16px, 3vw, 32px)",
};

const panelHeading: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "#A9A3BF",
};

const Notice = ({ children }: { children: string }) => (
  <div role="status" style={{ ...panel, padding: 24, color: "#C7C1DA", fontSize: 14 }}>
    {children}
  </div>
);

export const RadarDashboard = () => {
  const [classCode, setClassCode] = useState("10A");
  const [draft, setDraft] = useState("10A");
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, error, refetch } = useQuery(CLASS_RADAR_QUERY, {
    variables: { classCode },
    pollInterval: POLL_MS,
  });

  const seats = data?.classradarSeats ?? [];
  const topErrors = data?.classradarTopErrors ?? [];
  const count = (status: Status) => seats.filter((seat) => seat.status === status).length;
  const present = seats.length - count("absent");
  const attention = needsAttention(seats);
  const selectedSeat = seats.find((seat) => seat.studentEmail === selected);
  const teacherEmail = data?.classradarStatus.userEmail;

  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  if ((loading && !data) || (!minElapsed && !error)) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "radial-gradient(1200px 600px at 50% 70%, #24124F 0%, #0B0716 62%)",
          color: "#F1EEFA",
          overflow: "hidden",
        }}
      >
        <RadarLoading />
      </div>
    );
  }

  return (
    <div
      style={{
        // Exactly the screen height left by erxes; scrolls only when too small.
        height: "100%",
        overflow: "auto",
        boxSizing: "border-box",
        background: "radial-gradient(1100px 600px at 50% 0%, #1E1040 0%, #0B0716 62%)",
        color: "#F1EEFA",
        display: "flex",
        flexDirection: "column",
        // Centered and capped, so it sits right with the erxes sidebar open or closed.
        alignItems: "center",
        gap: 16,
        paddingBottom: 20,
      }}
    >
      <div
        className="classradar:flex classradar:flex-wrap classradar:items-center classradar:justify-between classradar:gap-4"
        style={{ ...column, paddingTop: 24 }}
      >
        <div className="classradar:flex classradar:flex-wrap classradar:items-center classradar:gap-4">
          <form
            className="classradar:flex classradar:items-center classradar:gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const next = draft.trim();
              if (next) setClassCode(next);
            }}
          >
            <label htmlFor="classradar-class" style={{ fontSize: 13, color: "#A9A3BF" }}>
              Анги
            </label>
            <input
              id="classradar-class"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => draft.trim() && setClassCode(draft.trim())}
              style={{
                width: 84,
                fontFamily: DISPLAY,
                fontSize: 22,
                fontWeight: 700,
                color: "#F1EEFA",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "4px 10px",
              }}
            />
          </form>
          <span style={{ fontSize: 14, color: "#A9A3BF" }}>
            {present}/{seats.length} сурагч ирсэн
          </span>
          <span
            className="classradar:flex classradar:items-center classradar:gap-2"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: error ? "#FF8A8A" : "#3FE0B0",
              padding: "6px 12px",
              borderRadius: 999,
              background: error ? "rgba(255,122,122,0.10)" : "rgba(63,224,176,0.10)",
              border: `1px solid ${error ? "rgba(255,122,122,0.35)" : "rgba(63,224,176,0.35)"}`,
            }}
          >
            <span style={{ position: "relative", width: 8, height: 8 }}>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 4,
                  background: "currentColor",
                }}
              />
              {!error && (
                <span
                  className="classradar-ping"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 4,
                    border: "2px solid currentColor",
                    boxSizing: "border-box",
                  }}
                />
              )}
            </span>
            {error ? "Холболт тасарсан" : "Шууд"}
          </span>
        </div>
        <div
          className="classradar:flex classradar:flex-wrap classradar:gap-4"
          style={{ fontSize: 12, color: "#C7C1DA" }}
        >
          {teacherEmail && (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Багш · {teacherEmail}
            </span>
          )}
          {LEGEND.map(({ status, text, mark }) => (
            <span key={status}>
              <span style={{ color: STATUS[status].fg }}>{mark}</span> {text}
            </span>
          ))}
        </div>
      </div>

      <div className="classradar:flex classradar:flex-wrap classradar:gap-3" style={column}>
        <StatTile status="working" label="● Ажиллаж байна" count={count("working")} />
        <StatTile status="error" label="▲ Алдаатай" count={count("error")} />
        <StatTile status="stuck" label="■ 5+ мин гацсан" count={count("stuck")} />
        <StatTile status="absent" label="○ Ирээгүй" count={count("absent")} />
      </div>

      <main
        className="classradar:flex classradar:flex-wrap classradar:justify-center classradar:gap-6 classradar:lg:flex-nowrap"
        style={{ ...column, flex: "1 1 0", minHeight: 380, alignItems: "stretch" }}
      >
        <div
          style={{
            flex: "999 1 540px",
            minWidth: 0,
            maxWidth: 860,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {error && !data ? (
            <div>
              <Notice>{`Мэдээлэл авч чадсангүй: ${error.message}`}</Notice>
              <button
                type="button"
                onClick={() => refetch()}
                style={{
                  marginTop: 12,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: 0,
                  color: "#fff",
                  background: ACCENT,
                  cursor: "pointer",
                }}
              >
                Дахин оролдох
              </button>
            </div>
          ) : seats.length === 0 ? (
            <Notice>
              {`${classCode} ангид сурагч алга байна. Сурагчид VS Code extension-ээ асаагаад файлаа хадгалмагц энд гарч ирнэ.`}
            </Notice>
          ) : (
            <SeatMap seats={seats} selected={selected} onPick={setSelected} />
          )}
        </div>

        <aside
          className="classradar:flex classradar:flex-col classradar:gap-5"
          style={{ flex: "1 1 280px", maxWidth: 360, minWidth: 0, minHeight: 0, overflowY: "auto" }}
        >
          {selectedSeat && <SeatDetail seat={selectedSeat} onClose={() => setSelected(null)} />}

          <section
            aria-labelledby="classradar-attention"
            className="classradar:flex classradar:flex-col classradar:gap-2"
          >
            <h2 id="classradar-attention" style={panelHeading}>
              АНХААРАХ · {attention.length}
            </h2>
            <div style={panel}>
              {loading && !data ? (
                <div className="classradar:animate-pulse" style={{ height: 120 }} />
              ) : attention.length === 0 ? (
                <div style={{ padding: "14px 0", fontSize: 13, color: "#3FE0B0" }}>
                  ● Бүгд ажиллаж байна
                </div>
              ) : (
                attention.slice(0, 6).map((seat, index) => {
                  const look = STATUS[seat.status];
                  return (
                    <button
                      key={seat.studentEmail}
                      type="button"
                      onClick={() => setSelected(seat.studentEmail)}
                      aria-pressed={selected === seat.studentEmail}
                      className="classradar:flex classradar:w-full classradar:items-center classradar:gap-3"
                      style={{
                        padding: "11px 0",
                        background: "transparent",
                        border: 0,
                        borderBottom:
                          index < Math.min(attention.length, 6) - 1
                            ? "1px solid rgba(255,255,255,0.06)"
                            : 0,
                        color: "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          padding: "3px 6px",
                          borderRadius: 6,
                          color: look.fg,
                          border: `1px solid ${look.fg}`,
                          minWidth: 30,
                          textAlign: "center",
                        }}
                      >
                        {seat.seat ?? "—"}
                      </span>
                      <span className="classradar:flex classradar:min-w-0 classradar:flex-1 classradar:flex-col">
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{firstName(seat)}</span>
                        <span
                          className="classradar:truncate"
                          style={{ fontSize: 12, color: "#A9A3BF" }}
                        >
                          {seat.errorTitle ?? "—"}
                        </span>
                      </span>
                      <span className="classradar:flex classradar:flex-col classradar:items-end classradar:gap-1">
                        <span style={{ fontSize: 12, fontWeight: 800, color: look.fg }}>
                          {seat.status === "stuck" ? `${seat.errorMinutes} мин` : "шинэ"}
                        </span>
                        <Dots used={seat.hintsUsed} size={7} />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section
            aria-labelledby="classradar-top"
            className="classradar:flex classradar:flex-col classradar:gap-2"
          >
            <h2 id="classradar-top" style={panelHeading}>
              ДАВТАГДСАН АЛДАА · ӨНӨӨДӨР
            </h2>
            <div style={panel}>
              {loading && !data ? (
                <div className="classradar:animate-pulse" style={{ height: 150 }} />
              ) : topErrors.length === 0 ? (
                <div style={{ padding: "14px 0", fontSize: 13, color: "#A9A3BF" }}>
                  Өнөөдөр давтагдсан алдаа алга.
                </div>
              ) : (
                topErrors.map((item, index) => {
                  const share = item.count / Math.max(...topErrors.map((t) => t.count));
                  return (
                    <div
                      key={item.normalizedKey}
                      className="classradar:flex classradar:flex-col classradar:gap-1.5"
                      style={{
                        padding: "12px 0",
                        borderBottom:
                          index < topErrors.length - 1 ? "1px solid rgba(255,255,255,0.06)" : 0,
                      }}
                    >
                      <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-3">
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                        <span style={{ fontFamily: DISPLAY, fontSize: 18, color: "#B9A2FF" }}>
                          {item.count}
                        </span>
                      </div>
                      <div
                        aria-hidden
                        style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}
                      >
                        <div
                          style={{
                            width: `${Math.round(share * 100)}%`,
                            height: "100%",
                            borderRadius: 2,
                            background: "linear-gradient(90deg, #5629B6, #B9A2FF)",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span
                        className="classradar:truncate"
                        title={item.sampleMessage}
                        style={{ fontFamily: MONO, fontSize: 11, color: "#A9A3BF" }}
                      >
                        {item.sampleMessage}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
};
