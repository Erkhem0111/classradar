// Built-in Mongolian explanations for the most common beginner errors. Used
// whenever Gemma is unset, slow or returns something unusable, so a hover
// always has an answer. The three tips look at the error from different
// angles, in this order (the Gemma prompt asks for the same): where to look,
// a concrete way to check it, the idea behind it. They never contain the fix.

export type Explanation = {
  /** A few words naming the problem, shown as the hover heading. */
  title: string;
  explanation: string;
  hints: [string, string, string];
};

type Entry = Explanation & { match: RegExp };

const catalog: Entry[] = [
  {
    match: /nameerror|cannot find name|is not defined/i,
    title: "Нэр танигдсангүй",
    explanation:
      "Компьютер {name} гэсэн нэрийг танихгүй байна. Чи үүнийг өмнө нь үүсгээгүй, эсвэл нэрийг нь өөрөөр бичсэн байж магадгүй.",
    hints: [
      "{name} гэсэн нэрийг кодынхоо дээд хэсгээс хай: яг ийм бичигдсэн нэр байна уу?",
      "Утга оноосон мөрөнд бичсэн нэрээ {name}-тэй үсэг үсгээр нь тулгаж үз.",
      "Компьютер нэрийг үсэг бүрээр нь, том жижиг үсгийг ч ялгаж таньдаг. Мөн хувьсагчийг ашиглахаасаа өмнө үүсгэсэн байх ёстой.",
    ],
  },
  {
    match: /indentationerror|expected an indented block|unexpected indent|unindent/i,
    title: "Догол буруу байна",
    explanation:
      "Python кодын мөрийн эхэнд байгаа зай (догол) буруу байна. Python догол мөрөөр аль код аль блокт хамаарахыг ойлгодог.",
    hints: [
      "`for`, `if`, `def` гэх мэт `:`-ээр төгссөн мөрийн яг доорх мөрийг хар.",
      "Блок доторх мөрүүдийг сонгоод эхний зайг нь харьцуул: tab ба space хольсон эсэхийг засварлагч дээр харж болно.",
      "Python-д догол нь тухайн мөр аль блокт хамаарахыг заадаг. Нэг блокийн бүх мөр ижил зайтай байх ёстой.",
    ],
  },
  {
    match:
      /was never closed|unterminated|unexpected eof|eol while scanning|'\)' expected|'}' expected|unclosed/i,
    title: "Хаалт хаагдаагүй байна",
    explanation:
      "Нээсэн хаалт эсвэл хашилт хаагдаагүй байна. Компьютер төгсгөлийг нь хайсаар файлын төгсгөлд хүрсэн.",
    hints: [
      "Алдаа заасан мөр биш, түүний өмнөх мөрүүдээс хаалт эсвэл хашилт эхэлсэн газрыг хай.",
      "Хаалт дээр курсороо тавихад засварлагч хос хаалтыг нь тодруулдаг. Хос нь олдохгүй байгаа хаалтыг ол.",
      "Хаалт, хашилт бүр хостой: нээсэн бол заавал хаах ёстой. Эс бөгөөс компьютер үргэлжлэл нь хаана байгааг мэдэхгүй.",
    ],
  },
  {
    match:
      /can only concatenate|unsupported operand|must be str, not|cannot be applied to types|is not assignable to/i,
    title: "Төрөл таарахгүй байна",
    explanation:
      "Хоёр өөр төрлийн утгыг хамт ашиглаж байна. Жишээ нь текст ба тоог шууд нэмэх боломжгүй.",
    hints: [
      "Алдаатай мөрөнд `+` эсвэл өөр үйлдлийн хоёр талд юу байгааг хар.",
      "Утга бүрийн төрлийг `type()` (Python) эсвэл `typeof` (JavaScript)-ээр хэвлэж үз.",
      "Текст ба тоо өөр төрөл. Тэдгээрийг хамт ашиглахын тулд аль нэгийг нь нөгөөгийн төрөлд хөрвүүлэх хэрэгтэй.",
    ],
  },
  {
    match: /'[^'\s]{1,3}' expected|missing semicolon|expected '[^'\s]{1,3}'/i,
    title: "Тэмдэг дутуу байна",
    // The compiler often guesses the wrong missing mark (a dropped `.` is
    // reported as "';' expected"), so point at the gap, not its guess.
    explanation: "Компьютер {gap} ямар нэг тэмдэг хүлээж байсан ч олсонгүй.",
    hints: [
      "{gap} байгаа зайг хар: тэнд юу дутуу байна вэ?",
      "Ижил төрлийн зөв ажилладаг өөр мөртэйгөө харьцуулаад, тэр хоёрын хооронд ямар тэмдэг байдгийг хар.",
      "Компьютер кодыг дүрмийн дагуу уншдаг. Нэг тэмдэг дутуу бол дараагийн мөрийг ч буруу ойлгож болно.",
    ],
  },
  {
    match: /indexerror|index out of range|out of bounds/i,
    title: "Жагсаалтаас хэтэрсэн",
    explanation:
      "Жагсаалтад байхгүй байрлалын элементийг авах гэж байна. Жагсаалтын дугаарлалт 0-ээс эхэлдэг.",
    hints: [
      "Жагсаалтаас `[ ]` хаалтаар элемент авч байгаа газрыг хай.",
      "Тэр үед жагсаалтын урт болон ашиглаж буй дугаараа хэвлэж харьцуул.",
      "Дугаарлалт 0-ээс эхэлдэг тул сүүлийн элементийн дугаар нь уртаасаа нэгээр бага байдаг.",
    ],
  },
  {
    match: /zerodivisionerror|division by zero|divide by zero/i,
    title: "Тэгд хуваасан",
    explanation: "Тоог тэгд хувааж байна. Математикт тэгд хуваах боломжгүй.",
    hints: [
      "Алдаатай мөрөнд `/` эсвэл `%` тэмдгийн баруун талд байгаа утгыг хар.",
      "Хуваахаас өмнө тэр утгыг хэвлэж, хэзээ 0 болж байгааг ажигла.",
      "Тэгд хуваах нь математикт тодорхойгүй. Тиймээс програм хуваахаас өмнө урьдчилан шалгах хэрэгтэй болдог.",
    ],
  },
  {
    match: /modulenotfounderror|no module named|cannot find module|importerror/i,
    title: "Модуль олдсонгүй",
    explanation: "Импортлох гэж буй {name} модуль эсвэл файл олдсонгүй.",
    hints: [
      "`import` мөр дээрх {name} гэсэн нэрийг хар: зөв бичсэн үү?",
      "Өөрийн файл бол нэр, байршлыг нь шалга. Сан бол терминал дээр суусан эсэхийг шалга.",
      "Модуль гэдэг нь тусдаа файл эсвэл сан. Компьютер түүнийг зөвхөн тодорхой газруудаас хайдаг.",
    ],
  },
  {
    match:
      /attributeerror|has no attribute|property .* does not exist|is not a function|cannot read propert/i,
    title: "Ийм функц, шинж чанар алга",
    explanation: "Энэ утгад чиний дуудаж буй {name} гэсэн шинж чанар эсвэл функц байхгүй байна.",
    hints: [
      "Цэгийн (`.`) араас бичсэн {name}-ийг болон цэгийн өмнөх утгыг хар.",
      "Цэгийн өмнөх утгын төрлийг хэвлээд, тэр төрөлд ямар функц байдгийг баримт бичгээс шалга.",
      "Төрөл бүр өөрийн гэсэн функцтэй: жагсаалт, текст, объект тус бүр өөр нэртэй функцтэй байдаг.",
    ],
  },
  {
    match:
      /expected \d+ arguments?|takes \d+ positional|missing \d+ required positional|too (many|few) arguments/i,
    title: "Аргументын тоо таарахгүй",
    explanation: "Функцийг дуудахдаа түүнд хэрэгтэй тооноос өөр тооны утга өгсөн байна.",
    hints: [
      "Функцийг дуудсан мөрөнд хаалтан доторх утгуудыг тоол.",
      "Тэр функцийг тодорхойлсон мөрийг олоод хэдэн параметр хүлээж байгааг харьцуул.",
      "Функц бүр тодорхой тооны оролт хүлээдэг: тодорхойлолт болон дуудлага хоёр таарах ёстой.",
    ],
  },
  {
    match: /implicitly has an '\w+' type|type annotation/i,
    title: "Төрөл заагаагүй байна",
    explanation:
      "TypeScript {name}-ийн төрлийг өөрөө тааж чадсангүй, тиймээс төрлийг нь заахыг хүсэж байна.",
    hints: [
      "{name}-ийг анх үүсгэсэн мөрийг хар.",
      "Тэр утга ямар төрөл (тоо, текст, жагсаалт…) байх ёстойг өөрөөсөө асуу.",
      "TypeScript утга бүр ямар төрөлтэйг мэдэхийг хүсдэг: үүсгэхдээ утга оноох, эсвэл төрлийг нь заах хэрэгтэй.",
    ],
  },
  {
    match:
      /syntaxerror|invalid syntax|unexpected token|expression expected|declaration or statement expected/i,
    title: "Бичлэгийн алдаа",
    explanation:
      "Кодын бичлэгийн дүрэм зөрчигдсөн байна. Компьютер энэ мөрийг уншиж ойлгож чадсангүй.",
    hints: [
      "{gap} байгаа хэсгийг болон түүний өмнөх мөрийг хар.",
      "Мөрийг хэсэг хэсгээр нь уншиж, `:`, хаалт, таслал, хашилт бүрийг тоолж үз.",
      "Програмчлалын хэл бүр хатуу дүрэмтэй. Нэг жижиг тэмдэг дутахад компьютер бүх мөрийг ойлгохгүй болдог.",
    ],
  },
];

const generic: Explanation = {
  title: "Код ажиллахгүй байна",
  explanation:
    "Компьютер энэ мөрийг ажиллуулж чадсангүй. Алдааны мессеж асуудлын байрлал болон төрлийг хэлж байна.",
  hints: [
    "Алдааны мессеж заасан мөр болон түүний өмнөх мөрийг хар.",
    "Мессежийн эхний үгийг (алдааны төрлийг) хайж, эсвэл багшаасаа асууж утгыг нь мэд.",
    "Алдааны мессеж бүр компьютер юуг ойлгоогүйг хэлдэг. Мессежийг үг үгээр нь орчуулж үз.",
  ],
};

export const fallbackExplanation = (message: string): Explanation =>
  catalog.find((entry) => entry.match.test(message)) ?? generic;

/** The first quoted name in an error message: 'totl' in "name 'totl' is not defined". */
export const quotedName = (message: string) =>
  // "no attribute 'push'" names the attribute last; otherwise the first quote.
  (/(?:attribute|property) ['"`]([^'"`\n]{1,40})['"`]/i.exec(message) ??
    /['"`‘“]([^'"`’”\n]{1,40})['"`’”]/.exec(message))?.[1] ?? null;

/**
 * The tokens either side of the error column in the error line, so tips can
 * say exactly where to look. `snippet` holds the line and at most one line
 * either side; it starts one line before the error unless that is line 1.
 */
export const tokensAround = (
  snippet: string | null | undefined,
  line: number,
  column: number | null | undefined,
) => {
  const text = snippet?.split("\n")[line === 1 ? 0 : 1];
  if (text === undefined || column === null || column === undefined) return undefined;
  const token = /[\p{L}\p{N}_$]+|[^\s\p{L}\p{N}_$]/gu;
  const beforeTokens = text.slice(0, column).match(token);
  const after = text.slice(column).match(token)?.[0] ?? null;
  return { before: beforeTokens?.at(-1) ?? null, after };
};

/**
 * Fills `{name}` with the name from this student's message, so a shared
 * explanation still points at their exact mistake. It quotes what they wrote,
 * never a suggested fix (a "Did you mean" name comes second and is skipped).
 */
export const personalize = <T extends Explanation>(
  help: T,
  message: string,
  around?: { before: string | null; after: string | null },
): T => {
  const name = quotedName(message);
  const { before, after } = around ?? { before: null, after: null };
  const gap =
    before && after
      ? `\`${before}\` ба \`${after}\` хоёрын хооронд`
      : after
        ? `\`${after}\`-ийн өмнө`
        : before
          ? `\`${before}\`-ийн дараа`
          : "алдаа заасан газарт";
  const fill = (text: string) =>
    text.replaceAll("{name}", name ? `\`${name}\`` : "энэ нэр").replaceAll("{gap}", gap);
  const [a, b, c] = help.hints;
  return { ...help, explanation: fill(help.explanation), hints: [fill(a), fill(b), fill(c)] };
};
