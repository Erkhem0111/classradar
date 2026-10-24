import { useQuery } from "@apollo/client";
import { useState, type CSSProperties } from "react";
import type { ClassradarDashboardQuery } from "~/gql/graphql";
import { CLASS_RADAR_QUERY } from "../graphql";

// Visuals follow the "Багш · Ангийн радар" design: a dark violet room, the
// seat map tilted like a classroom floor, a live summary on the right. Its
// exact colors, gradients and 3D transforms are inline styles; layout uses
// the prefixed Tailwind utilities.

type Seat = ClassradarDashboardQuery["classradarSeats"][number];
type Status = Seat["status"];

const ACCENT = "#5629B6";
const POLL_MS = 5000;
const SEATS_PER_ROW = 6;

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

const Dots = ({ used }: { used: number }) => (
  <span className="classradar:flex classradar:gap-1">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          boxSizing: "border-box",
          background: i < used ? "#9B84EE" : "transparent",
          border: i < used ? 0 : "1px solid #6E6888",
        }}
      />
    ))}
  </span>
);

const SeatPopover = ({ seat, onClose }: { seat: Seat; onClose: () => void }) => {
  const look = STATUS[seat.status];
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: "100%",
        width: 0,
        height: 0,
        transformStyle: "preserve-3d",
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -132,
          bottom: 0,
          width: 264,
          transformOrigin: "50% 100%",
          transform: "rotateX(-24deg)",
        }}
      >
        <div
          className="classradar-beam"
          style={{
            position: "absolute",
            left: 131,
            bottom: 0,
            width: 2,
            height: 22,
            background: `linear-gradient(0deg, ${look.fg}, rgba(255,255,255,0))`,
          }}
        />
        <div
          className="classradar-rise"
          style={{
            marginBottom: 22,
            borderRadius: 16,
            padding: "16px 16px 14px",
            background: "linear-gradient(170deg, rgba(42,26,86,0.97), rgba(18,10,38,0.97))",
            border: `1px solid ${look.fg}`,
            boxShadow: `0 18px 40px -12px rgba(0,0,0,0.8), 0 0 30px -6px ${look.glow}, inset 0 1px 0 rgba(255,255,255,0.10)`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            textAlign: "left",
          }}
        >
          <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-2">
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12,
                padding: "4px 8px",
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
            <div style={{ fontFamily: MONO, fontSize: 11, color: "#A9A3BF" }}>
              {seat.errorMessage}
            </div>
          )}
          <div
            className="classradar:flex classradar:items-center classradar:justify-between"
            style={{
              fontSize: 12,
              color: "#C7C1DA",
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span>{seat.understood ? "✓ Ойлгосон · сэжүүр" : "Ашигласан сэжүүр"}</span>
            <Dots used={seat.hintsUsed} />
          </div>
        </div>
      </div>
    </div>
  );
};

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
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Суудал ${seat.seat ?? ""}, ${seat.name ?? seat.studentEmail}, ${statusText(seat)}`}
      aria-pressed={selected}
      title={seat.name ?? seat.studentEmail}
      style={{
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "inherit",
        textAlign: "left",
        color: "#F1EEFA",
        borderRadius: 12,
        padding: "10px 12px 12px",
        minHeight: 66,
        background: look.face,
        border: selected ? "2px solid #FFFFFF" : look.border,
        boxShadow: selected ? `${look.shadow}, 0 0 0 4px rgba(255,255,255,0.10)` : look.shadow,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "pointer",
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500 }}>{seat.seat ?? "—"}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: look.fg }}>{look.short}</span>
    </button>
  );
};

const SeatMap = ({ seats }: { seats: Seat[] }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const rows = buildRows(seats);
  return (
    <section
      aria-label="Ангийн суудлын зураг"
      style={{ perspective: 1500, perspectiveOrigin: "50% 0%", paddingTop: 170 }}
    >
      <div
        style={{
          transform: "rotateX(24deg)",
          transformOrigin: "50% 0%",
          transformStyle: "preserve-3d",
          borderRadius: 22,
          padding: "26px 28px 36px",
          backgroundColor: "#120A26",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(155,132,238,0.07) 0 1px, transparent 1px 48px), repeating-linear-gradient(90deg, rgba(155,132,238,0.07) 0 1px, transparent 1px 48px)",
          boxShadow:
            "0 50px 70px -30px rgba(124,77,255,0.5), inset 0 0 0 1px rgba(155,132,238,0.20)",
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        <div className="classradar:flex classradar:flex-col classradar:items-center classradar:gap-2.5">
          <div
            style={{
              width: "64%",
              height: 12,
              borderRadius: 6,
              background:
                "linear-gradient(90deg, rgba(138,99,255,0.2), #8A63FF, rgba(138,99,255,0.2))",
              boxShadow: "0 0 28px rgba(138,99,255,0.8)",
            }}
          />
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "#A9A3BF" }}>
            САМБАР
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: "18px 14px",
            transformStyle: "preserve-3d",
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
              const isSelected = selected === id;
              return (
                <div key={key} style={{ position: "relative", transformStyle: "preserve-3d" }}>
                  <SeatButton
                    seat={seat}
                    selected={isSelected}
                    onPick={() => setSelected(isSelected ? null : id)}
                  />
                  {isSelected && <SeatPopover seat={seat} onClose={() => setSelected(null)} />}
                </div>
              );
            });
          })}
        </div>
      </div>
    </section>
  );
};

const SummaryRow = ({ status, label, count }: { status: Status; label: string; count: number }) => {
  const look = STATUS[status];
  return (
    <div
      className="classradar:flex classradar:items-center classradar:justify-between"
      style={{
        borderRadius: 16,
        padding: "16px 20px",
        background: look.glow.replace(/[\d.]+\)$/, "0.08)"),
        border: `1px solid ${look.glow.replace(/[\d.]+\)$/, "0.32)")}`,
      }}
    >
      <span style={{ fontSize: 14, color: "#E3DEF2" }}>{label}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: 24, color: look.fg }}>{count}</span>
    </div>
  );
};

const panelHeading: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "#A9A3BF",
};

const Notice = ({ children }: { children: string }) => (
  <div
    role="status"
    style={{
      borderRadius: 16,
      padding: "24px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "#C7C1DA",
      fontSize: 14,
    }}
  >
    {children}
  </div>
);

export const RadarDashboard = () => {
  const [classCode, setClassCode] = useState("10A");
  const [draft, setDraft] = useState("10A");
  const { data, loading, error, refetch } = useQuery(CLASS_RADAR_QUERY, {
    variables: { classCode },
    pollInterval: POLL_MS,
    notifyOnNetworkStatusChange: false,
  });

  const seats = data?.classradarSeats ?? [];
  const topErrors = data?.classradarTopErrors ?? [];
  const count = (status: Status) => seats.filter((seat) => seat.status === status).length;
  const present = seats.length - count("absent");

  return (
    <div
      style={{
        minHeight: "100%",
        boxSizing: "border-box",
        background: "radial-gradient(1100px 600px at 40% 10%, #1E1040 0%, #0B0716 62%)",
        color: "#F1EEFA",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="classradar:flex classradar:flex-wrap classradar:items-center classradar:justify-between classradar:gap-4"
        style={{ padding: "28px 32px 0" }}
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
                width: 90,
                fontFamily: DISPLAY,
                fontSize: 22,
                fontWeight: 600,
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
          className="classradar:flex classradar:flex-wrap classradar:gap-5"
          style={{ fontSize: 13, color: "#C7C1DA" }}
        >
          {LEGEND.map(({ status, text, mark }) => (
            <span key={status}>
              <span style={{ color: STATUS[status].fg }}>{mark}</span> {text}
            </span>
          ))}
        </div>
      </div>

      <main
        className="classradar:flex classradar:flex-wrap classradar:items-start classradar:gap-8"
        style={{ padding: "0 32px 40px" }}
      >
        <div style={{ flex: "999 1 640px", minWidth: 0 }}>
          {loading && !data ? (
            <div style={{ paddingTop: 170 }}>
              <div
                className="classradar:animate-pulse"
                style={{ height: 380, borderRadius: 22, background: "rgba(155,132,238,0.08)" }}
              />
            </div>
          ) : error && !data ? (
            <div style={{ paddingTop: 140 }}>
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
            <div style={{ paddingTop: 140 }}>
              <Notice>
                {`${classCode} ангид сурагч алга байна. Сурагчид VS Code extension-ээ асаагаад файлаа хадгалмагц энд гарч ирнэ.`}
              </Notice>
            </div>
          ) : (
            <SeatMap seats={seats} />
          )}
        </div>

        <aside
          className="classradar:flex classradar:flex-col classradar:gap-7"
          style={{ flex: "1 1 280px", maxWidth: 340, minWidth: 0, paddingTop: 140 }}
        >
          <section
            aria-labelledby="classradar-now"
            className="classradar:flex classradar:flex-col classradar:gap-3"
          >
            <h2 id="classradar-now" style={panelHeading}>
              АНГИ ОДОО
            </h2>
            <SummaryRow status="working" label="● Ажиллаж байна" count={count("working")} />
            <SummaryRow status="error" label="▲ Алдаатай" count={count("error")} />
            <SummaryRow status="stuck" label="■ Гацсан" count={count("stuck")} />
          </section>

          <section
            aria-labelledby="classradar-top"
            className="classradar:flex classradar:flex-col classradar:gap-3"
          >
            <h2 id="classradar-top" style={panelHeading}>
              ДАВТАГДСАН АЛДАА
            </h2>
            <div
              style={{
                borderRadius: 16,
                padding: "4px 20px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {loading && !data ? (
                <div className="classradar:animate-pulse" style={{ height: 150 }} />
              ) : topErrors.length === 0 ? (
                <div style={{ padding: "14px 0", fontSize: 13, color: "#A9A3BF" }}>
                  Өнөөдөр давтагдсан алдаа алга.
                </div>
              ) : (
                topErrors.map((item, index) => (
                  <div
                    key={item.normalizedKey}
                    className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-3"
                    style={{
                      padding: "14px 0",
                      borderBottom:
                        index < topErrors.length - 1 ? "1px solid rgba(255,255,255,0.06)" : 0,
                    }}
                  >
                    <div className="classradar:flex classradar:min-w-0 classradar:flex-col classradar:gap-1">
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
                      <span
                        className="classradar:truncate"
                        title={item.sampleMessage}
                        style={{ fontFamily: MONO, fontSize: 11, color: "#A9A3BF" }}
                      >
                        {item.sampleMessage}
                      </span>
                    </div>
                    <span style={{ fontFamily: DISPLAY, fontSize: 18, color: "#B9A2FF" }}>
                      {item.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
};
