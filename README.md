# Ангийн радар (Class Radar)

**Програмчлал заадаг ангид хэн гацсаныг багшид шууд харуулдаг, сурагчид алдаагаа
монголоор ойлгуулдаг erxes plugin + VS Code extension.**

> **"I'm Stuck" → "I Can Fix It"** · алдааг өмнөөс нь засахгүй, сурагчийг өөрөө
> ойлгож засахад нь чиглүүлнэ.

Hacktoberfest Hack Day Улаанбаатар 2026 · EdTech · MIT лиценз

## Зорилтот хэрэглэгч

- **Суралцагчид:** ЕБС-ийн Мэдээлэл зүйн хичээлийн сурагчид (13–18 нас), кодингийн
  сургалтын төв, академийн суралцагчид, програмчлал шинээр сурч буй хүмүүс.
- **Багш нар:** ЕБС-ийн Мэдээлэл зүйн багш, кодингийн сургалтын багш, менторууд.

## Тулгамдаж буй асуудал

1. **Англи хэл ба техникийн нэр томьёоны саад:** алдааны мессеж (`NameError`,
   `';' expected` …) англиар, улаан, ойлгомжгүй нэр томьёотой байдаг тул сурагч
   асуухаас ичээд чимээгүй гацдаг.
2. **Дараагийн алхам тодорхойгүй:** алдаа хаанаас үүссэн, аль мөрийг шалгахаа
   мэдэхгүйгээс цаг их алдаж, сурах хүсэл нь буурдаг.
3. **Тусламж оройтож ирдэг:** 20–30 сурагчтай ангид багш хэн гацсаныг, ямар алдаа
   давтагдаж байгааг харах аргагүй, хамгийн чанга асуусан хүүхдэд л тусалдаг.

## Шийдэл ба функц

| Хэсэг | Юу хийдэг вэ |
| ----- | ------------ |
| **VS Code extension** (сурагч) | Файл хадгалахад алдааг барьж erxes руу илгээнэ. Бичиж байх үеийн алдааг тоохгүй (хадгалснаас хойш 1с засваргүй байхад л уншина), файлын **зөвхөн эхний** алдааг авна (бусад нь ихэвчлэн түүний үр дагавар). |
| **Монгол тайлбар + 3 зөвлөгөө** | Алдаан дээр hover хийхэд гарчиг, энгийн монгол тайлбар, 3 өөр өнцгийн зөвлөгөө (🔍 хаанаас хайх · 🧪 яаж шалгах · 🧠 цаад санаа) нэг нэгээр гарна. **Хариу, засварласан кодыг хэзээ ч хэлэхгүй.** Зөвлөгөө сурагчийн өөрийн бичсэн нэр (`totl`) болон яг байрлалыг (`console` ба `log` хоёрын хооронд) заана. |
| **Gemma 4** | Тайлбар, зөвлөгөөг Google DeepMind-ийн **Gemma 4** (`gemma-4-26b-a4b-it`) монголоор үүсгэнэ. Алдааны төрөл бүрт нэг удаа асууж, бүх ангид cache-ээр хуваалцана. |
| **"Ойлголоо"** | Сурагч хэдэн зөвлөгөөгөөр ойлгосныг багшид тэмдэглэнэ. |
| **Багшийн самбар** (erxes дотор) | Ангийн суудлын зураг: ажиллаж байна / алдаатай / 5+ мин гацсан / ирээгүй, 5с тутам шууд шинэчлэгдэнэ. "Анхаарах" жагсаалт хамгийн удаан гацсан сурагчийг эхэнд гаргана. Өнөөдрийн давтагдсан топ 3 алдаа. Суудал дээр дарахад алдаа, ашигласан зөвлөгөө. |

## Хувийн нууц ба аюулгүй байдал

- Сурагчийн **бүтэн код хэзээ ч явахгүй**: зөвхөн алдааны мессеж ба тэр мөрийн ±1 мөр.
- Gemma руу **зөвхөн алдааны мессеж** явна, код огт явахгүй.
- Gemma-гийн хариу код агуулсан, эсвэл компиляторын "Did you mean …" хариуг
  давтсан бол хүлээж авахгүй.

## Архитектур ба erxes-тэй холбох арга

```
VS Code extension ──GraphQL──▶ erxes gateway (:4000/graphql) ──▶ classradar API (subgraph, :3399) ──▶ MongoDB
                                                                         │
                                                                         └──▶ Gemma 4 (Google AI Studio, OpenAI-compatible API)
erxes UI (:3001) ──Module Federation──▶ classradar UI remote (:3099) ──▶ gateway ──▶ classradar API
```

- **API** нь erxes-ийн **Apollo Federation subgraph**. Эхлэхдээ Redis-ээр
  erxes gateway-д бүртгүүлж (`joinErxesGateway`), бүх query/mutation erxes-ийн
  нэг `/graphql` endpoint-оор дамжина. Бүх нэр `classradar`-аар эхэлнэ:
  `classradarReportError`, `classradarHeartbeat`, `classradarErrorHelp`,
  `classradarRevealHint`, `classradarMarkUnderstood`, `classradarSeats`,
  `classradarTopErrors`.
- **UI** нь erxes-ийн **Module Federation remote**. erxes-ийн цэсэнд "Class Radar"
  болж орж, `erxes-ui` (`Card`, `Badge`, `Tooltip`, `Empty` …) болон erxes-ийн
  өнгөний токенуудыг ашиглана. Багшийн самбар erxes-ийн нэвтрэлтээр
  (`context.user`) хамгаалагдсан, нэвтэрсэн багшийн имэйл харагдана.
- **Өгөгдөл:** `classradar_errors`, `classradar_students`,
  `classradar_explanations` collection-ууд, tenant (`subdomain`)-аар тусгаарлагдсан.
- erxes-ийн core кодыг өөрчлөөгүй.

## Технологи

TypeScript · Node.js 22 · Express 5 · Apollo Server/Federation · MongoDB
(Mongoose) · Redis · React 18 · Rspack Module Federation · Tailwind · erxes-ui ·
VS Code Extension API · Gemma 4 (Google AI Studio) · zod · node:test

## Суулгах заавар

Шаардлага: Node.js 22, pnpm 9, ажиллаж буй erxes (gateway :4000, UI :3001, MongoDB, Redis).

```sh
pnpm install
cp .env.example .env          # MONGO_URL, REDIS_*, GEMMA_* тохируулна
pnpm run dev:api              # API, erxes gateway-д бүртгүүлнэ
pnpm run dev:ui               # http://localhost:3099/remoteEntry.js
```

erxes-ийн `.env`-д plugin-ийг нэмээд gateway, core-api-г дахин эхлүүлнэ:

```sh
ENABLED_PLUGINS=...,classradar
```

Тэгээд `http://localhost:3001/classradar` нээнэ.

**Gemma 4** (`.env`): [aistudio.google.com/apikey](https://aistudio.google.com/apikey)-ээс
үнэгүй key авна. Ollama зэрэг OpenAI-compatible ямар ч endpoint ажиллана.

```sh
GEMMA_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMMA_MODEL=gemma-4-26b-a4b-it
GEMMA_API_KEY=...
GEMMA_TIMEOUT_MS=60000
```

**VS Code extension:**

```sh
pnpm --filter classradar_vscode build
code --extensionDevelopmentPath=./extension <сурагчийн хавтас>
```

Тохиргоо: `classradar.gatewayUrl`, `classradar.studentEmail`,
`classradar.classCode`, `classradar.seat` (эсвэл статус бар дээр дарж сонгоно).

**Demo өгөгдөл:** `pnpm run seed:demo --reset` нь 24 суудалтай 10A ангийг
жинхэнэ mutation-уудаар үүсгэнэ.

## Ажиллаж буй ба төлөвлөсөн боломж

**Ажиллаж байна**

- Extension → gateway → MongoDB алдааны урсгал, давхардалгүй, офлайн үед дахин оролдоно
- Алдааг `normalizedKey`-ээр бүлэглэх (мөрийн дугаар, нэрсийг хасна, AI-гүй)
- Монгол тайлбар + 3 өнцгийн зөвлөгөө, "Ойлголоо", hover-ийн skeleton
- Gemma 4 (cache-тэй, хариуг задруулахаас хамгаалсан) + Gemma удаан/унтарсан
  үед түгээмэл 12 алдааны бэлэн монгол тайлбар
- erxes доторх багшийн самбар: суудлын зураг, анхаарах жагсаалт, топ 3 алдаа, loading радар
- **Ярилцлагын дасгал:** лобби → HR-тэй өрөө (8 асуулт, цаг хэмжигч) → дүгнэлт.
  Хариулт бүрийг **Gemma 4** оноо, сайн тал, сайжруулах зүйлтэйгээр дүгнэнэ
  (`classradarInterviewFeedback`); Gemma удаан/унтарсан үед энгийн дүрмээр. Хариулт хадгалагдахгүй.
- **Leaderboard — UI загвар (mock өгөгдөл, "Demo өгөгдөл" гэж тэмдэглэсэн):** тавцан,
  долоо хоног / бүх цаг.

**Хязгаарлалт (шударгаар)**

- Сурагч erxes-д нэвтэрдэггүй: сурагчийн имэйл/анги/суудал extension-ий
  тохиргооноос ирдэг, сурагчийн mutation-ууд одоогоор нэвтрэлтгүй (`TODO(auth)`).
- Google AI Studio дээрх Gemma 4 нэг хариунд 10–60с зарцуулж, заримдаа алддаг.
  Тиймээс hover Gemma-г хүлээдэггүй: эхэндээ бэлэн тайлбар, Gemma хариулмагц cache-ээс Gemma-гийнх.
- Demo-гийн "5+ мин гацсан" суудлуудын хугацааг seed скрипт урагшлуулдаг.

**Төлөвлөсөн**

- Terminal-ийн алдааг stack trace-ээс файл:мөр олж diagnostic болгох
- Сурагчийн нэвтрэлт (erxes client portal эсвэл ангийн код + токен)
- Ярилцлагын түүхийг хадгалах, leaderboard-ийн оноог бодит ярилцлага ба өөрөө
  зассан алдаанаас тооцох

**Цаашдын санаа (өргөжүүлэх боломж)**

- **"Багшаас тусламж хүсэх" товч:** гацсан үед нэг товчоор тухайн мөр, алдааг
  erxes-ийн **Inbox / Notification**-оор багш, менторт real-time илгээх.
- **Ухаалаг аналитик:** одоогийн "давтагдсан топ 3 алдаа" дээр тулгуурлан
  "дараагийн хичээлээр ямар сэдвийг давтах вэ"-г автоматаар санал болгох.
- **Gamification ба streak:** алдаагаа өөрөө засах бүрт оноо, бэж
  ("3 өдөр дараалан алдаагаа өөрөө заслаа").
- **Олон хэл:** монголоос гадна Төв Азийн болон бусад хэл.
- **Дуут туслах:** бага насны сурагчдад тайлбар, зөвлөгөөг дуугаар уншиж өгөх.
- **Бусад орчин:** Replit, вэб дээрх код засварлагчид зориулсан өргөтгөл, erxes widget.

## Скриптүүд

| Script | Юу хийдэг |
| ------ | --------- |
| `pnpm run dev:api` / `dev:ui` | API / UI хөгжүүлэлтийн горим |
| `pnpm run seed:demo --reset` | Demo анги үүсгэх |
| `pnpm run check` | Typecheck + тест (API, UI, extension) |
| `pnpm run lint` / `fmt` | oxlint / oxfmt |
| `pnpm run build` | Бүх хэсгийн production build |

Deploy болон erxes-тэй холбогдох дүрмийн дэлгэрэнгүй:
[docs/erxes-integration.md](docs/erxes-integration.md), [AGENTS.md](AGENTS.md).

## Лиценз

[MIT](LICENSE)
