import { useQuery } from "@apollo/client";
import { IconAlertTriangle, IconRadar, IconRefresh, IconX } from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui` as a Module Federation
// singleton keyed on the bare specifier.
import { Badge, Button, Card, Empty, Input, Label, ScrollArea, Tooltip, cn } from "erxes-ui";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import type { ClassradarDashboardQuery } from "~/gql/graphql";
import { CLASS_RADAR_QUERY } from "../graphql";
import { RadarLoading } from "./RadarLoading";

// The teacher's live classroom, built from erxes-ui components and the host's
// theme tokens so it matches the rest of erxes in light and dark mode. Layout
// follows the "Багш · Ангийн радар" design: seat map on the left, "who needs
// me now" and the most repeated errors on the right.

type Seat = ClassradarDashboardQuery["classradarSeats"][number];
type Status = Seat["status"];

const POLL_MS = 5000;
const SEATS_PER_ROW = 6;
// The loading radar stays at least this long so it reads as a moment, not a flash.
const MIN_LOADING_MS = 1200;

const STATUS: Record<
  Status,
  {
    label: string;
    short: string;
    badge: "success" | "warning" | "destructive" | "secondary";
    seat: string;
    text: string;
  }
> = {
  working: {
    label: "Ажиллаж байна",
    short: "OK",
    badge: "success",
    seat: "classradar:border-success/50 classradar:bg-success/10",
    text: "classradar:text-success",
  },
  error: {
    label: "Алдаатай",
    short: "Алдаа",
    badge: "warning",
    seat: "classradar:border-warning/60 classradar:bg-warning/15",
    text: "classradar:text-warning",
  },
  stuck: {
    label: "5+ мин гацсан",
    short: "Гацсан",
    badge: "destructive",
    seat: "classradar:border-destructive/70 classradar:bg-destructive/15 classradar-alarm",
    text: "classradar:text-destructive",
  },
  absent: {
    label: "Ирээгүй",
    short: "Ирээгүй",
    badge: "secondary",
    seat: "classradar:border-dashed classradar:border-border classradar:bg-transparent",
    text: "classradar:text-muted-foreground",
  },
};

const STATUSES: Status[] = ["working", "error", "stuck", "absent"];

const seatNumber = (seat: string | null) => {
  const number = Number(seat?.replace(/\D/g, ""));
  return seat && Number.isInteger(number) && number > 0 ? number : null;
};

const firstName = (seat: Seat) =>
  (seat.name ?? seat.studentEmail.split("@")[0] ?? "").split(" ")[0];

const statusText = (seat: Seat) =>
  seat.status === "stuck" ? `${seat.errorMinutes ?? 5} минут гацсан` : STATUS[seat.status].label;

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

/** Who needs the teacher first: stuck longest, then fresh errors. */
const needsAttention = (seats: Seat[]) =>
  seats
    .filter((seat) => seat.status === "stuck" || seat.status === "error")
    .sort(
      (a, b) =>
        Number(b.status === "stuck") - Number(a.status === "stuck") ||
        (b.errorMinutes ?? 0) - (a.errorMinutes ?? 0),
    );

const Dots = ({ used }: { used: number }) => (
  <span className="classradar:flex classradar:gap-1" aria-label={`${used}/3 сэжүүр`}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className={cn(
          "classradar:size-2 classradar:rounded-full classradar:border",
          i < used
            ? "classradar:border-primary classradar:bg-primary"
            : "classradar:border-muted-foreground/50",
        )}
      />
    ))}
  </span>
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
  return (
    <Tooltip>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onPick}
          aria-pressed={selected}
          aria-label={`Суудал ${seat.seat ?? ""}, ${seat.name ?? seat.studentEmail}, ${statusText(seat)}`}
          className={cn(
            "classradar:flex classradar:h-full classradar:min-h-14 classradar:w-full classradar:flex-col classradar:justify-between classradar:gap-1 classradar:rounded-lg classradar:border classradar:px-2.5 classradar:py-2 classradar:text-left classradar:shadow-xs classradar:transition-transform classradar:hover:-translate-y-0.5",
            look.seat,
            selected && "classradar:ring-2 classradar:ring-primary classradar:ring-offset-2",
            seat.status === "absent" && "classradar:text-muted-foreground",
          )}
        >
          <span className="classradar:flex classradar:items-center classradar:justify-between classradar:font-mono classradar:text-xs classradar:text-muted-foreground">
            {seat.seat ?? "—"}
            {seat.understood && <span className="classradar:text-success">✓</span>}
          </span>
          <span className="classradar:truncate classradar:text-sm classradar:font-semibold">
            {firstName(seat)}
          </span>
          {seat.status === "stuck" ? (
            <span className={cn("classradar:text-xs classradar:font-bold", look.text)}>
              {seat.errorMinutes} мин
            </span>
          ) : seat.status === "error" ? (
            <Dots used={seat.hintsUsed} />
          ) : (
            <span className={cn("classradar:text-xs classradar:font-medium", look.text)}>
              {look.short}
            </span>
          )}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        {seat.name ?? seat.studentEmail} · {errorText(seat)}
      </Tooltip.Content>
    </Tooltip>
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
    <Card className="classradar:flex classradar:h-full classradar:min-h-0 classradar:flex-col">
      <Card.Header className="classradar:items-center">
        <div
          aria-hidden
          className="classradar:h-2 classradar:w-3/5 classradar:rounded-full classradar:bg-primary/70"
        />
        <Card.Description className="classradar:tracking-widest">САМБАР</Card.Description>
      </Card.Header>
      <Card.Content className="classradar:min-h-0 classradar:flex-1">
        <div
          role="group"
          aria-label="Ангийн суудлын зураг"
          className="classradar:grid classradar:h-full classradar:gap-3"
          style={{
            gridTemplateColumns: "repeat(3, minmax(0, 1fr)) 1.5rem repeat(3, minmax(0, 1fr))",
            // Rows share the height left on screen, so the room always fits.
            gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))`,
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
      </Card.Content>
    </Card>
  );
};

const StatTile = ({ status, count }: { status: Status; count: number }) => (
  <Card
    className={cn(
      "classradar:flex-1 classradar:basis-36",
      status === "stuck" && count > 0 && "classradar-alarm",
    )}
  >
    <Card.Content className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-3 classradar:p-4">
      <Badge variant={STATUS[status].badge}>{STATUS[status].label}</Badge>
      <span className={cn("classradar:text-2xl classradar:font-bold", STATUS[status].text)}>
        {count}
      </span>
    </Card.Content>
  </Card>
);

const SeatDetail = ({ seat, onClose }: { seat: Seat; onClose: () => void }) => (
  <Card className="classradar-rise">
    <Card.Header className="classradar:flex-row classradar:items-start classradar:justify-between classradar:gap-2">
      <div className="classradar:flex classradar:flex-col classradar:gap-1">
        <Card.Description className="classradar:font-mono">{seat.seat ?? "—"}</Card.Description>
        <Card.Title>{seat.name ?? seat.studentEmail}</Card.Title>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Хаах">
        <IconX />
      </Button>
    </Card.Header>
    <Card.Content className="classradar:flex classradar:flex-col classradar:gap-2 classradar:text-sm">
      <div>
        <Badge variant={STATUS[seat.status].badge}>{statusText(seat)}</Badge>
      </div>
      <div>{errorText(seat)}</div>
      {seat.errorMessage && (
        <code className="classradar:break-words classradar:rounded classradar:bg-muted classradar:px-2 classradar:py-1 classradar:font-mono classradar:text-xs">
          {seat.errorMessage}
        </code>
      )}
      {(seat.status === "error" || seat.status === "stuck") && (
        <div className="classradar:flex classradar:items-center classradar:justify-between classradar:border-t classradar:border-border classradar:pt-2 classradar:text-muted-foreground">
          <span>{seat.understood ? "✓ Ойлгосон" : "Ашигласан сэжүүр"}</span>
          <Dots used={seat.hintsUsed} />
        </div>
      )}
    </Card.Content>
  </Card>
);

const AttentionList = ({
  seats,
  selected,
  onPick,
}: {
  seats: Seat[];
  selected: string | null;
  onPick: (id: string) => void;
}) => (
  <Card>
    <Card.Header>
      <Card.Title className="classradar:text-sm">Анхаарах · {seats.length}</Card.Title>
      <Card.Description>Хамгийн удаан гацсан нь эхэндээ</Card.Description>
    </Card.Header>
    <Card.Content className="classradar:flex classradar:flex-col">
      {seats.length === 0 ? (
        <span className="classradar:text-sm classradar:text-success">Бүгд ажиллаж байна</span>
      ) : (
        seats.slice(0, 6).map((seat) => (
          <Button
            key={seat.studentEmail}
            variant="ghost"
            onClick={() => onPick(seat.studentEmail)}
            aria-pressed={selected === seat.studentEmail}
            className="classradar:h-auto classradar:justify-start classradar:gap-3 classradar:px-2 classradar:py-2"
          >
            <Badge variant={STATUS[seat.status].badge} className="classradar:font-mono">
              {seat.seat ?? "—"}
            </Badge>
            <span className="classradar:flex classradar:min-w-0 classradar:flex-1 classradar:flex-col classradar:items-start">
              <span className="classradar:font-semibold">{firstName(seat)}</span>
              <span className="classradar:w-full classradar:truncate classradar:text-left classradar:text-xs classradar:text-muted-foreground">
                {seat.errorTitle ?? "—"}
              </span>
            </span>
            <span className="classradar:flex classradar:flex-col classradar:items-end classradar:gap-1">
              <span
                className={cn("classradar:text-xs classradar:font-bold", STATUS[seat.status].text)}
              >
                {seat.status === "stuck" ? `${seat.errorMinutes} мин` : "шинэ"}
              </span>
              <Dots used={seat.hintsUsed} />
            </span>
          </Button>
        ))
      )}
    </Card.Content>
  </Card>
);

const TopErrors = ({ items }: { items: ClassradarDashboardQuery["classradarTopErrors"] }) => {
  const most = Math.max(1, ...items.map((item) => item.count));
  return (
    <Card>
      <Card.Header>
        <Card.Title className="classradar:text-sm">Давтагдсан алдаа</Card.Title>
        <Card.Description>Өнөөдөр ангид хамгийн их гарсан</Card.Description>
      </Card.Header>
      <Card.Content className="classradar:flex classradar:flex-col classradar:gap-4">
        {items.length === 0 ? (
          <span className="classradar:text-sm classradar:text-muted-foreground">
            Өнөөдөр давтагдсан алдаа алга.
          </span>
        ) : (
          items.map((item) => (
            <div
              key={item.normalizedKey}
              className="classradar:flex classradar:flex-col classradar:gap-1.5"
            >
              <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-3">
                <span className="classradar:text-sm classradar:font-semibold">{item.title}</span>
                <span className="classradar:text-lg classradar:font-bold classradar:text-primary">
                  {item.count}
                </span>
              </div>
              <div
                aria-hidden
                className="classradar:h-1 classradar:rounded-full classradar:bg-muted"
              >
                <div
                  className="classradar:h-full classradar:rounded-full classradar:bg-primary classradar:transition-all"
                  style={{ width: `${Math.round((item.count / most) * 100)}%` }}
                />
              </div>
              <span
                title={item.sampleMessage}
                className="classradar:truncate classradar:font-mono classradar:text-xs classradar:text-muted-foreground"
              >
                {item.sampleMessage}
              </span>
            </div>
          ))
        )}
      </Card.Content>
    </Card>
  );
};

// The design's dark violet room, made by switching this page to erxes's own
// dark theme and pointing its tokens at the design's colors: every erxes-ui
// component below picks them up, no extra styling.
const RADAR_TOKENS = {
  "--background": "#120A26",
  "--foreground": "#F1EEFA",
  "--primary": "#8A63FF",
  "--primary-foreground": "#FFFFFF",
  "--secondary": "#2A1A56",
  "--muted": "#1E1040",
  "--muted-foreground": "#A9A3BF",
  "--accent": "#24124F",
  "--border": "#2E2252",
  "--input": "#2E2252",
  "--ring": "#8A63FF",
  "--success": "#3FE0B0",
  "--warning": "#FFB547",
  "--destructive": "#FF7A7A",
  background: "radial-gradient(1100px 600px at 50% 0%, #24124F 0%, #0B0716 62%)",
} as CSSProperties;

const RadarTheme = ({ children }: { children: ReactNode }) => (
  <div
    className="dark classradar:flex classradar:h-full classradar:flex-col classradar:text-foreground"
    style={RADAR_TOKENS}
  >
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

  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  if ((loading && !data) || (!minElapsed && !error)) {
    return (
      <RadarTheme>
        <RadarLoading />
      </RadarTheme>
    );
  }

  const seats = data?.classradarSeats ?? [];
  const count = (status: Status) => seats.filter((seat) => seat.status === status).length;
  const attention = needsAttention(seats);
  const selectedSeat = seats.find((seat) => seat.studentEmail === selected);
  const teacherEmail = data?.classradarStatus.userEmail;

  return (
    <RadarTheme>
      <Tooltip.Provider delayDuration={200}>
        <div className="classradar:mx-auto classradar:flex classradar:h-full classradar:w-full classradar:max-w-7xl classradar:flex-col classradar:gap-4 classradar:overflow-auto classradar:p-4 classradar:md:p-6">
          <div className="classradar:flex classradar:flex-wrap classradar:items-center classradar:justify-between classradar:gap-3">
            <form
              className="classradar:flex classradar:flex-wrap classradar:items-center classradar:gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const next = draft.trim();
                if (next) setClassCode(next);
              }}
            >
              <Label htmlFor="classradar-class">Анги</Label>
              <Input
                id="classradar-class"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => draft.trim() && setClassCode(draft.trim())}
                className="classradar:w-24 classradar:font-semibold"
              />
              <span className="classradar:text-sm classradar:text-muted-foreground">
                {seats.length - count("absent")}/{seats.length} сурагч ирсэн
              </span>
              <Badge variant={error ? "destructive" : "success"} className="classradar:gap-1.5">
                <span className="classradar:relative classradar:flex classradar:size-2">
                  <span className="classradar:absolute classradar:inset-0 classradar:rounded-full classradar:bg-current" />
                  {!error && (
                    <span className="classradar-ping classradar:absolute classradar:inset-0 classradar:rounded-full classradar:border-2 classradar:border-current" />
                  )}
                </span>
                {error ? "Холболт тасарсан" : "Шууд"}
              </Badge>
            </form>
            {teacherEmail && (
              <Badge variant="secondary" className="classradar:gap-1.5">
                <IconRadar className="classradar:size-3.5" />
                Багш · {teacherEmail}
              </Badge>
            )}
          </div>

          <div className="classradar:flex classradar:flex-wrap classradar:gap-3">
            {STATUSES.map((status) => (
              <StatTile key={status} status={status} count={count(status)} />
            ))}
          </div>

          <div className="classradar:flex classradar:min-h-96 classradar:flex-1 classradar:flex-wrap classradar:gap-4 classradar:lg:flex-nowrap">
            <div className="classradar:flex classradar:min-w-0 classradar:flex-[999_1_540px] classradar:flex-col">
              {error && !data ? (
                <Empty className="classradar:rounded-xl classradar:border classradar:border-border">
                  <Empty.Header>
                    <Empty.Media variant="icon">
                      <IconAlertTriangle />
                    </Empty.Media>
                    <Empty.Title>Мэдээлэл авч чадсангүй</Empty.Title>
                    <Empty.Description>{error.message}</Empty.Description>
                  </Empty.Header>
                  <Empty.Content>
                    <Button onClick={() => refetch()}>
                      <IconRefresh />
                      Дахин оролдох
                    </Button>
                  </Empty.Content>
                </Empty>
              ) : seats.length === 0 ? (
                <Empty className="classradar:rounded-xl classradar:border classradar:border-border">
                  <Empty.Header>
                    <Empty.Media variant="icon">
                      <IconRadar />
                    </Empty.Media>
                    <Empty.Title>{classCode} ангид сурагч алга</Empty.Title>
                    <Empty.Description>
                      Сурагчид VS Code extension-ээ асаагаад файлаа хадгалмагц энд гарч ирнэ.
                    </Empty.Description>
                  </Empty.Header>
                </Empty>
              ) : (
                <SeatMap seats={seats} selected={selected} onPick={setSelected} />
              )}
            </div>

            <ScrollArea className="classradar:min-h-0 classradar:flex-[1_1_300px] classradar:lg:max-w-sm">
              <div className="classradar:flex classradar:flex-col classradar:gap-4">
                {selectedSeat && (
                  <SeatDetail seat={selectedSeat} onClose={() => setSelected(null)} />
                )}
                <AttentionList seats={attention} selected={selected} onPick={setSelected} />
                <TopErrors items={data?.classradarTopErrors ?? []} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </Tooltip.Provider>
    </RadarTheme>
  );
};
