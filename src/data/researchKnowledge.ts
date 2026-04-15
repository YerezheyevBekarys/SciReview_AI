import type { DocumentType } from "@/lib/analysisTypes";

interface RequiredSection {
  key: string;
  label: string;
  description: string;
  keywords: string[];
}

interface DomainProfile {
  label: string;
  audience: string;
  focus: string[];
  requiredSections: RequiredSection[];
  evaluationCriteria: string[];
  commonMistakes: string[];
  templateOutline: string[];
}

export const DOCUMENT_TYPE_OPTIONS: Array<{ value: DocumentType; label: string; helper: string }> = [
  {
    value: "scientific_tz",
    label: "Научное ТЗ",
    helper: "НИР, научные программы, лабораторные и университетские проекты",
  },
  {
    value: "grant_application",
    label: "Грантовая заявка",
    helper: "Проекты с KPI, обоснованием финансирования и impact-метриками",
  },
  {
    value: "niokr",
    label: "НИОКР",
    helper: "R&D, prototype-driven, roadmap, TRL и внедрение результата",
  },
  {
    value: "research_document",
    label: "Research Doc",
    helper: "Research brief, concept note, research program, proposal",
  },
];

export const DOMAIN_PROFILES: Record<DocumentType, DomainProfile> = {
  scientific_tz: {
    label: "Научное техническое задание",
    audience: "университеты, исследовательские центры, научные коллективы",
    focus: [
      "ясность научной цели",
      "полнота структуры ТЗ",
      "измеримые KPI и deliverables",
      "научная корректность, методы и ожидаемый эффект",
    ],
    requiredSections: [
      { key: "background", label: "Актуальность / обоснование", description: "Почему проект важен именно сейчас.", keywords: ["актуаль", "обоснован", "проблем", "контекст", "relevance"] },
      { key: "goal", label: "Цель", description: "Одна измеримая цель проекта.", keywords: ["цель", "goal", "mission"] },
      { key: "tasks", label: "Задачи", description: "Декомпозиция цели на шаги.", keywords: ["задач", "этап", "work package"] },
      { key: "methodology", label: "Методология", description: "Методы, данные, эксперименты, дизайн исследования.", keywords: ["метод", "методолог", "исследован", "эксперимент", "выборк", "dataset"] },
      { key: "kpi", label: "KPI и метрики", description: "Количественные показатели успеха.", keywords: ["kpi", "метрик", "показател", "accuracy", "точност", "не менее", "%"] },
      { key: "results", label: "Ожидаемые результаты", description: "Что будет получено на выходе.", keywords: ["ожидаем", "результат", "эффект", "deliverable", "выход"] },
      { key: "timeline", label: "Сроки и этапы", description: "График, этапность, контрольные точки.", keywords: ["срок", "этап", "календар", "месяц", "год", "roadmap"] },
      { key: "compliance", label: "Соответствие документам/политикам", description: "Привязка к программам, стратегиям, стандартам.", keywords: ["соответств", "концепц", "стратег", "программ", "цур", "sdg"] },
    ],
    evaluationCriteria: [
      "Цель сформулирована как измеримый scientific outcome, а не как общее пожелание.",
      "Структура закрывает минимум: цель, задачи, методы, KPI, результаты, сроки.",
      "Есть конкретные публикационные, технологические или образовательные deliverables.",
      "Есть привязка к национальным/институциональным приоритетам и шаблону конкурса.",
    ],
    commonMistakes: [
      "Слишком общая цель без объекта, метрики и срока.",
      "Есть список документов, но нет объяснения связи проекта с ними.",
      "Ожидаемые результаты перечислены без количественных критериев.",
      "Разделы указаны, но содержательно пустые или шаблонные.",
    ],
    templateOutline: [
      "1. Общие сведения",
      "2. Актуальность и проблема",
      "3. Цель и задачи",
      "4. Методология и дизайн исследования",
      "5. KPI, метрики и критерии приемки",
      "6. Ожидаемые результаты и эффекты",
      "7. План-график / этапы",
      "8. Соответствие стратегическим документам",
    ],
  },
  grant_application: {
    label: "Грантовая заявка",
    audience: "грантовые комиссии, фонды, акселераторы, индустриальные заказчики",
    focus: [
      "impact, KPI и обоснование бюджета",
      "новизна и практическая применимость",
      "прозрачная логика между проблемой, задачами и deliverables",
    ],
    requiredSections: [
      { key: "problem", label: "Проблема", description: "Какую проблему решает проект.", keywords: ["проблем", "pain", "challenge"] },
      { key: "goal", label: "Цель", description: "Конечный измеримый результат.", keywords: ["цель", "goal", "objective"] },
      { key: "novelty", label: "Новизна", description: "Чем решение отличается от существующих.", keywords: ["новизн", "innovation", "uniqueness"] },
      { key: "tasks", label: "Задачи и work packages", description: "План работ и ответственность.", keywords: ["задач", "work package", "этап"] },
      { key: "budget", label: "Бюджет / ресурсы", description: "На что нужны деньги и чем это подтверждается.", keywords: ["бюджет", "тенге", "смет", "ресурс"] },
      { key: "kpi", label: "KPI и impact", description: "Как будет измеряться успех.", keywords: ["kpi", "impact", "метрик", "roi", "показател"] },
      { key: "results", label: "Ожидаемые результаты", description: "Что будет достигнуто по факту.", keywords: ["ожидаем", "результат", "deliverable", "выход"] },
      { key: "timeline", label: "Сроки", description: "Ключевые даты и milestone.", keywords: ["срок", "milestone", "месяц", "год"] },
    ],
    evaluationCriteria: [
      "Есть чёткая связь между финансированием, действиями и результатом.",
      "Новизна и практическая ценность доказаны, а не заявлены декларативно.",
      "KPI содержат числа, сроки и критерий приемки.",
      "Текст читается как proposal, а не как набор общих лозунгов.",
    ],
    commonMistakes: [
      "Нет объяснения, почему именно эта команда или институт может выполнить проект.",
      "Бюджет и результат не связаны между собой.",
      "Impact указан общими словами без метрик.",
    ],
    templateOutline: [
      "1. Проблема и контекст",
      "2. Цель и новизна",
      "3. План работ",
      "4. Бюджет и ресурсы",
      "5. KPI и impact",
      "6. Ожидаемые результаты",
      "7. Таймлайн",
    ],
  },
  niokr: {
    label: "НИОКР / R&D",
    audience: "R&D-команды, лаборатории, индустриальные партнёры",
    focus: [
      "конкретный технологический результат",
      "TRL, прототип, пилот, внедрение",
      "проверяемые технические критерии",
    ],
    requiredSections: [
      { key: "problem", label: "Техническая проблема", description: "Что именно нужно решить.", keywords: ["техническ", "проблем", "ограничен"] },
      { key: "goal", label: "Цель R&D", description: "Измеримый результат разработки.", keywords: ["цель", "prototype", "прототип", "mvp"] },
      { key: "requirements", label: "Технические требования", description: "Ограничения, функционал, параметры.", keywords: ["требован", "параметр", "характерист", "api"] },
      { key: "methodology", label: "Метод и эксперимент", description: "Как будет проверяться гипотеза.", keywords: ["метод", "тест", "эксперимент", "валидац"] },
      { key: "kpi", label: "Метрики качества", description: "Точность, latency, throughput, стоимость.", keywords: ["метрик", "latency", "accuracy", "точност", "скорост"] },
      { key: "results", label: "Выходы", description: "Прототип, код, отчёт, испытания.", keywords: ["прототип", "код", "отчет", "испытан", "результат"] },
      { key: "timeline", label: "Этапы и сроки", description: "R&D roadmap.", keywords: ["roadmap", "этап", "срок", "milestone"] },
    ],
    evaluationCriteria: [
      "Цель формулируется как deliverable: prototype, algorithm, validated system.",
      "Есть проверяемые технические параметры и критерии приемки.",
      "Показан путь от исследования к внедрению или пилоту.",
    ],
    commonMistakes: [
      "Цель звучит как идея, а не как deliverable.",
      "Нет технических ограничений и критериев приемки.",
      "Указаны действия, но не указано, как будет доказан результат.",
    ],
    templateOutline: [
      "1. Техническая проблема",
      "2. Цель разработки",
      "3. Технические требования",
      "4. Методика проверки",
      "5. KPI и критерии приемки",
      "6. Результаты и внедрение",
      "7. Таймлайн",
    ],
  },
  research_document: {
    label: "Research documentation",
    audience: "исследовательские группы, научные руководители, reviewers",
    focus: [
      "логика исследования",
      "доказательная структура",
      "ясный expected outcome",
    ],
    requiredSections: [
      { key: "background", label: "Background", description: "What is known and why the topic matters.", keywords: ["background", "context", "актуаль", "literature"] },
      { key: "goal", label: "Goal / hypothesis", description: "Research goal or hypothesis.", keywords: ["goal", "hypothesis", "цель", "гипотез"] },
      { key: "methodology", label: "Methodology", description: "Methods, data, sample, instruments.", keywords: ["method", "methodology", "выборк", "данн", "dataset"] },
      { key: "kpi", label: "Success criteria", description: "How success is measured.", keywords: ["metric", "success", "критер", "метрик"] },
      { key: "results", label: "Expected results", description: "Scientific contribution or expected effect.", keywords: ["expected", "result", "contribution", "эффект"] },
      { key: "timeline", label: "Timeline", description: "Schedule and milestones.", keywords: ["timeline", "milestone", "срок", "этап"] },
    ],
    evaluationCriteria: [
      "Problem statement is specific, not generic.",
      "Methods match the stated goal and expected output.",
      "Expected contribution can be assessed.",
    ],
    commonMistakes: [
      "Research question is vague and not operationalized.",
      "Methods are listed without linking them to the goal.",
    ],
    templateOutline: [
      "1. Background",
      "2. Goal / hypothesis",
      "3. Methods",
      "4. Metrics",
      "5. Expected results",
      "6. Timeline",
    ],
  },
};

export const FEW_SHOT_EXAMPLES = {
  bad: {
    title: "Плохое ТЗ",
    document: `Создать платформу для улучшения медицины.
Цель: улучшить здравоохранение.
Задачи: провести исследования.
Результат: хороший эффект.`,
    why: [
      "Цель слишком общая и не измеряется.",
      "Нет методологии, KPI, сроков и критериев приемки.",
      "Результаты описаны декларативно.",
      "Нет связи с шаблоном научной документации.",
    ],
  },
  good: {
    title: "Хорошее ТЗ",
    document: `Цель программы: разработать AI-платформу для анализа медицинских данных с точностью классификации не ниже 85% к декабрю 2026 года.
Задачи: (1) собрать и анонимизировать датасет не менее 10 000 записей; (2) разработать pipeline предобработки; (3) обучить и валидировать модель; (4) провести пилот в двух клинических центрах.
Методология: retrospective data analysis, expert annotation, validation on hold-out sample.
Ожидаемые результаты: прототип, 2 статьи Q2+, 1 pilot report, 1 software registration.
KPI: accuracy >= 85%, latency <= 2 sec, не менее 2 пилотных внедрений.`,
    why: [
      "Цель измеримая: есть объект, метрика и срок.",
      "Есть задачи, методология, deliverables и KPI.",
      "Результат связан с научным и практическим эффектом.",
      "Структура соответствует ожиданиям научного ТЗ / grant-style document.",
    ],
  },
};

export function buildDomainContext(documentType: DocumentType) {
  const profile = DOMAIN_PROFILES[documentType];

  const sections = profile.requiredSections
    .map((section) => `- ${section.label}: ${section.description}`)
    .join("\n");

  const criteria = profile.evaluationCriteria.map((item) => `- ${item}`).join("\n");
  const mistakes = profile.commonMistakes.map((item) => `- ${item}`).join("\n");
  const outline = profile.templateOutline.map((item) => `- ${item}`).join("\n");

  return `Domain profile: ${profile.label}
Audience: ${profile.audience}
Focus:
${profile.focus.map((item) => `- ${item}`).join("\n")}

Required structure:
${sections}

Evaluation criteria:
${criteria}

Common mistakes:
${mistakes}

Reference outline:
${outline}

Few-shot bad example:
${FEW_SHOT_EXAMPLES.bad.document}
Why bad:
${FEW_SHOT_EXAMPLES.bad.why.map((item) => `- ${item}`).join("\n")}

Few-shot good example:
${FEW_SHOT_EXAMPLES.good.document}
Why good:
${FEW_SHOT_EXAMPLES.good.why.map((item) => `- ${item}`).join("\n")}`;
}
