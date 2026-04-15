export interface ParsedDocument {
  fileName: string;
  fileType: "text" | "pdf" | "docx";
  text: string;
  warnings: string[];
}

function normalizeExtractedText(text: string) {
  return text
    .replaceAll("\u0000", "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parseTextFile(file: File): Promise<ParsedDocument> {
  const text = normalizeExtractedText(await file.text());

  if (!text) {
    throw new Error("Не удалось извлечь текст из файла.");
  }

  return {
    fileName: file.name,
    fileType: "text",
    text,
    warnings: [],
  };
}

async function parseDocxFile(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const mammothModule = await import("mammoth/mammoth.browser");
  const mammoth = (mammothModule.default ?? mammothModule) as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages?: Array<{ message: string }> }>;
  };

  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = normalizeExtractedText(result.value);

  if (!text) {
    throw new Error("DOCX загружен, но текст не был извлечен.");
  }

  return {
    fileName: file.name,
    fileType: "docx",
    text,
    warnings: (result.messages ?? []).map((item) => item.message),
  };
}

async function parsePdfFile(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDocument = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  const text = normalizeExtractedText(pages.join("\n\n"));

  if (!text) {
    throw new Error("PDF загружен, но текст не был извлечен. Возможно, это скан без текстового слоя.");
  }

  return {
    fileName: file.name,
    fileType: "pdf",
    text,
    warnings: [],
  };
}

export async function parseUploadedDocument(file: File): Promise<ParsedDocument> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    return parsePdfFile(file);
  }

  if (lowerName.endsWith(".docx")) {
    return parseDocxFile(file);
  }

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerName.endsWith(".text")) {
    return parseTextFile(file);
  }

  throw new Error("Поддерживаются файлы TXT, MD, PDF и DOCX.");
}
