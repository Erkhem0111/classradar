import { IconArrowRight, IconDoorEnter, IconRefresh } from "@tabler/icons-react";
import { Badge, Button, Card, Textarea } from "erxes-ui";
import { useState } from "react";
import { RadarTheme } from "./RadarDashboard";

// "Ярилцлагын дасгал" from the design: lobby, one HR question at a time,
// then a summary. UI preview: answers stay in the page and the feedback is a
// simple length/structure check, not AI, so the page carries a Demo badge.

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

/** Mock feedback: rewards a concrete, situation-action-result style answer. */
const review = (answer: string) => {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const hasExample = /жишээ|нэг удаа|тэр үед|төсөл|даалгавар/i.test(answer);
  const hasResult = /үр дүн|чадсан|сурсан|амжилт|дууссан/i.test(answer);
  const score = Math.min(
    100,
    Math.round(words * 2.5) + (hasExample ? 20 : 0) + (hasResult ? 20 : 0),
  );
  const notes = [
    words < 15 ? "Арай дэлгэрэнгүй ярь." : "Хангалттай дэлгэрэнгүй.",
    hasExample ? "Бодит жишээ байна." : "Бодит жишээ нэм.",
    hasResult ? "Үр дүнгээ хэлсэн." : "Эцэст нь юу болсон, юу сурснаа хэл.",
  ];
  return { score, notes };
};

export const InterviewPage = () => {
  const [step, setStep] = useState<"lobby" | "room" | "summary">("lobby");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => QUESTIONS.map(() => ""));

  const restart = () => {
    setAnswers(QUESTIONS.map(() => ""));
    setIndex(0);
    setStep("lobby");
  };

  const reviews = answers.map(review);
  const total = Math.round(reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length);

  return (
    <RadarTheme>
      <div className="classradar:mx-auto classradar:flex classradar:w-full classradar:max-w-3xl classradar:flex-col classradar:gap-6 classradar:overflow-auto classradar:p-6">
        <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-3">
          <Badge variant="secondary">ЯРИЛЦЛАГЫН ДАСГАЛ</Badge>
          <Badge variant="warning">Demo өгөгдөл</Badge>
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
          <Card className="classradar-rise">
            <Card.Header>
              <Card.Description>
                Асуулт {index + 1}/{QUESTIONS.length}
              </Card.Description>
              <div
                aria-hidden
                className="classradar:h-1 classradar:rounded-full classradar:bg-muted"
              >
                <div
                  className="classradar:h-full classradar:rounded-full classradar:bg-primary classradar:transition-all"
                  style={{ width: `${((index + 1) / QUESTIONS.length) * 100}%` }}
                />
              </div>
              <Card.Title className="classradar:pt-2 classradar:text-xl">
                {QUESTIONS[index]}
              </Card.Title>
            </Card.Header>
            <Card.Content className="classradar:flex classradar:flex-col classradar:gap-4">
              <Textarea
                aria-label="Таны хариулт"
                rows={7}
                placeholder="Хариултаа энд бичнэ үү…"
                value={answers[index] ?? ""}
                onChange={(event) =>
                  setAnswers((all) => all.map((a, i) => (i === index ? event.target.value : a)))
                }
              />
              <div className="classradar:flex classradar:justify-between classradar:gap-2">
                <Button
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setIndex(index - 1)}
                >
                  Өмнөх
                </Button>
                {index < QUESTIONS.length - 1 ? (
                  <Button onClick={() => setIndex(index + 1)}>
                    Дараах
                    <IconArrowRight />
                  </Button>
                ) : (
                  <Button onClick={() => setStep("summary")}>Дуусгах</Button>
                )}
              </div>
            </Card.Content>
          </Card>
        )}

        {step === "summary" && (
          <div className="classradar-rise classradar:flex classradar:flex-col classradar:gap-4">
            <Card style={{ boxShadow: "0 0 60px -20px rgba(124,77,255,0.7)" }}>
              <Card.Content className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-4 classradar:p-6">
                <div className="classradar:flex classradar:flex-col classradar:gap-1">
                  <span className="classradar:text-sm classradar:text-muted-foreground">
                    Ярилцлагын дүгнэлт
                  </span>
                  <span className="classradar:text-2xl classradar:font-bold">Сайн оролдлого!</span>
                </div>
                <span className="classradar:text-5xl classradar:font-bold classradar:text-primary">
                  {total}
                </span>
              </Card.Content>
            </Card>
            {QUESTIONS.map((question, i) => (
              <Card key={question}>
                <Card.Header>
                  <div className="classradar:flex classradar:items-start classradar:justify-between classradar:gap-3">
                    <Card.Title className="classradar:text-sm">{question}</Card.Title>
                    <Badge
                      variant={
                        (reviews[i]?.score ?? 0) >= 70
                          ? "success"
                          : (reviews[i]?.score ?? 0) >= 40
                            ? "warning"
                            : "destructive"
                      }
                    >
                      {reviews[i]?.score ?? 0}
                    </Badge>
                  </div>
                  <Card.Description>{answers[i] || "Хариулаагүй"}</Card.Description>
                </Card.Header>
                <Card.Content className="classradar:flex classradar:flex-wrap classradar:gap-2">
                  {reviews[i]?.notes.map((note) => (
                    <Badge key={note} variant="secondary">
                      {note}
                    </Badge>
                  ))}
                </Card.Content>
              </Card>
            ))}
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
