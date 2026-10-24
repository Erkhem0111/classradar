import { useMutation } from "@apollo/client";
import { IconDoorEnter, IconRefresh, IconSend } from "@tabler/icons-react";
import { Badge, Button, Card, Skeleton, Textarea, cn } from "erxes-ui";
import { useEffect, useState } from "react";
import type { ClassradarInterviewFeedbackMutation } from "~/gql/graphql";
import { INTERVIEW_FEEDBACK_MUTATION } from "../graphql";
import { RadarTheme } from "./RadarDashboard";

// "Ярилцлагын дасгал" from the design: lobby, the interview room (one HR
// question at a time, with a timer), then a summary graded by Gemma 4 (a rule
// check stands in when Gemma is slow). Answers are not stored yet.

type Feedback = ClassradarInterviewFeedbackMutation["classradarInterviewFeedback"];

const QUESTIONS = [
  "Өөрийгөө товч танилцуулна уу.",
  "Яагаад програмчлал сурах болсон бэ?",
  "Хамгийн хэцүү байсан төсөл эсвэл даалгавраа ярина уу.",
  "Алдаа гаргаад түүнээсээ юу сурсан тухайгаа ярина уу.",
  "Багаар ажиллахад таны үүрэг ихэвчлэн юу байдаг вэ?",
  "Гацсан үедээ юу хийдэг вэ?",
  "5 жилийн дараа өөрийгөө хаана харж байна вэ?",
  "Бидэнд асуух асуулт байна уу?",
];

const TIPS = [
  "Бодит жишээгээр ярь, ерөнхий үг хэрэггүй.",
  "Нөхцөл, үйлдэл, үр дүн гэсэн дарааллаар ярь.",
  "Яарах хэрэггүй, цаг хязгааргүй.",
];

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export const InterviewPage = () => {
  const [step, setStep] = useState<"lobby" | "room" | "summary">("lobby");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => QUESTIONS.map(() => ""));
  const [feedback, setFeedback] = useState<(Feedback | null)[]>(() => QUESTIONS.map(() => null));
  const [seconds, setSeconds] = useState(0);
  const [requestFeedback] = useMutation(INTERVIEW_FEEDBACK_MUTATION);

  useEffect(() => {
    if (step !== "room") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const finish = () => {
    setStep("summary");
    setFeedback(QUESTIONS.map(() => null));
    // All answers are graded at once; each card fills in as Gemma replies.
    QUESTIONS.forEach((question, i) => {
      void requestFeedback({ variables: { question, answer: answers[i] ?? "" } })
        .then(({ data }) => data?.classradarInterviewFeedback ?? null)
        .catch(() => null)
        .then((result) =>
          setFeedback((all) =>
            all.map((f, k) =>
              k === i
                ? (result ?? {
                    score: 0,
                    good: "—",
                    improve: "Дүгнэлт авч чадсангүй.",
                    source: "fallback",
                  })
                : f,
            ),
          ),
        );
    });
  };

  const restart = () => {
    setAnswers(QUESTIONS.map(() => ""));
    setFeedback(QUESTIONS.map(() => null));
    setIndex(0);
    setSeconds(0);
    setStep("lobby");
  };

  const done = feedback.filter((f): f is Feedback => f !== null);
  const total = done.length
    ? Math.round(done.reduce((sum, f) => sum + f.score, 0) / done.length)
    : null;
  const byGemma = done.some((f) => f.source === "gemma");

  return (
    <RadarTheme>
      <div className="classradar:mx-auto classradar:flex classradar:w-full classradar:max-w-3xl classradar:flex-col classradar:gap-6 classradar:overflow-auto classradar:p-6">
        <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-3">
          <Badge variant="secondary">ЯРИЛЦЛАГЫН ДАСГАЛ</Badge>
          <Badge variant="secondary">Дүгнэлт: Gemma 4</Badge>
        </div>

        {step === "lobby" && (
          <Card
            className="classradar-rise"
            style={{
              borderRadius: 28,
              border: "1px solid rgba(185,162,255,0.35)",
              boxShadow: "0 40px 90px -30px rgba(0,0,0,0.9), 0 0 60px -20px rgba(124,77,255,0.6)",
            }}
          >
            <Card.Header>
              <Card.Title className="classradar:text-2xl">HR таныг хүлээж байна</Card.Title>
              <Card.Description>
                Бодит ярилцлага шиг. Алдаа гаргах нь энд аюулгүй, дасгал хийх тусам айдас багасна.
              </Card.Description>
            </Card.Header>
            <Card.Content className="classradar:flex classradar:flex-col classradar:gap-6">
              <div className="classradar:grid classradar:grid-cols-3 classradar:gap-3">
                {[
                  [String(QUESTIONS.length), "ерөнхий HR асуулт"],
                  ["~15", "минут"],
                  ["Aa", "бичгээр хариулна"],
                ].map(([value, label]) => (
                  <Card key={label}>
                    <Card.Content className="classradar:flex classradar:flex-col classradar:gap-1 classradar:p-4">
                      <span className="classradar:text-xl classradar:font-bold">{value}</span>
                      <span className="classradar:text-xs classradar:text-muted-foreground">
                        {label}
                      </span>
                    </Card.Content>
                  </Card>
                ))}
              </div>
              <div className="classradar:flex classradar:flex-col classradar:gap-2.5">
                <span className="classradar:text-sm classradar:font-bold classradar:text-primary">
                  Гурван зөвлөгөө
                </span>
                {TIPS.map((tip, i) => (
                  <div
                    key={tip}
                    className="classradar:flex classradar:items-start classradar:gap-2.5 classradar:text-sm"
                  >
                    <Badge variant="secondary">{i + 1}</Badge>
                    {tip}
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={() => setStep("room")}>
                <IconDoorEnter />
                Өрөөнд орох
              </Button>
            </Card.Content>
          </Card>
        )}

        {step === "room" && (
          <section
            aria-label="Ярилцлагын өрөө"
            className="classradar-rise classradar:relative classradar:flex classradar:min-h-[560px] classradar:flex-col classradar:justify-between classradar:overflow-hidden classradar:p-5"
            style={{
              borderRadius: 24,
              background:
                "radial-gradient(120% 90% at 50% 30%, rgba(124,77,255,0.25) 0%, rgba(11,7,22,0) 60%), linear-gradient(180deg, #1C1726 0%, #15111E 55%, #0E0B15 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 40px 100px -40px rgba(0,0,0,0.9)",
            }}
          >
            <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-3">
              <div className="classradar:flex classradar:gap-2">
                <Badge variant="secondary">
                  Асуулт {index + 1} / {QUESTIONS.length}
                </Badge>
                <Badge variant="secondary" className="classradar:font-mono">
                  {clock(seconds)}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={finish}>
                Ярилцлагыг дуусгах
              </Button>
            </div>

            <div className="classradar:flex classradar:flex-col classradar:items-center classradar:gap-3 classradar:py-6">
              <div
                aria-hidden
                className="classradar:flex classradar:size-28 classradar:items-center classradar:justify-center classradar:rounded-full classradar:text-4xl classradar:font-bold"
                style={{
                  background: "linear-gradient(145deg, #FFC48A, #C9774A)",
                  color: "#2A1206",
                  boxShadow:
                    "0 0 0 6px rgba(255,196,138,0.12), 0 20px 60px -10px rgba(255,196,138,0.5)",
                }}
              >
                С
              </div>
            </div>

            <div
              className="classradar:flex classradar:flex-col"
              style={{
                borderRadius: 20,
                background: "rgba(14,10,24,0.80)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 24px 60px -20px rgba(0,0,0,0.9)",
              }}
            >
              <div className="classradar:flex classradar:flex-col classradar:gap-2.5 classradar:px-5 classradar:pt-4 classradar:pb-3">
                <div
                  className="classradar:flex classradar:items-center classradar:gap-2.5 classradar:text-sm classradar:font-semibold"
                  style={{ color: "#DCC8B4" }}
                >
                  <span
                    aria-hidden
                    className="classradar:flex classradar:h-3.5 classradar:items-end classradar:gap-[3px]"
                  >
                    {[0, 1, 2].map((bar) => (
                      <span
                        key={bar}
                        className="classradar:w-[3px] classradar:animate-pulse classradar:rounded-sm"
                        style={{
                          height: [8, 14, 10][bar],
                          background: "#FFC48A",
                          animationDelay: `${bar * 0.15}s`,
                        }}
                      />
                    ))}
                  </span>
                  Сараа · HR
                </div>
                <h2 className="classradar:text-xl classradar:font-medium classradar:leading-relaxed">
                  {QUESTIONS[index]}
                </h2>
              </div>
              <form
                className="classradar:flex classradar:items-end classradar:gap-3 classradar:border-t classradar:border-border classradar:p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (index < QUESTIONS.length - 1) setIndex(index + 1);
                  else finish();
                }}
              >
                <Textarea
                  aria-label="Чиний хариулт"
                  rows={3}
                  placeholder="Өөрийнхөө үгээр хариул…"
                  value={answers[index] ?? ""}
                  onChange={(event) =>
                    setAnswers((all) => all.map((a, i) => (i === index ? event.target.value : a)))
                  }
                  className="classradar:flex-1 classradar:resize-none"
                />
                <Button type="submit" size="lg">
                  <IconSend />
                  {index < QUESTIONS.length - 1 ? "Илгээх" : "Дуусгах"}
                </Button>
              </form>
            </div>
          </section>
        )}

        {step === "summary" && (
          <div className="classradar-rise classradar:flex classradar:flex-col classradar:gap-4">
            <Card style={{ boxShadow: "0 0 60px -20px rgba(124,77,255,0.7)" }}>
              <Card.Content className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-4 classradar:p-6">
                <div className="classradar:flex classradar:flex-col classradar:gap-1">
                  <span className="classradar:text-sm classradar:text-muted-foreground">
                    Ярилцлагын дүгнэлт · {clock(seconds)} · {done.length}/{QUESTIONS.length} үнэлсэн
                  </span>
                  <span className="classradar:text-2xl classradar:font-bold">Сайн оролдлого!</span>
                  <span className="classradar:text-xs classradar:text-muted-foreground">
                    {byGemma ? "Gemma 4 дүгнэв" : "Дүгнэж байна…"}
                  </span>
                </div>
                {total === null ? (
                  <Skeleton className="classradar:h-12 classradar:w-20" />
                ) : (
                  <span className="classradar:text-5xl classradar:font-bold classradar:text-primary">
                    {total}
                  </span>
                )}
              </Card.Content>
            </Card>
            {QUESTIONS.map((question, i) => {
              const f = feedback[i];
              return (
                <Card key={question}>
                  <Card.Header>
                    <div className="classradar:flex classradar:items-start classradar:justify-between classradar:gap-3">
                      <Card.Title className="classradar:text-sm">{question}</Card.Title>
                      {f ? (
                        <Badge
                          variant={
                            f.score >= 70 ? "success" : f.score >= 40 ? "warning" : "destructive"
                          }
                        >
                          {f.score}
                        </Badge>
                      ) : (
                        <Skeleton className="classradar:h-5 classradar:w-10" />
                      )}
                    </div>
                    <Card.Description>{answers[i] || "Хариулаагүй"}</Card.Description>
                  </Card.Header>
                  <Card.Content className="classradar:flex classradar:flex-col classradar:gap-1.5 classradar:text-sm">
                    {f ? (
                      <>
                        <span>
                          <span className="classradar:text-success">✓ </span>
                          {f.good}
                        </span>
                        <span>
                          <span className="classradar:text-warning">↗ </span>
                          {f.improve}
                        </span>
                        <span className={cn("classradar:text-xs classradar:text-muted-foreground")}>
                          {f.source === "gemma" ? "Gemma 4" : "энгийн дүрэм"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Skeleton className="classradar:h-4 classradar:w-3/4" />
                        <Skeleton className="classradar:h-4 classradar:w-2/3" />
                      </>
                    )}
                  </Card.Content>
                </Card>
              );
            })}
            <Button variant="outline" onClick={restart}>
              <IconRefresh />
              Дахин дасгал хийх
            </Button>
          </div>
        )}
      </div>
    </RadarTheme>
  );
};
