import { ChangeEvent, useEffect, useMemo, useState, startTransition, useDeferredValue } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  ChevronDown,
  CheckCircle2,
  Copy,
  FileSearch,
  FileText,
  FlaskConical,
  KeyRound,
  Loader2,
  Sparkles,
  TabletSmartphone,
  Target,
  Upload,
} from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPE_OPTIONS } from "@/data/researchKnowledge";
import type { AnalysisIssue, AnalysisResult, DocumentType, Recommendation } from "@/lib/analysisTypes";
import { analyzeTechnicalSpecification } from "@/lib/analysisEngine";
import type { ParsedDocument } from "@/lib/documentParser";
import { parseUploadedDocument } from "@/lib/documentParser";

const SAMPLE_TEXT = `Техническое задание на научно-исследовательскую работу

1. Общие сведения
1.1. Наименование проекта: SciReview AI
1.2. Актуальность: технические задания на научные проекты часто формулируются размыто, без KPI и без понятной структуры, что осложняет экспертизу заявок.

2. Цель программы
2.1. Цель: разработать цифровую систему, которая за 10 секунд анализирует научное ТЗ, выявляет структурные пробелы и формирует рекомендации по улучшению качества документа.

3. Задачи
3.1. Разработать модуль парсинга структуры ТЗ.
3.2. Реализовать проверку обязательных разделов и критериев качества.
3.3. Подготовить блок рекомендаций и улучшенную редакцию документа.
3.4. Сформировать систему оценки по шкале 0-100.

4. Методология
Используется интеллектуальный анализ текста с экспертными критериями оценки научной документации.

5. KPI и критерии приемки
- точность выявления отсутствующих обязательных блоков не ниже 85%;
- время анализа одного документа не более 10 секунд;
- поддержка не менее 3 типов документов: научное ТЗ, грантовая заявка, НИОКР.

6. Ожидаемые результаты
- web MVP;
- оценка качества документа по шкале 0-100;
- рекомендации и улучшенная версия документа;
- возможность анализа научных и грантовых документов.

7. План-график
Этап 1 - анализ требований, апрель 2026.
Этап 2 - разработка MVP, апрель 2026.
Этап 3 - тестирование на примерах научных ТЗ, май 2026.`;

const STORAGE_KEYS = {
  apiKey: "scientific-tz:grok-api-key",
  model: "scientific-tz:grok-model",
  documentType: "scientific-tz:document-type",
  sourceText: "scientific-tz:source-text",
};

function getSeverityTone(issue: AnalysisIssue) {
  if (issue.severity === "high") return "destructive";
  if (issue.severity === "medium") return "secondary";
  return "outline";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RecommendationList({ items }: { items: Recommendation[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-700" />
            <div className="font-medium text-slate-900">{item.title}</div>
            <Badge variant="outline" className="ml-auto border-cyan-200 text-cyan-700">
              уверенность {Math.round(item.confidence * 100)}%
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-700">{item.action}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{item.impact}</p>
        </div>
      ))}
    </div>
  );
}

export default function ResearchAnalyzerPage() {
  const [documentType, setDocumentType] = useState<DocumentType>("scientific_tz");
  const [sourceText, setSourceText] = useState(SAMPLE_TEXT);
  const [apiKey, setApiKey] = useState((import.meta.env.VITE_GROQ_API_KEY as string | undefined) || "");
  const [model, setModel] = useState((import.meta.env.VITE_GROQ_MODEL as string | undefined) || "llama-3.1-8b-instant");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<ParsedDocument | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [error, setError] = useState("");
  const deferredSourceText = useDeferredValue(sourceText);

  useEffect(() => {
    const savedApiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    const savedModel = localStorage.getItem(STORAGE_KEYS.model);
    const savedType = localStorage.getItem(STORAGE_KEYS.documentType) as DocumentType | null;
    const savedText = localStorage.getItem(STORAGE_KEYS.sourceText);

    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setModel(savedModel);
    if (savedType) setDocumentType(savedType);
    if (savedText) setSourceText(savedText);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.model, model);
  }, [model]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.documentType, documentType);
  }, [documentType]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sourceText, sourceText);
  }, [sourceText]);

  const liveStats = useMemo(() => {
    const words = deferredSourceText.trim() ? deferredSourceText.trim().split(/\s+/).length : 0;
    const chars = deferredSourceText.length;
    return { words, chars };
  }, [deferredSourceText]);

  const handleAnalyze = async () => {
    if (!sourceText.trim()) {
      setError("Вставьте текст ТЗ или исследовательского документа, иначе анализировать нечего.");
      return;
    }

    setError("");
    setIsAnalyzing(true);

    try {
      const analysis = await analyzeTechnicalSpecification({
        documentText: sourceText,
        documentType,
        apiKey,
        model,
      });

      startTransition(() => {
        setResult(analysis);
      });
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Не удалось выполнить анализ.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setError("");

    try {
      const parsedDocument = await parseUploadedDocument(file);
      setUploadedDocument(parsedDocument);
      setSourceText(parsedDocument.text);
    } catch (parseError) {
      setUploadedDocument(null);
      setError(parseError instanceof Error ? parseError.message : "Не удалось прочитать файл.");
    } finally {
      setIsParsingFile(false);
      event.target.value = "";
    }
  };

  const copyImprovedVersion = async () => {
    if (!result?.improvedVersion) return;

    try {
      await navigator.clipboard.writeText(result.improvedVersion);
    } catch {
      setError("Не удалось скопировать текст в буфер обмена.");
    }
  };

  const selectedType = DOCUMENT_TYPE_OPTIONS.find((item) => item.value === documentType);
  const isBaselineRevision = result?.analysisMeta.mode === "rules";
  const isCompressedExpertMode = Boolean(result?.analysisMeta.usedCompressedPrompt) && !isBaselineRevision;
  const revisionTitle = isBaselineRevision
    ? "Базовая структурно-логическая редакция документа"
    : "Улучшенная версия документа";
  const revisionDescription = isBaselineRevision
    ? "Редакция подготовлена на основе структуры и содержания исходного документа без расширенной внешней экспертной дооценки."
    : "Полноценная улучшенная редакция документа с сохранением структуры исходного материала.";
  const resultBadgeLabel = isBaselineRevision ? "Базовая оценка" : "Расширенная оценка";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(160deg,#f8fbff_0%,#eef4ff_50%,#f9fafb_100%)] px-3 py-4 sm:px-4 md:px-6 md:py-8 xl:px-8">
      <div className="mx-auto max-w-[1360px] space-y-6 md:space-y-8">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_20px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="grid gap-6 p-5 sm:p-6 lg:p-8 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] text-cyan-800">
                <FlaskConical className="h-4 w-4" />
                SciReview AI
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl xl:text-5xl">
                  SciReview AI для анализа научных ТЗ, грантовых заявок и НИОКР
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base md:text-lg">
                  Система проводит интеллектуальную оценку научной документации, выявляет содержательные и
                  структурные риски, формирует рекомендации и подготавливает улучшенную редакцию документа.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge className="rounded-full bg-slate-900 px-4 py-1.5 text-white">Экспертная оценка</Badge>
                <Badge variant="outline" className="rounded-full border-cyan-300 px-4 py-1.5 text-cyan-800">
                  Научная экспертиза
                </Badge>
                <Badge variant="outline" className="rounded-full border-indigo-300 px-4 py-1.5 text-indigo-800">
                  Готово к демонстрации
                </Badge>
              </div>
            </div>

            <Card className="border-slate-200 bg-slate-950 text-white shadow-none">
              <CardHeader>
                <CardTitle className="text-xl">Что оценивает система</CardTitle>
                <CardDescription className="text-slate-300">
                  Проверка проводится по экспертным критериям качества научной документации.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-slate-200">
                {[
                  "Ясность цели и научной гипотезы",
                  "Полноту структуры и обязательные разделы",
                  "KPI, сроки, ожидаемые результаты и критерии приемки",
                  "Логические разрывы, пустые разделы и недостающие формулировки",
                  "Научную корректность и методологию",
                  "Соответствие требованиям исследовательской и грантовой документации",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="border-white/70 bg-white/85 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] 2xl:sticky 2xl:top-6">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <FileSearch className="h-5 w-5 text-cyan-700" />
                <CardTitle className="text-2xl">Входные данные</CardTitle>
              </div>
              <CardDescription>
                Загрузите документ или вставьте текст для последующей структурной и содержательной оценки.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <TabletSmartphone className="h-4 w-4 text-cyan-700" />
                    Адаптивный интерфейс
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">
                    Интерфейс сохраняет удобную структуру на телефонах и планшетах и поддерживает комфортную работу с документами.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <FileText className="h-4 w-4 text-cyan-700" />
                    Импорт документов
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">
                    Поддерживаются TXT, PDF и DOCX с предварительной подготовкой текста для последующей оценки.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Тип документа</label>
                  <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPE_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">{selectedType?.helper}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Режим анализа</label>
                  <Input value="SciReview AI Core" readOnly className="bg-slate-100 text-slate-500" />
                  <p className="text-xs text-slate-500">Используется стандартный режим интеллектуальной оценки документа.</p>
                </div>
              </div>

              <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Настройки доступа</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Скрытый служебный блок для подключения расширенной оценки. Для demo можно не открывать.
                      </p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${debugOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-slate-200 px-4 py-4">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <KeyRound className="h-4 w-4 text-cyan-700" />
                        Ключ доступа
                      </label>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder="gsk_..."
                        autoComplete="off"
                      />
                      <p className="text-xs leading-5 text-slate-500">
                        Ключ хранится локально в браузере и используется только для выполнения анализа в текущем сеансе.
                      </p>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Текст документа</label>
                  <div className="text-xs text-slate-500">{liveStats.words} слов · {liveStats.chars} символов</div>
                </div>
                <Textarea
                  value={sourceText}
                  onChange={(event) => {
                    setSourceText(event.target.value);
                  }}
                  placeholder="Вставьте сюда научное ТЗ, грантовую заявку или исследовательский документ..."
                  className="min-h-[320px] resize-y rounded-3xl border-slate-200 bg-slate-50/80 p-5 text-sm leading-6 md:min-h-[420px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleAnalyze} disabled={isAnalyzing} className="rounded-full px-6">
                  {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                  {isAnalyzing ? "Выполняется анализ..." : "Начать анализ"}
                </Button>

                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setUploadedDocument(null);
                    setSourceText(SAMPLE_TEXT);
                  }}
                >
                  <Target className="h-4 w-4" />
                  Загрузить демонстрационный пример
                </Button>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {isParsingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isParsingFile ? "Подготовка документа..." : "Загрузить документ"}
                  <input type="file" accept=".txt,.md,.text,.pdf,.docx" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              {uploadedDocument && (
                <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full bg-cyan-600 text-white">{uploadedDocument.fileType.toUpperCase()}</Badge>
                    <div className="text-sm font-medium text-slate-900">{uploadedDocument.fileName}</div>
                    <div className="text-xs text-slate-500">{uploadedDocument.text.length} символов извлечено</div>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">
                    Извлечённый текст уже подставлен в рабочее поле. При необходимости его можно отредактировать до запуска анализа.
                  </p>
                  {uploadedDocument.warnings.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
                      {uploadedDocument.warnings.join(" ")}
                    </div>
                  )}
                  <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-100 bg-white/80 p-3 text-xs leading-6 text-slate-700">
                    {uploadedDocument.text.slice(0, 1200)}
                    {uploadedDocument.text.length > 1200 ? "\n\n..." : ""}
                  </pre>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/70 bg-white/85 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
              <CardHeader>
                <CardTitle className="text-2xl">Итог анализа</CardTitle>
                <CardDescription>
                  Система формирует оценку качества документа, выявленные замечания, рекомендации и улучшенную редакцию.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {result ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
                      <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white">
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Интегральная оценка</div>
                        <div className="mt-4 text-6xl font-semibold">{result.overallScore}</div>
                        <div className="mt-2 text-sm text-slate-300">из 100</div>
                        <div className="mt-6 flex flex-wrap gap-2">
                          <Badge className="rounded-full bg-cyan-500 px-3 py-1 text-white">{resultBadgeLabel}</Badge>
                          {isCompressedExpertMode ? (
                            <Badge variant="outline" className="rounded-full border-amber-300 px-3 py-1 text-amber-100">
                              Compressed Expert Analysis Mode
                            </Badge>
                          ) : null}
                          <Badge variant="outline" className="rounded-full border-slate-700 px-3 py-1 text-slate-200">
                            {selectedType?.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5 sm:p-6">
                        <ScoreBar label="Ясность цели" value={result.criteriaScores.clarity} />
                        <ScoreBar label="Полнота структуры" value={result.criteriaScores.completeness} />
                        <ScoreBar label="KPI и метрики" value={result.criteriaScores.kpi} />
                        <ScoreBar label="Логика" value={result.criteriaScores.logic} />
                        <ScoreBar label="Научная корректность" value={result.criteriaScores.scientific} />
                        <ScoreBar label="Структура" value={result.criteriaScores.structure} />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {result.ruleSummary.map((line) => (
                        <div key={line} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          {line}
                        </div>
                      ))}
                    </div>

                    {result.llmSummary && (
                      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-900">
                        <strong className="font-semibold">Краткое заключение:</strong> {result.llmSummary}
                      </div>
                    )}

                    {isCompressedExpertMode && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                        Для расширенной оценки был использован компактный экспертный режим анализа длинного документа.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 p-8 text-sm leading-7 text-slate-600">
                    После запуска анализа здесь появится итоговая оценка документа, ключевые замечания и рекомендации по доработке.
                  </div>
                )}
              </CardContent>
            </Card>

            {result && (
              <>
                <Card className="border-white/70 bg-white/85 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
                  <CardHeader>
                    <CardTitle>Проблемы и недостающие блоки</CardTitle>
                    <CardDescription>Структурная и содержательная оценка по экспертным критериям.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 2xl:grid-cols-2">
                    <div className="space-y-3">
                      {result.issues.map((issue) => (
                        <div key={issue.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-slate-900">{issue.title}</div>
                            <Badge variant={getSeverityTone(issue)} className="ml-auto">
                              {issue.severity}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{issue.description}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>уверенность: {Math.round(issue.confidence * 100)}%</span>
                            {issue.evidence && <span>основание: {issue.evidence}</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {result.missingBlocks.map((item) => (
                        <div key={item.block} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-700" />
                            <div className="font-medium text-slate-900">{item.block}</div>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{item.reason}</p>
                          <div className="mt-3 text-xs text-slate-500">
                            уверенность: {Math.round(item.confidence * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/85 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
                  <CardHeader>
                    <CardTitle>Рекомендации</CardTitle>
                    <CardDescription>Конкретные действия, а не общий комментарий.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecommendationList items={result.recommendations} />
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/85 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle>{revisionTitle}</CardTitle>
                      <CardDescription>{revisionDescription}</CardDescription>
                    </div>
                    <Button variant="outline" className="rounded-full" onClick={copyImprovedVersion}>
                      <Copy className="h-4 w-4" />
                      Скопировать
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-[28px] border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-5 py-4 text-xs uppercase tracking-[0.25em] text-slate-500">
                        {revisionTitle}
                      </div>
                      {isBaselineRevision && (
                        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                          Блок подготовлен как базовая структурно-логическая редакция: сохранена исходная логика документа, дополнены слабые места и отсутствующие разделы.
                        </div>
                      )}
                      <div className="max-h-[720px] overflow-auto px-5 py-6">
                        <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm leading-7">
                          {result.improvedVersion}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/85 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)]">
                  <CardHeader>
                    <CardTitle>Дополнительные сведения</CardTitle>
                    <CardDescription>Развернутые структурированные данные анализа доступны по запросу.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between rounded-2xl">
                          <span>Показать структурированный отчет</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${debugOpen ? "rotate-180" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <pre className="max-h-[360px] overflow-auto rounded-[28px] border border-slate-200 bg-slate-50 p-5 text-xs leading-6 text-slate-800">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
