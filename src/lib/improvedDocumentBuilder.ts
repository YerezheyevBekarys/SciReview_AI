import { DOMAIN_PROFILES } from "@/data/researchKnowledge";
import type { DocumentType, MissingBlock, Recommendation } from "@/lib/analysisTypes";
import {
  collectSectionText,
  getSemanticDensity,
  parseDocumentStructure,
  type ParsedSection,
} from "@/lib/documentStructure";

interface BuildImprovedDocumentOptions {
  documentText: string;
  documentType: DocumentType;
  missingBlocks: MissingBlock[];
  recommendations: Recommendation[];
}

interface RewriteContext {
  title: string;
  goal: string;
  tasks: string[];
  methodology: string;
  results: string;
  timeline: string;
  compliance: string;
  background: string;
  recommendationActions: string[];
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function paragraphize(text: string) {
  return normalizeWhitespace(text)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBulletList(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function extractFirstLineByPattern(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

function extractTitle(text: string, documentType: DocumentType) {
  const explicit = extractFirstLineByPattern(
    text,
    /(?:наименование проекта|название проекта|project title)\s*[:-]\s*([^\n]+)/i,
  );

  if (explicit) {
    return explicit;
  }

  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/^\d+(?:\.\d+)*[.)]?\s+/.test(line));

  return firstLine || DOMAIN_PROFILES[documentType].label;
}

function extractContext(documentText: string, documentType: DocumentType): RewriteContext {
  const { flatSections } = parseDocumentStructure(documentText);
  const paragraphs = paragraphize(documentText);
  const findSection = (keywords: string[]) =>
    flatSections.find((section) =>
      keywords.some((keyword) => section.heading.toLowerCase().includes(keyword.toLowerCase())),
    );
  const getSectionText = (keywords: string[]) => {
    const section = findSection(keywords);
    return section ? normalizeWhitespace(collectSectionText(section)) : "";
  };

  const tasksSection = findSection(["задач", "tasks"]);
  const tasksText = tasksSection ? collectSectionText(tasksSection) : "";
  const tasks = tasksText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*•]|\d+[.)]/.test(line))
    .map((line) => line.replace(/^[-*•\d). ]+/, "").trim())
    .filter(Boolean);

  return {
    title: extractTitle(documentText, documentType),
    goal:
      extractFirstLineByPattern(documentText, /(?:цель(?: программы)?|goal|objective)\s*[:-]\s*([^\n]+)/i) ||
      getSectionText(["цель", "goal", "objective"]),
    tasks,
    methodology: getSectionText(["метод", "method", "approach", "дизайн"]),
    results: getSectionText(["ожидаем", "результ", "deliverable", "эффект", "конечн"]),
    timeline: getSectionText(["срок", "этап", "timeline", "milestone", "roadmap"]),
    compliance: getSectionText(["соответств", "стратег", "программ", "цур", "sdg", "концепц"]),
    background:
      getSectionText(["актуаль", "обосн", "problem", "background", "context"]) ||
      paragraphs[0] ||
      "",
    recommendationActions: [],
  };
}

function matchSemanticKey(section: ParsedSection, documentType: DocumentType) {
  const profile = DOMAIN_PROFILES[documentType];
  const heading = section.heading.toLowerCase();
  return (
    profile.requiredSections.find((item) =>
      item.keywords.some((keyword) => heading.includes(keyword.toLowerCase())),
    )?.key || "generic"
  );
}

function improveGoal(text: string, context: RewriteContext) {
  if (text.length >= 140 && /(%|не менее|не более|к \d{4}|\d+\s*(?:секунд|месяц|год|стат|патент))/i.test(text)) {
    return text;
  }

  return normalizeWhitespace(
    `${text || context.goal || `Цель проекта заключается в достижении измеримого результата по теме "${context.title}".`} ` +
      `Цель должна быть выражена через конкретный объект исследования, ожидаемый результат, количественные критерии и срок достижения. ` +
      `Рекомендуется зафиксировать не менее двух показателей результативности и привязать их к конечным научным и прикладным результатам проекта.`,
  );
}

function improveTasks(text: string, context: RewriteContext) {
  const taskItems =
    context.tasks.length > 0
      ? context.tasks
      : [
          "уточнить предмет исследования и границы рассматриваемой научной задачи",
          "описать методологию, состав данных и критерии проверки результатов",
          "сформировать измеримые показатели эффективности и ожидаемые выходы проекта",
          "зафиксировать этапность реализации и критерии приемки промежуточных результатов",
        ];

  if (taskItems.length >= 3) {
    return toBulletList(taskItems);
  }

  return normalizeWhitespace(`${text}\n${toBulletList(taskItems)}`);
}

function improveMethodology(text: string, context: RewriteContext) {
  const baseline =
    text ||
    context.methodology ||
    "Методологическая часть должна описывать используемые методы, источники данных, процедуры верификации и критерии интерпретации результатов.";

  if (/(валид|вериф|выборк|данн|эксперимент|анализ)/i.test(baseline) && baseline.length > 180) {
    return baseline;
  }

  return normalizeWhitespace(
    `${baseline} Необходимо уточнить дизайн исследования, состав и происхождение данных, порядок анализа, способы проверки воспроизводимости и ограничения применимости получаемых результатов.`,
  );
}

function improveResults(text: string, context: RewriteContext) {
  const baseline =
    text ||
    context.results ||
    "Ожидаемые результаты должны быть разделены на научные, технологические и практические эффекты.";

  if (/(научн|технолог|социаль|эконом|публикац|патент|прототип|модул)/i.test(baseline) && baseline.length > 180) {
    return baseline;
  }

  return normalizeWhitespace(
    `${baseline} Рекомендуется раздельно описать научные публикации и аналитические материалы, прикладные результаты в виде прототипов или сервисов, а также ожидаемый организационный или социально-экономический эффект.`,
  );
}

function improveTimeline(text: string, context: RewriteContext) {
  const baseline = text || context.timeline;
  if (/(этап|срок|квартал|месяц|год|milestone)/i.test(baseline) && baseline.length > 120) {
    return baseline;
  }

  return [
    baseline,
    "1. Подготовительный этап: уточнение требований, исходных данных и критериев оценки.",
    "2. Основной этап: выполнение исследования, апробация методики и получение промежуточных результатов.",
    "3. Итоговый этап: верификация результатов, оформление отчетных материалов и подготовка внедрения.",
  ]
    .filter(Boolean)
    .join("\n");
}

function improveCompliance(text: string, context: RewriteContext) {
  const baseline =
    text ||
    context.compliance ||
    "Необходимо показать, каким образом проект соответствует приоритетам программы и стратегическим документам.";

  if (baseline.length > 160) {
    return baseline;
  }

  return normalizeWhitespace(
    `${baseline} Для каждого нормативного или стратегического документа следует явно указать, какой именно аспект проекта ему соответствует и каким результатом это подтверждается.`,
  );
}

function improveBackground(text: string, context: RewriteContext) {
  const baseline =
    text ||
    context.background ||
    `Проект посвящен теме "${context.title}" и требует дополнительного обоснования актуальности, научной новизны и практической значимости.`;

  if (baseline.length > 180) {
    return baseline;
  }

  return normalizeWhitespace(
    `${baseline} В обосновании следует показать текущую проблему, масштаб ее влияния, ограничения существующих подходов и причину, по которой предложенное решение является своевременным.`,
  );
}

function improveKpi(text: string) {
  const baseline = text || "Необходимо зафиксировать измеримые критерии качества и результативности проекта.";
  if (/(%|не менее|не более|accuracy|точност|время|публикац|патент)/i.test(baseline) && baseline.length > 100) {
    return baseline;
  }

  return normalizeWhitespace(
    `${baseline} Рекомендуется включить показатели качества результата, сроки достижения, критерии приемки и количественные характеристики ожидаемых выходов проекта.`,
  );
}

function improveGeneric(text: string, context: RewriteContext) {
  const baseline = text || "";
  if (getSemanticDensity(baseline) >= 18) {
    return baseline;
  }

  const recommendation = context.recommendationActions[0];
  return normalizeWhitespace(
    `${baseline || "Раздел требует содержательного наполнения."} Следует уточнить связь данного блока с целью проекта, задачами, ожидаемыми результатами и критериями оценки.${recommendation ? ` ${recommendation}` : ""}`,
  );
}

function rewriteSection(section: ParsedSection, documentType: DocumentType, context: RewriteContext): string {
  const semanticKey = matchSemanticKey(section, documentType);
  const fullText = normalizeWhitespace(collectSectionText(section));

  let revised = fullText;
  switch (semanticKey) {
    case "goal":
      revised = improveGoal(fullText, context);
      break;
    case "tasks":
      revised = improveTasks(fullText, context);
      break;
    case "methodology":
      revised = improveMethodology(fullText, context);
      break;
    case "results":
      revised = improveResults(fullText, context);
      break;
    case "timeline":
      revised = improveTimeline(fullText, context);
      break;
    case "compliance":
      revised = improveCompliance(fullText, context);
      break;
    case "background":
    case "problem":
      revised = improveBackground(fullText, context);
      break;
    case "kpi":
      revised = improveKpi(fullText);
      break;
    default:
      revised = improveGeneric(fullText, context);
      break;
  }

  return `${section.heading}\n${normalizeWhitespace(revised)}`;
}

function buildMissingSection(sectionKey: string, documentType: DocumentType, context: RewriteContext) {
  const profile = DOMAIN_PROFILES[documentType];
  const section = profile.requiredSections.find((item) => item.key === sectionKey);
  const heading = section ? section.label : "Дополнительный раздел";

  switch (sectionKey) {
    case "background":
    case "problem":
      return `${heading}\n${improveBackground("", context)}`;
    case "goal":
      return `${heading}\n${improveGoal("", context)}`;
    case "tasks":
      return `${heading}\n${improveTasks("", context)}`;
    case "methodology":
      return `${heading}\n${improveMethodology("", context)}`;
    case "kpi":
      return `${heading}\n${improveKpi("")}`;
    case "results":
      return `${heading}\n${improveResults("", context)}`;
    case "timeline":
      return `${heading}\n${improveTimeline("", context)}`;
    case "compliance":
      return `${heading}\n${improveCompliance("", context)}`;
    default:
      return `${heading}\n${improveGeneric("", context)}`;
  }
}

export function buildImprovedDocument({
  documentText,
  documentType,
  missingBlocks,
  recommendations,
}: BuildImprovedDocumentOptions) {
  const profile = DOMAIN_PROFILES[documentType];
  const { intro, sections, flatSections } = parseDocumentStructure(documentText);
  const context = extractContext(documentText, documentType);
  context.recommendationActions = recommendations.slice(0, 3).map((item) => item.action);

  const existingSemanticKeys = new Set(flatSections.map((section) => matchSemanticKey(section, documentType)));
  const revisedSections = sections.length
    ? sections.map((section) => rewriteSection(section, documentType, context))
    : profile.requiredSections.slice(0, 5).map((section) => buildMissingSection(section.key, documentType, context));

  const appendedSections = profile.requiredSections
    .filter((section) => !existingSemanticKeys.has(section.key))
    .map((section) => buildMissingSection(section.key, documentType, context));

  const revisionNotes =
    missingBlocks.length || recommendations.length
      ? [
          "Примечания к редакции",
          missingBlocks.map((item) => `- Добавлен или уточнен блок "${item.block}": ${item.reason}`).join("\n"),
          recommendations.slice(0, 4).map((item) => `- ${item.action}`).join("\n"),
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  return [
    context.title,
    intro ? normalizeWhitespace(intro) : `Документ подготовлен в редакции, ориентированной на ${profile.label.toLowerCase()}.`,
    ...revisedSections,
    ...appendedSections,
    revisionNotes,
  ]
    .filter(Boolean)
    .join("\n\n");
}
