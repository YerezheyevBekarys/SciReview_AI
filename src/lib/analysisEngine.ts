﻿import { DOMAIN_PROFILES } from "@/data/researchKnowledge";
import { buildImprovedDocument } from "@/lib/improvedDocumentBuilder";
import type {
  AnalysisIssue,
  AnalysisResult,
  CriteriaScores,
  DocumentType,
  MissingBlock,
  Recommendation,
  Severity,
} from "@/lib/analysisTypes";
import {
  buildCompactSectionDigest,
  collectSectionText,
  isSectionEffectivelyEmpty,
  parseDocumentStructure,
  tokenizeMeaningful,
} from "@/lib/documentStructure";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL =
  (import.meta.env.VITE_GROQ_MODEL as string | undefined) || "llama-3.1-8b-instant";
const MAX_DOCUMENT_PAYLOAD = 11000;
const MAX_SECTION_DIGEST_ITEMS = 6;
const MAX_PROMPT_TOKENS = 5000;
const SAFE_PROMPT_TOKENS = 4600;

interface AnalyzeOptions {
  documentText: string;
  documentType: DocumentType;
  apiKey?: string;
  model?: string;
}

interface RuleAnalysis extends AnalysisResult {
  foundSectionKeys: string[];
}

interface SemanticBundle {
  topic: string;
  goal: string;
  tasks: string;
  methodology: string;
  results: string;
  finalResult: string;
  compliance: string;
}

interface PromptBuildResult {
  userPrompt: string;
  estimatedTokens: number;
  usedCompressedPrompt: boolean;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function roundConfidence(value: number) {
  return Math.min(0.99, Math.max(0.2, Number(value.toFixed(2))));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getSeverityPenalty(severity: Severity) {
  if (severity === "high") return 18;
  if (severity === "medium") return 10;
  return 5;
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function estimateTokens(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return 0;
  }

  const charsEstimate = Math.ceil(normalized.length / 4);
  const wordEstimate = Math.ceil(normalized.split(/\s+/).filter(Boolean).length * 1.35);
  return Math.max(charsEstimate, wordEstimate);
}

function truncateSemanticBlock(text: string, maxLength: number) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "Не указано.";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const shortened = normalized.slice(0, maxLength);
  const boundary = Math.max(shortened.lastIndexOf("."), shortened.lastIndexOf(";"), shortened.lastIndexOf(","));
  return `${(boundary > maxLength * 0.55 ? shortened.slice(0, boundary) : shortened).trim()}...`;
}

function findRelevantText(text: string, keywords: string[]) {
  const { flatSections } = parseDocumentStructure(text);
  const section = flatSections.find((item) =>
    keywords.some((keyword) => item.heading.toLowerCase().includes(keyword.toLowerCase())),
  );

  if (section) {
    return normalizeWhitespace(collectSectionText(section));
  }

  const lowered = text.toLowerCase();
  const keyword = keywords.find((item) => lowered.includes(item.toLowerCase()));
  if (!keyword) {
    return "";
  }

  const index = lowered.indexOf(keyword.toLowerCase());
  return normalizeWhitespace(text.slice(index, index + 900));
}

function getKeywordPresence(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function extractTitle(text: string) {
  const explicit = text.match(/(?:наименование проекта|название проекта|project title)\s*[:-]\s*([^\n]+)/i)?.[1]?.trim();
  if (explicit) return explicit;

  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !/^\d+(?:\.\d+)*[.)]?\s+/.test(line)) || ""
  );
}

function getSemanticSections(text: string, documentType: DocumentType): SemanticBundle {
  const { flatSections } = parseDocumentStructure(text);
  const findSectionText = (keywords: string[]) => {
    const section = flatSections.find((item) =>
      keywords.some((keyword) => item.heading.toLowerCase().includes(keyword.toLowerCase())),
    );
    return section ? normalizeWhitespace(collectSectionText(section)) : "";
  };

  return {
    topic: extractTitle(text) || flatSections[0]?.heading || "",
    goal:
      text.match(/(?:цель(?: программы)?|goal|objective)\s*[:-]\s*([^\n]+)/i)?.[1]?.trim() ||
      findSectionText(["цель", "goal", "objective"]),
    tasks: findSectionText(["задач", "tasks", "work package"]),
    methodology: findSectionText(["метод", "method", "approach", "design"]),
    results: findSectionText(["ожидаем", "результ", "deliverable", "эффект"]),
    finalResult: findSectionText(["конечн", "итог", "final result"]),
    compliance: findSectionText(["соответств", "стратег", "программ", "цур", "sdg", "концепц"]),
  };
}

function computeAlignmentScore(left: string, right: string) {
  const leftTokens = new Set(tokenizeMeaningful(left));
  const rightTokens = new Set(tokenizeMeaningful(right));
  if (leftTokens.size < 2 || rightTokens.size < 2) {
    return 0;
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
  return overlap.length / Math.min(leftTokens.size, rightTokens.size);
}

function detectFoundSections(text: string, documentType: DocumentType) {
  const profile = DOMAIN_PROFILES[documentType];
  const { flatSections } = parseDocumentStructure(text);

  return profile.requiredSections
    .filter((section) => {
      const inHeadings = flatSections.some((item) =>
        section.keywords.some((keyword) => item.heading.toLowerCase().includes(keyword.toLowerCase())),
      );
      return inHeadings || getKeywordPresence(text, section.keywords);
    })
    .map((section) => section.key);
}

function findEmptySections(documentText: string) {
  const { flatSections } = parseDocumentStructure(documentText);
  return flatSections.filter((section) => isSectionEffectivelyEmpty(section));
}

function hasMetrics(text: string) {
  return /(%|kpi|метрик|показател|accuracy|точност|не менее|не более|>=|<=|\d+\s*(?:секунд|месяц|год|стат|патент|магистр|phd))/i.test(text);
}

function hasTimeline(text: string) {
  return /(срок|этап|timeline|milestone|roadmap|квартал|месяц|202\d|203\d)/i.test(text);
}

function hasExpectedResults(text: string) {
  return /(ожидаем|результат|deliverable|эффект|публикац|патент|прототип|монограф|конечный результат)/i.test(text);
}

function hasMethodology(text: string) {
  return /(метод|методолог|исследован|эксперимент|валидац|dataset|выборк|анализ данных|data analysis)/i.test(text);
}

function hasPlaceholders(text: string) {
  return /(\.\.\.|_{3,}|xxxxx|todo|tbd|не принимается|без указания)/i.test(text);
}

function buildRuleSummary(text: string, documentType: DocumentType, foundSectionKeys: string[], emptySections: string[], alignmentNotes: string[]) {
  const profile = DOMAIN_PROFILES[documentType];
  const { flatSections } = parseDocumentStructure(text);

  return [
    `Обязательных блоков обнаружено: ${foundSectionKeys.length} из ${profile.requiredSections.length}.`,
    `Структурных разделов найдено: ${flatSections.length}.`,
    emptySections.length > 0
      ? `Разделов, требующих содержательного наполнения: ${emptySections.length}.`
      : "Критически пустых разделов не обнаружено.",
    hasMetrics(text) ? "Показатели эффективности и количественные критерии присутствуют." : "Количественные критерии выражены недостаточно.",
    hasTimeline(text) ? "Сроки и этапность отражены в документе." : "Сроки и этапность требуют уточнения.",
    hasExpectedResults(text) ? "Ожидаемые результаты сформулированы." : "Ожидаемые результаты описаны недостаточно явно.",
    ...alignmentNotes.slice(0, 2),
  ];
}

function buildSemanticIssues(bundle: SemanticBundle): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const checks = [
    {
      title: "Цель слабо связана с темой проекта",
      left: bundle.topic,
      right: bundle.goal,
      threshold: 0.18,
      severity: "high" as const,
      description:
        "Формулировка цели не раскрывает предмет проекта достаточно конкретно и выглядит слабо привязанной к основной теме документа.",
    },
    {
      title: "Задачи недостаточно поддерживают цель",
      left: bundle.goal,
      right: bundle.tasks,
      threshold: 0.14,
      severity: "high" as const,
      description:
        "Между целью и набором задач не прослеживается достаточно четкая логика перехода от замысла к исполнимому плану работ.",
    },
    {
      title: "Ожидаемые результаты слабо связаны с задачами",
      left: bundle.tasks,
      right: `${bundle.results} ${bundle.finalResult}`,
      threshold: 0.14,
      severity: "high" as const,
      description:
        "Результаты описаны отдельно от задач и требуют явной привязки к конкретным действиям, выходам и критериям приемки.",
    },
    {
      title: "Нормативное соответствие раскрыто формально",
      left: `${bundle.topic} ${bundle.goal}`,
      right: bundle.compliance,
      threshold: 0.1,
      severity: "medium" as const,
      description:
        "Указание стратегических и программных документов выглядит декларативным и не объясняет, как проект реально поддерживает эти приоритеты.",
    },
  ];

  for (const check of checks) {
    if (!check.left || !check.right) {
      continue;
    }

    const score = computeAlignmentScore(check.left, check.right);
    if (score < check.threshold) {
      issues.push({
        title: check.title,
        description: check.description,
        severity: check.severity,
        confidence: roundConfidence(0.76 + (check.threshold - score)),
        source: "rule",
        evidence: `Индекс смысловой согласованности: ${score.toFixed(2)}`,
      });
    }
  }

  return issues;
}

function buildAlignmentNotes(bundle: SemanticBundle) {
  const pairs = [
    {
      label: "Связь темы и цели",
      value: computeAlignmentScore(bundle.topic, bundle.goal),
    },
    {
      label: "Связь цели и задач",
      value: computeAlignmentScore(bundle.goal, bundle.tasks),
    },
    {
      label: "Связь задач и результатов",
      value: computeAlignmentScore(bundle.tasks, `${bundle.results} ${bundle.finalResult}`),
    },
  ];

  return pairs.map((pair) => {
    if (pair.value >= 0.26) {
      return `${pair.label}: согласованность выглядит устойчивой.`;
    }

    if (pair.value >= 0.14) {
      return `${pair.label}: требуется дополнительная конкретизация.`;
    }

    return `${pair.label}: обнаружен смысловой разрыв.`;
  });
}

function createImprovedVersion(
  text: string,
  documentType: DocumentType,
  missingBlocks: MissingBlock[],
  recommendations: Recommendation[],
) {
  return buildImprovedDocument({
    documentText: text,
    documentType,
    missingBlocks,
    recommendations,
  });
}

export function runRuleBasedChecks(documentText: string, documentType: DocumentType): RuleAnalysis {
  const sanitizedText = normalizeWhitespace(documentText);
  const profile = DOMAIN_PROFILES[documentType];
  const { flatSections } = parseDocumentStructure(sanitizedText);
  const foundSectionKeys = detectFoundSections(sanitizedText, documentType);
  const missingSections = profile.requiredSections.filter((section) => !foundSectionKeys.includes(section.key));
  const bundle = getSemanticSections(sanitizedText, documentType);
  const emptySections = findEmptySections(sanitizedText);

  const issues: AnalysisIssue[] = [];

  if (!sanitizedText) {
    issues.push({
      title: "Документ пустой",
      description: "Для анализа требуется текст технического задания, грантовой заявки или исследовательского документа.",
      severity: "high",
      confidence: 0.99,
      source: "rule",
    });
  }

  if (sanitizedText.length < 450) {
    issues.push({
      title: "Недостаточный объем документа",
      description: "Документ выглядит слишком коротким для полноценной научной экспертизы и обычно требует более развернутой структуры.",
      severity: "medium",
      confidence: 0.84,
      source: "rule",
      evidence: `Длина текста: ${sanitizedText.length} символов`,
    });
  }

  if (!bundle.goal) {
    issues.push({
      title: "Цель не сформулирована явно",
      description: "Не найден отдельный блок с измеримой целью проекта или исследования.",
      severity: "high",
      confidence: 0.9,
      source: "rule",
    });
  } else if (
    bundle.goal.length < 50 ||
    /(улучшить|оптимизировать|развить|поддержать)\b/i.test(bundle.goal)
  ) {
    issues.push({
      title: "Цель сформулирована слишком общо",
      description: "Цель больше похожа на намерение, чем на проверяемый результат с конкретными параметрами успеха.",
      severity: "high",
      confidence: 0.83,
      source: "rule",
      evidence: bundle.goal,
    });
  }

  if (!hasMetrics(sanitizedText)) {
    issues.push({
      title: "Не хватает измеримых критериев",
      description: "В документе не обнаружены явные количественные показатели, по которым можно оценить успешность выполнения работы.",
      severity: "high",
      confidence: 0.93,
      source: "rule",
    });
  }

  if (!hasTimeline(sanitizedText)) {
    issues.push({
      title: "Не указаны сроки и этапы",
      description: "Отсутствует понятная календарная логика реализации или контрольные точки проекта.",
      severity: "medium",
      confidence: 0.89,
      source: "rule",
    });
  }

  if (!hasExpectedResults(sanitizedText)) {
    issues.push({
      title: "Слабо описаны ожидаемые результаты",
      description: "Не выделены измеримые выходы проекта, конечные результаты или эффекты, по которым можно судить о его завершении.",
      severity: "high",
      confidence: 0.86,
      source: "rule",
    });
  }

  if (!hasMethodology(sanitizedText)) {
    issues.push({
      title: "Недостаточно раскрыта методология",
      description: "Для научного документа требуется более явное описание подхода, методов, данных и процедуры проверки результатов.",
      severity: "medium",
      confidence: 0.85,
      source: "rule",
    });
  }

  if (hasPlaceholders(sanitizedText)) {
    issues.push({
      title: "Обнаружены незаполненные формулировки",
      description: "В документе встречаются шаблонные или служебные фрагменты, снижающие доверие к качеству подготовки материала.",
      severity: "medium",
      confidence: 0.88,
      source: "rule",
    });
  }

  for (const section of emptySections) {
    issues.push({
      title: `Раздел требует наполнения: ${section.heading}`,
      description: `Раздел "${section.heading}" обозначен, но содержательно раскрыт недостаточно для экспертной оценки.`,
      severity: "medium",
      confidence: 0.8,
      source: "rule",
      evidence: collectSectionText(section).slice(0, 180) || "Содержимое почти отсутствует",
    });
  }

  const semanticIssues = buildSemanticIssues(bundle);
  issues.push(...semanticIssues);

  const missingBlocks: MissingBlock[] = missingSections.map((section) => ({
    block: section.label,
    reason: section.description,
    confidence: 0.9,
    source: "rule",
  }));

  const recommendations: Recommendation[] = uniqueBy(
    [
      ...missingBlocks.map((block) => ({
        title: `Добавить блок: ${block.block}`,
        action: `Добавить раздел "${block.block}" и связать его с целью проекта, задачами и ожидаемыми результатами.`,
        impact: "Повышает структурную полноту документа и снижает риск замечаний на экспертизе.",
        confidence: 0.9,
        source: "rule" as const,
      })),
      {
        title: "Сделать цель измеримой",
        action: "Переформулировать цель через результат, количественные критерии и срок достижения.",
        impact: "Повышает прозрачность оценки результата и управляемость проекта.",
        confidence: 0.88,
        source: "rule" as const,
      },
      {
        title: "Уточнить связку между задачами и результатами",
        action: "Для каждой ключевой задачи зафиксировать ожидаемый выход, форму подтверждения и критерий приемки.",
        impact: "Снижает риск смысловых разрывов между планом работ и конечным результатом.",
        confidence: 0.86,
        source: "rule" as const,
      },
      {
        title: "Раскрыть нормативное соответствие",
        action: "Не только перечислить стратегические документы, но и показать, какую часть проекта каждый из них поддерживает.",
        impact: "Делает документ убедительнее для грантовой и научной экспертизы.",
        confidence: 0.82,
        source: "rule" as const,
      },
    ],
    (item) => item.title,
  );

  const structureScore = clamp(
    (foundSectionKeys.length / profile.requiredSections.length) * 100 - emptySections.length * 4,
  );
  const clarityScore = clamp(bundle.goal ? (bundle.goal.length >= 70 ? 80 : 55) : 28);
  const kpiScore = clamp(hasMetrics(sanitizedText) ? 82 : 26);
  const scientificScore = clamp(hasMethodology(sanitizedText) ? 80 : 35);
  const completenessScore = clamp(
    (1 - missingBlocks.length / profile.requiredSections.length) * 100 -
      issues.filter((issue) => issue.severity === "high").length * 4,
  );
  const logicScore = clamp(
    86 - emptySections.length * 4 - semanticIssues.length * 4 - (hasPlaceholders(sanitizedText) ? 8 : 0),
  );

  const criteriaScores: CriteriaScores = {
    clarity: clarityScore,
    completeness: completenessScore,
    kpi: kpiScore,
    logic: logicScore,
    scientific: scientificScore,
    structure: structureScore,
  };

  const weightedScore = clamp(
    (criteriaScores.clarity +
      criteriaScores.completeness +
      criteriaScores.kpi +
      criteriaScores.logic +
      criteriaScores.scientific +
      criteriaScores.structure) /
      6 -
      issues.reduce((sum, issue) => sum + getSeverityPenalty(issue.severity), 0) * 0.12,
  );

  const alignmentNotes = buildAlignmentNotes(bundle);

  return {
    overallScore: weightedScore,
    criteriaScores,
    issues: uniqueBy(issues, (issue) => `${issue.title}:${issue.description}`),
    missingBlocks,
    recommendations,
    improvedVersion: createImprovedVersion(sanitizedText, documentType, missingBlocks, recommendations),
    confidenceSummary: {
      overallScore: roundConfidence(0.78),
      issues: roundConfidence(0.84),
      missingBlocks: roundConfidence(0.9),
      recommendations: roundConfidence(0.86),
      improvedVersion: roundConfidence(0.72),
    },
    ruleSummary: buildRuleSummary(
      sanitizedText,
      documentType,
      foundSectionKeys,
      emptySections.map((item) => item.heading),
      alignmentNotes,
    ),
    analysisMeta: {
      mode: "rules",
      usedDomainContext: false,
      usedFewShot: false,
      generatedAt: new Date().toISOString(),
      documentType,
    },
    foundSectionKeys,
  };
}

function buildCompactDomainContext(documentType: DocumentType) {
  const profile = DOMAIN_PROFILES[documentType];
  return [
    `Тип документа: ${profile.label}`,
    `Фокусы оценки: ${profile.focus.slice(0, 2).join("; ")}.`,
    `Ключевые разделы: ${profile.requiredSections.slice(0, 5).map((item) => item.label).join(", ")}.`,
    `Риски качества: ${profile.commonMistakes.slice(0, 2).join("; ")}.`,
  ].join("\n");
}

function buildFewShotSnippet() {
  return [
    "Ориентир оценки:",
    "Слабый документ: общая цель без измеримых критериев и слабая связь задач с результатами.",
    "Сильный документ: измеримая цель, прослеживаемая логика задач и конкретные результаты.",
  ].join("\n");
}

function compactDocumentPayload(text: string, maxLength = MAX_DOCUMENT_PAYLOAD) {
  if (text.length <= maxLength) {
    return text;
  }

  const head = text.slice(0, Math.floor(maxLength * 0.7));
  const tail = text.slice(-Math.floor(maxLength * 0.25));
  return `${head}\n\n[... фрагмент документа сокращен для компактной передачи ...]\n\n${tail}`;
}

function fitPromptToBudget(systemPrompt: string, userPrompt: string) {
  const totalEstimate = estimateTokens(`${systemPrompt}\n\n${userPrompt}`);
  if (totalEstimate <= SAFE_PROMPT_TOKENS) {
    return {
      userPrompt,
      estimatedTokens: totalEstimate,
    };
  }

  const safeChars = Math.max(1800, Math.floor((SAFE_PROMPT_TOKENS - estimateTokens(systemPrompt) - 180) * 4));
  const trimmedPrompt = `${userPrompt.slice(0, safeChars)}\n\n[Часть второстепенных деталей опущена для компактной экспертной оценки длинного документа.]`;

  return {
    userPrompt: trimmedPrompt,
    estimatedTokens: estimateTokens(`${systemPrompt}\n\n${trimmedPrompt}`),
  };
}

function buildSystemPrompt(documentType: DocumentType) {
  const profile = DOMAIN_PROFILES[documentType];
  return `Ты выступаешь как строгий научный эксперт по документам типа "${profile.label}".
Верни только корректный JSON на русском языке.
Оцени: цель, структуру, KPI, методологию, логическую связность, ожидаемые результаты, нормативное соответствие.
Если раздел формально есть, но содержательно слабый, укажи это явно.
Поле improvedVersion должно быть полной улучшенной редакцией документа с сохранением логики исходного текста, а не новым абстрактным шаблоном.
Схема ответа:
{"overallScore":number,"criteriaScores":{"clarity":number,"completeness":number,"kpi":number,"logic":number,"scientific":number,"structure":number},"issues":[{"title":string,"description":string,"severity":"high"|"medium"|"low","confidence":number,"evidence":string}],"missingBlocks":[{"block":string,"reason":string,"confidence":number}],"recommendations":[{"title":string,"action":string,"impact":string,"confidence":number}],"improvedVersion":string,"confidenceSummary":{"overallScore":number,"issues":number,"missingBlocks":number,"recommendations":number,"improvedVersion":number},"llmSummary":string}`;
}

function buildCompressedDocumentDigest(documentText: string, documentType: DocumentType, ruleAnalysis: RuleAnalysis) {
  const bundle = getSemanticSections(documentText, documentType);
  const timeline = findRelevantText(documentText, ["срок", "этап", "timeline", "milestone", "roadmap", "квартал", "календар"]);
  const metrics = findRelevantText(documentText, ["kpi", "метрик", "показател", "критери", "точност", "не менее", "не более"]);
  const budget = findRelevantText(documentText, ["бюджет", "сумма", "финанс", "тенге", "cost", "budget"]);
  const { flatSections } = parseDocumentStructure(documentText);
  const sectionDigest = buildCompactSectionDigest(documentText, Math.min(4, MAX_SECTION_DIGEST_ITEMS), 220)
    .map((section, index) => `${index + 1}. ${section.heading} | ${section.summary}`)
    .join("\n");

  return [
    `Название / тема: ${truncateSemanticBlock(bundle.topic || extractTitle(documentText), 220)}`,
    `Цель: ${truncateSemanticBlock(bundle.goal, 320)}`,
    `Задачи: ${truncateSemanticBlock(bundle.tasks, 420)}`,
    `Методология: ${truncateSemanticBlock(bundle.methodology, 320)}`,
    `Ожидаемые результаты: ${truncateSemanticBlock(`${bundle.results} ${bundle.finalResult}`.trim(), 420)}`,
    `KPI и метрики: ${truncateSemanticBlock(metrics, 280)}`,
    `Сроки и этапность: ${truncateSemanticBlock(timeline, 280)}`,
    `Стратегическое соответствие: ${truncateSemanticBlock(bundle.compliance, 280)}`,
    `Бюджет / финансирование: ${truncateSemanticBlock(budget, 220)}`,
    `Выделено разделов: ${flatSections.length}.`,
    `Ключевые разделы документа:\n${sectionDigest || "Не удалось выделить ключевые разделы."}`,
    `Критические замечания baseline-проверки: ${ruleAnalysis.issues
      .slice(0, 5)
      .map((item) => item.title)
      .join("; ") || "не выявлены"}.`,
    `Недостающие блоки baseline-проверки: ${ruleAnalysis.missingBlocks.map((item) => item.block).join(", ") || "не выявлены"}.`,
  ].join("\n");
}

function buildUserPrompt(
  documentText: string,
  documentType: DocumentType,
  ruleAnalysis: RuleAnalysis,
): PromptBuildResult {
  const systemPrompt = buildSystemPrompt(documentType);
  const digest = buildCompactSectionDigest(documentText, MAX_SECTION_DIGEST_ITEMS)
    .map((section, index) => `${index + 1}. ${section.heading} | плотность ${section.density} | ${section.summary}`)
    .join("\n");

  const compactDiagnostics = [
    `Интегральная оценка: ${ruleAnalysis.overallScore}/100`,
    `Критические замечания: ${ruleAnalysis.issues.filter((item) => item.severity === "high").length}`,
    `Отсутствующие блоки: ${ruleAnalysis.missingBlocks.map((item) => item.block).join(", ") || "не выявлены"}`,
    `Ключевые замечания: ${ruleAnalysis.issues.slice(0, 4).map((item) => item.title).join("; ")}`,
  ].join("\n");

  const normalPrompt = [
    buildCompactDomainContext(documentType),
    buildFewShotSnippet(),
    "Предварительная диагностика:",
    compactDiagnostics,
    "Краткая выжимка по разделам:",
    digest || "Разделы не выделены.",
    "Документ для экспертной оценки:",
    compactDocumentPayload(documentText),
  ].join("\n\n");

  const normalEstimate = estimateTokens(`${systemPrompt}\n\n${normalPrompt}`);
  if (normalEstimate <= MAX_PROMPT_TOKENS) {
    return {
      userPrompt: normalPrompt,
      estimatedTokens: normalEstimate,
      usedCompressedPrompt: false,
    };
  }

  const compressedPrompt = [
    buildCompactDomainContext(documentType),
    "Режим анализа длинного документа: передана структурированная смысловая выжимка вместо полного текста.",
    "Предварительная диагностика:",
    compactDiagnostics,
    "Структурированный digest документа:",
    buildCompressedDocumentDigest(documentText, documentType, ruleAnalysis),
  ].join("\n\n");

  const compressedEstimate = estimateTokens(`${systemPrompt}\n\n${compressedPrompt}`);
  if (compressedEstimate <= SAFE_PROMPT_TOKENS) {
    return {
      userPrompt: compressedPrompt,
      estimatedTokens: compressedEstimate,
      usedCompressedPrompt: true,
    };
  }

  const ultraCompressedPrompt = [
    `Тип документа: ${DOMAIN_PROFILES[documentType].label}`,
    "Режим анализа длинного документа: используй только структурированную выжимку ниже.",
    `Baseline score: ${ruleAnalysis.overallScore}/100.`,
    `Критические замечания: ${ruleAnalysis.issues.slice(0, 3).map((item) => item.title).join("; ") || "не выявлены"}.`,
    `Недостающие блоки: ${ruleAnalysis.missingBlocks.slice(0, 4).map((item) => item.block).join(", ") || "не выявлены"}.`,
    buildCompressedDocumentDigest(documentText, documentType, ruleAnalysis),
  ].join("\n\n");

  const fittedUltraPrompt = fitPromptToBudget(systemPrompt, ultraCompressedPrompt);

  return {
    userPrompt: fittedUltraPrompt.userPrompt,
    estimatedTokens: fittedUltraPrompt.estimatedTokens,
    usedCompressedPrompt: true,
  };
}

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }

  return content.trim();
}

async function requestGroq(
  messages: Array<{ role: "system" | "user"; content: string }>,
  apiKey: string,
  model: string,
  useJsonMode: boolean,
) {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2200,
      ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Groq request failed with status ${response.status}`);
  }

  return response.json();
}

function normalizeLlmResponse(
  raw: Record<string, unknown>,
  ruleAnalysis: RuleAnalysis,
  documentText: string,
  documentType: DocumentType,
  model: string,
  promptMetadata?: Pick<PromptBuildResult, "usedCompressedPrompt" | "estimatedTokens">,
): AnalysisResult {
  const rawCriteria = (raw.criteriaScores ?? raw.criteria ?? {}) as Record<string, unknown>;
  const confidenceMap = (raw.confidenceSummary as Record<string, unknown> | undefined) || {};
  const fallbackImprovedVersion = createImprovedVersion(
    documentText,
    documentType,
    ruleAnalysis.missingBlocks,
    ruleAnalysis.recommendations,
  );
  const normalizeConfidence = (value: unknown, fallback: number) =>
    roundConfidence(typeof value === "number" ? value : fallback);

  const normalizeIssue = (item: unknown): AnalysisIssue | null => {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    if (!value.title || !value.description) return null;

    return {
      title: String(value.title),
      description: String(value.description),
      severity:
        value.severity === "high" || value.severity === "medium" || value.severity === "low"
          ? value.severity
          : "medium",
      confidence: normalizeConfidence(value.confidence, 0.76),
      evidence: value.evidence ? String(value.evidence) : undefined,
      source: "llm",
    };
  };

  const normalizeMissing = (item: unknown): MissingBlock | null => {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    if (!value.block || !value.reason) return null;

    return {
      block: String(value.block),
      reason: String(value.reason),
      confidence: normalizeConfidence(value.confidence, 0.8),
      source: "llm",
    };
  };

  const normalizeRecommendation = (item: unknown): Recommendation | null => {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    if (!value.title || !value.action) return null;

    return {
      title: String(value.title),
      action: String(value.action),
      impact: value.impact ? String(value.impact) : "Улучшает качество документа и готовность к экспертизе.",
      confidence: normalizeConfidence(value.confidence, 0.79),
      source: "llm",
    };
  };

  const llmIssues = Array.isArray(raw.issues)
    ? (raw.issues.map(normalizeIssue).filter(Boolean) as AnalysisIssue[])
    : [];
  const llmMissing = Array.isArray(raw.missingBlocks)
    ? (raw.missingBlocks.map(normalizeMissing).filter(Boolean) as MissingBlock[])
    : [];
  const llmRecommendations = Array.isArray(raw.recommendations)
    ? (raw.recommendations.map(normalizeRecommendation).filter(Boolean) as Recommendation[])
    : [];

  const mergedCriteria: CriteriaScores = {
    clarity: clamp((Number(rawCriteria.clarity ?? ruleAnalysis.criteriaScores.clarity) + ruleAnalysis.criteriaScores.clarity) / 2),
    completeness: clamp((Number(rawCriteria.completeness ?? ruleAnalysis.criteriaScores.completeness) + ruleAnalysis.criteriaScores.completeness) / 2),
    kpi: clamp((Number(rawCriteria.kpi ?? ruleAnalysis.criteriaScores.kpi) + ruleAnalysis.criteriaScores.kpi) / 2),
    logic: clamp((Number(rawCriteria.logic ?? ruleAnalysis.criteriaScores.logic) + ruleAnalysis.criteriaScores.logic) / 2),
    scientific: clamp((Number(rawCriteria.scientific ?? ruleAnalysis.criteriaScores.scientific) + ruleAnalysis.criteriaScores.scientific) / 2),
    structure: clamp((Number(rawCriteria.structure ?? ruleAnalysis.criteriaScores.structure) + ruleAnalysis.criteriaScores.structure) / 2),
  };

  return {
    overallScore: clamp(Number(raw.overallScore ?? ruleAnalysis.overallScore) * 0.6 + ruleAnalysis.overallScore * 0.4),
    criteriaScores: mergedCriteria,
    issues: uniqueBy([...ruleAnalysis.issues, ...llmIssues], (item) => item.title),
    missingBlocks: uniqueBy([...ruleAnalysis.missingBlocks, ...llmMissing], (item) => item.block),
    recommendations: uniqueBy([...ruleAnalysis.recommendations, ...llmRecommendations], (item) => item.title),
    improvedVersion:
      typeof raw.improvedVersion === "string" && raw.improvedVersion.trim().length > 700
        ? raw.improvedVersion
        : fallbackImprovedVersion,
    confidenceSummary: {
      overallScore: normalizeConfidence(confidenceMap.overallScore, 0.83),
      issues: normalizeConfidence(confidenceMap.issues, 0.8),
      missingBlocks: normalizeConfidence(confidenceMap.missingBlocks, 0.85),
      recommendations: normalizeConfidence(confidenceMap.recommendations, 0.82),
      improvedVersion: normalizeConfidence(confidenceMap.improvedVersion, 0.7),
    },
    ruleSummary: ruleAnalysis.ruleSummary,
    llmSummary:
      typeof raw.llmSummary === "string"
        ? raw.llmSummary
        : "Подготовлено расширенное экспертное заключение по качеству и логике документа.",
    analysisMeta: {
      mode: "hybrid",
      model,
      usedDomainContext: true,
      usedFewShot: true,
      usedCompressedPrompt: promptMetadata?.usedCompressedPrompt ?? false,
      promptTokenEstimate: promptMetadata?.estimatedTokens,
      generatedAt: new Date().toISOString(),
      documentType,
    },
  };
}

async function runGroqAnalysis(
  documentText: string,
  documentType: DocumentType,
  ruleAnalysis: RuleAnalysis,
  apiKey: string,
  model: string,
) {
  const promptPlan = buildUserPrompt(documentText, documentType, ruleAnalysis);
  const messages = [
    { role: "system" as const, content: buildSystemPrompt(documentType) },
    { role: "user" as const, content: promptPlan.userPrompt },
  ];

  try {
    const jsonModeResponse = await requestGroq(messages, apiKey, model, true);
    const content = jsonModeResponse?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(extractJson(String(content ?? "{}"))) as Record<string, unknown>;
    return normalizeLlmResponse(parsed, ruleAnalysis, documentText, documentType, model, promptPlan);
  } catch {
    const fallbackResponse = await requestGroq(messages, apiKey, model, false);
    const content = fallbackResponse?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(extractJson(String(content ?? "{}"))) as Record<string, unknown>;
    return normalizeLlmResponse(parsed, ruleAnalysis, documentText, documentType, model, promptPlan);
  }
}

export async function analyzeTechnicalSpecification({
  documentText,
  documentType,
  apiKey,
  model,
}: AnalyzeOptions): Promise<AnalysisResult> {
  const ruleAnalysis = runRuleBasedChecks(documentText, documentType);

  if (!apiKey?.trim()) {
    return ruleAnalysis;
  }

  try {
    return await runGroqAnalysis(documentText, documentType, ruleAnalysis, apiKey.trim(), model?.trim() || DEFAULT_GROQ_MODEL);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown external analysis error";

    return {
      ...ruleAnalysis,
      recommendations: uniqueBy(
        [
          {
            title: "Повторить расширенную оценку позже",
            action: `Расширенный анализ временно недоступен: ${message}. Сейчас показана базовая структурно-логическая редакция документа.`,
            impact: "После восстановления доступа система сможет дополнить результат более глубокой экспертной переработкой.",
            confidence: 0.92,
            source: "rule",
          },
          ...ruleAnalysis.recommendations,
        ],
        (item) => item.title,
      ),
      llmSummary:
        "В данный момент доступна базовая структурно-логическая оценка документа. Улучшенная редакция сформирована без расширенного внешнего анализа.",
    };
  }
}
