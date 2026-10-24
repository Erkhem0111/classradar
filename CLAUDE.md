@AGENTS.md
# Ангийн радар — erxes EdTech plugin (Hacktoberfest Hack Day УБ, 2026-10-24)

Надтай монголоор ярь. Код, нэрлэлт англиар.

## Санаа

Програмчлал сурч буй сурагчид англи алдааны мессежийг ойлгохгүй чимээгүй гацдаг, багш хэн гацсаныг хардаггүй. VS Code extension алдааг барьж erxes plugin руу илгээнэ. Gemma 4 алдааг монголоор тайлбарлаж 3 шаттай сэжүүр өгнө (хариуг хэзээ ч хэлэхгүй). Багш erxes дотор ангийн суудлын зураг ба давтагдсан алдааг харна.

## Шүүгчийн шаардлага (заавал)

- Ажилладаг demo (загвар зураг хангалтгүй)  
- erxes-тэй бодит интеграц, түүнийгээ тайлбарлах  
- GitHub repo \+ лиценз (MIT) \+ README: нэр/зорилго, асуудал/хэрэглэгч, функц, технологи, суулгах заавар, erxes-тэй холбох арга, ажиллаж буй ба төлөвлөсөн боломж  
- Gemma 4-ийг гол хэсэгт ашиглах (Google DeepMind, DigitalOcean AI шагналд хамаатай)

## Хамрах хүрээ

Заавал (MVP):

1. Extension: Error severity-тэй diagnostics-ийг файл хадгалах үед барьж илгээх  
2. Plugin API: алдааг хүлээж авах mutation, MongoDB-д хадгалах, давтагдсан алдааг бүлэглэх query  
3. Hover: Gemma-гийн монгол тайлбар \+ сэжүүр 1/3 → 3/3  
4. Багшийн самбар (erxes UI): суудлын зураг (төлөв: ажиллаж / алдаатай / 5+ мин гацсан / ирээгүй), давтагдсан топ 3 алдаа

Цаг хүрвэл: terminal-ийн алдааг stack trace-ээс файл:мөр олж тэр мөрөнд diagnostic болгох; суудал дээр дарахад дэлгэрэнгүй; ярилцлагын дасгал (ерөнхий HR асуулт); leaderboard; ачаалах дэлгэцийн радар хөдөлгөөн.

Хийхгүй: менторын тусдаа дэлгэц, дуу хоолой, видео.

## Архитектур

VS Code extension → localhost:4000/graphql (gateway) → plugin API → MongoDB Багшийн самбар \= plugin-ийн frontend, erxes UI (localhost:3001) дотор. Gemma 4 → Ollama (байршлыг ментороос тодруулна).

## Нэрлэлт

- Plugin нэр: classradar (жижиг үсэг, тэмдэгтгүй)  
- Collection, GraphQL type/query/mutation бүгд classradar\-аар эхэлнэ  
- Санал: classradarReportError (mutation), classradarTopErrors, classradarSeats (query)  
- Collections: classradar\_errors { studentEmail, classCode, seat, file, line, message, normalizedKey, snippet (≤3 мөр), source: diagnostic\|terminal, hintsUsed, createdAt }, classradar\_students { email, classCode, seat }

## Хатуу дүрэм

- Сурагчийн бүтэн кодыг хэзээ ч илгээхгүй: зөвхөн алдааны мессеж ба тэр мөрийн ±1 мөр  
- Сэжүүр хариуг шууд хэлэхгүй, засварласан код өгөхгүй. 13–18 насныханд ойлгомжтой энгийн монгол хэл  
- Gemma удаан/унтарвал хамгийн түгээмэл 10 алдааны бэлэн монгол тайлбараар нөхнө  
- normalizedKey: мессежээс мөрийн дугаар, хувьсагчийн нэрийг хасаж бүлэглэнэ (AI шаардлагагүй)  
- erxes-ийн core кодыг өөрчлөхгүй

## Ажлын журам

- Жижиг алхмаар; алхам бүрийн дараа ажиллуулж шалга, дараа нь commit  
- Том өөрчлөлтийн өмнө төлөвлөгөөгөө надад хэл  
- Эхний 1 цагийн зорилго: extension-оос нэг алдаа илгээж MongoDB-д хадгалагдсаныг харах  
- 17:15-аас шинэ функц нэмэхгүй: README, demo бэлтгэл

## Дизайн

[https\://claude.ai/artifact/VkbEdkwz7Y3a2tf3r8xCrc](https://claude.ai/artifact/VkbEdkwz7Y3a2tf3r8xCrc) (хар нил ягаан, erxes-ийн ягаан \#5629B6)

## Нээлттэй асуулт (ментороос)

- Plugin үүсгэх арга: pnpm create @erxes/plugin уу, repo доторх pnpm create-plugin уу  
- Extension-оос gateway руу хандах auth  
- Gemma 4-ийг хаана ажиллуулах (RAM бага)