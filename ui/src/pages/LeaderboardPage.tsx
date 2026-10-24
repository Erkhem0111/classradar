import { useQuery } from "@apollo/client";
import { IconRefresh, IconTrophy } from "@tabler/icons-react";
import { Button, Card, Empty, Input, Label, Skeleton, ToggleGroup } from "erxes-ui";
import { useState } from "react";
import { LEADERBOARD_QUERY } from "../graphql";
import { RadarTheme } from "./RadarDashboard";

// "Бүгд · Leaderboard" from the design, ranked by errors students fixed
// themselves: 10 points per fix, more when fewer tips were needed.

// Podium order left to right: 2nd, 1st, 3rd, as in the design.
const PODIUM = [
  {
    place: 2,
    height: 170,
    medal: "linear-gradient(145deg, #D9DCE8, #8D92A8)",
    ink: "#1B1830",
    block: "linear-gradient(180deg, #3A2A6E 0%, #1A1036 100%)",
  },
  {
    place: 1,
    height: 230,
    medal: "linear-gradient(145deg, #FFE08A, #E3A21A)",
    ink: "#2A1A00",
    block: "linear-gradient(180deg, #6A43E8 0%, #5629B6 45%, #1E0F45 100%)",
  },
  {
    place: 3,
    height: 130,
    medal: "linear-gradient(145deg, #F2B38A, #A8603A)",
    ink: "#2A1206",
    block: "linear-gradient(180deg, #32235F 0%, #170E31 100%)",
  },
];

export const LeaderboardPage = () => {
  const [range, setRange] = useState<"week" | "all">("week");
  const [classCode, setClassCode] = useState("10A");
  const [draft, setDraft] = useState("10A");
  const { data, loading, error, refetch } = useQuery(LEADERBOARD_QUERY, {
    variables: { classCode, range },
    pollInterval: 10000,
  });
  const rows = (data?.classradarLeaderboard ?? []).map((row) => ({
    ...row,
    name: row.name ?? row.studentEmail.split("@")[0] ?? "",
  }));

  return (
    <RadarTheme>
      <div className="classradar:mx-auto classradar:flex classradar:w-full classradar:max-w-4xl classradar:flex-col classradar:gap-7 classradar:overflow-auto classradar:p-6">
        <div className="classradar:flex classradar:flex-wrap classradar:items-end classradar:justify-between classradar:gap-4">
          <div className="classradar:flex classradar:flex-col classradar:gap-1.5">
            <h1 className="classradar:flex classradar:items-center classradar:gap-2 classradar:text-3xl classradar:font-bold">
              <IconTrophy className="classradar:text-warning" /> Leaderboard
            </h1>
            <span className="classradar:text-sm classradar:text-muted-foreground">
              Өөрөө зассан алдаа · цөөн зөвлөгөөгөөр зассан бол илүү оноо
            </span>
          </div>
          <div className="classradar:flex classradar:items-center classradar:gap-3">
            <form
              className="classradar:flex classradar:items-center classradar:gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim()) setClassCode(draft.trim());
              }}
            >
              <Label htmlFor="classradar-lb-class">Анги</Label>
              <Input
                id="classradar-lb-class"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => draft.trim() && setClassCode(draft.trim())}
                className="classradar:w-20"
              />
            </form>
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(value: string) => value && setRange(value as "week" | "all")}
            >
              <ToggleGroup.Item value="week">Энэ долоо хоног</ToggleGroup.Item>
              <ToggleGroup.Item value="all">Бүх цаг</ToggleGroup.Item>
            </ToggleGroup>
          </div>
        </div>

        {loading && !data ? (
          <div className="classradar:flex classradar:flex-col classradar:gap-3">
            <Skeleton className="classradar:h-64" />
            <Skeleton className="classradar:h-14" />
            <Skeleton className="classradar:h-14" />
          </div>
        ) : error && !data ? (
          <Empty className="classradar:rounded-xl classradar:border classradar:border-border">
            <Empty.Header>
              <Empty.Title>Leaderboard авч чадсангүй</Empty.Title>
              <Empty.Description>{error.message}</Empty.Description>
            </Empty.Header>
            <Empty.Content>
              <Button onClick={() => refetch()}>
                <IconRefresh /> Дахин оролдох
              </Button>
            </Empty.Content>
          </Empty>
        ) : rows.length === 0 ? (
          <Empty className="classradar:rounded-xl classradar:border classradar:border-border">
            <Empty.Header>
              <Empty.Media variant="icon">
                <IconTrophy />
              </Empty.Media>
              <Empty.Title>Одоохондоо оноо алга</Empty.Title>
              <Empty.Description>
                Сурагч алдаагаа засаад файлаа хадгалмагц энд оноо нь гарч ирнэ.
              </Empty.Description>
            </Empty.Header>
          </Empty>
        ) : (
          <>
            <div style={{ perspective: 1300 }}>
              <div
                className="classradar:grid classradar:grid-cols-3 classradar:items-end classradar:gap-4"
                style={{ transform: "rotateX(10deg)", transformOrigin: "50% 100%" }}
              >
                {PODIUM.map(({ place, height, medal, ink, block }) => {
                  const row = rows[place - 1];
                  return (
                    <div
                      key={place}
                      className="classradar:flex classradar:flex-col classradar:items-center classradar:gap-3"
                    >
                      <div
                        className="classradar:flex classradar:items-center classradar:justify-center classradar:rounded-full classradar:font-bold"
                        style={{
                          width: place === 1 ? 80 : 62,
                          height: place === 1 ? 80 : 62,
                          background: medal,
                          color: ink,
                          fontSize: place === 1 ? 24 : 18,
                          boxShadow: "0 12px 34px -8px rgba(255,200,80,0.45)",
                        }}
                      >
                        {place}
                      </div>
                      <div className="classradar:text-center classradar:font-bold">{row?.name}</div>
                      <div
                        className="classradar:flex classradar:w-full classradar:justify-center classradar:pt-5 classradar:text-2xl classradar:font-bold"
                        style={{
                          height,
                          borderRadius: "18px 18px 6px 6px",
                          background: block,
                          border: "1px solid rgba(185,162,255,0.45)",
                          boxShadow:
                            "inset 0 3px 0 rgba(255,255,255,0.22), 0 36px 70px -24px rgba(124,77,255,0.8)",
                        }}
                      >
                        {row?.score}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="classradar:flex classradar:flex-col classradar:gap-2.5">
              {rows.slice(3).map((row, index) => (
                <Card key={row.studentEmail}>
                  <Card.Content className="classradar:flex classradar:items-center classradar:gap-4 classradar:p-4">
                    <span className="classradar:w-8 classradar:text-lg classradar:text-muted-foreground">
                      {index + 4}
                    </span>
                    <span
                      aria-hidden
                      className="classradar:size-9 classradar:shrink-0 classradar:rounded-full"
                      style={{ background: "linear-gradient(145deg, #4B3590, #241650)" }}
                    />
                    <span className="classradar:flex-1 classradar:font-semibold">
                      {row.name}
                      <span className="classradar:ml-2 classradar:font-mono classradar:text-xs classradar:text-muted-foreground">
                        {row.seat}
                      </span>
                    </span>
                    <span className="classradar:text-sm classradar:text-muted-foreground">
                      Өөрөө зассан {row.fixed}
                    </span>
                    <span className="classradar:w-20 classradar:text-right classradar:text-lg classradar:font-bold">
                      {row.score}
                    </span>
                  </Card.Content>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </RadarTheme>
  );
};
