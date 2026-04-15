import { describe, expect, it } from "vitest";

import { runRuleBasedChecks } from "@/lib/analysisEngine";

describe("runRuleBasedChecks", () => {
  it("flags weak documents that lack metrics and structure", () => {
    const result = runRuleBasedChecks(
      "Создать платформу для развития науки. Цель: улучшить исследования. Результат: хороший эффект.",
      "scientific_tz",
    );

    expect(result.overallScore).toBeLessThan(60);
    expect(result.issues.some((item) => item.title.includes("измерим") || item.title.includes("критер"))).toBe(true);
    expect(result.missingBlocks.length).toBeGreaterThan(0);
  });

  it("rewards structured scientific documents with KPI and timeline", () => {
    const result = runRuleBasedChecks(
      `1. Актуальность: проект решает проблему медленной экспертизы научных технических заданий и снижает нагрузку на экспертные комиссии.
2. Цель: разработать систему анализа ТЗ с точностью не ниже 85% к декабрю 2026 года и сократить время первичной проверки на 70%.
3. Задачи:
3.1. Реализовать разбор структуры документа.
3.2. Описать критерии оценки и методику проверки.
3.3. Подготовить модуль рекомендаций и итоговой редакции.
4. Методология: NLP-анализ, экспертная валидация, тестирование на корпусе из 100 документов.
5. KPI: accuracy >= 85%, время анализа <= 10 секунд, не менее 90% найденных обязательных разделов.
6. Ожидаемые результаты: MVP, 2 публикации, software registration, pilot report.
7. Сроки: апрель 2026 - май 2026, milestone каждые 2 недели.
8. Соответствие стратегическим документам: проект поддерживает цифровую трансформацию и развитие науки.`,
      "scientific_tz",
    );

    expect(result.overallScore).toBeGreaterThan(50);
    expect(result.criteriaScores.kpi).toBeGreaterThan(70);
    expect(result.ruleSummary.some((item) => item.includes("Показатели эффективности"))).toBe(true);
  });

  it("does not mark nested numbered sections with bullet content as empty", () => {
    const result = runRuleBasedChecks(
      `1. Общие сведения
1.1. Наименование проекта: SciReview AI
2. Цель программы
2.1. Цель: разработать систему экспертной оценки научных ТЗ.
2.2. Задачи:
- провести анализ структуры документа;
- определить измеримые критерии качества;
- подготовить улучшенную редакцию документа.
3. Ожидаемые результаты
3.1. Научный результат: аналитический отчет и публикации.
3.2. Технологический результат: MVP и пилотное внедрение.
4. Сроки
4.1. Этап 1: май 2026.
4.2. Этап 2: июнь 2026.`,
      "scientific_tz",
    );

    expect(result.issues.some((item) => item.title.includes("2.2. Задачи"))).toBe(false);
    expect(result.improvedVersion).toContain("2. Цель программы");
  });
});
