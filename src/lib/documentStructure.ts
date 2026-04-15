export interface ParsedSection {
  id: string;
  heading: string;
  title: string;
  level: number;
  numbering?: string;
  bodyLines: string[];
  children: ParsedSection[];
}

interface HeadingMatch {
  numbering?: string;
  title: string;
  level: number;
  heading: string;
}

const STOPWORDS = new Set([
  "и",
  "в",
  "во",
  "на",
  "по",
  "с",
  "со",
  "к",
  "ко",
  "для",
  "или",
  "из",
  "от",
  "до",
  "при",
  "что",
  "как",
  "это",
  "этот",
  "данный",
  "также",
  "проект",
  "программа",
  "документ",
  "раздел",
  "пункты",
  "пункт",
  "целью",
  "цели",
  "задачи",
  "результаты",
]);

function createSection(match: HeadingMatch, index: number): ParsedSection {
  return {
    id: `${match.numbering || "section"}-${index}`,
    heading: match.heading,
    title: match.title,
    level: match.level,
    numbering: match.numbering,
    bodyLines: [],
    children: [],
  };
}

function normalizeTitle(title: string) {
  return title.replace(/\s+/g, " ").trim();
}

function matchHeading(line: string): HeadingMatch | null {
  const numbered = line.match(/^(\d+(?:\.\d+){0,5})[.)]?\s+(.+)$/);
  if (numbered) {
    const title = normalizeTitle(numbered[2].replace(/[:.]\s*$/, ""));
    if (title.length >= 2 && /[A-Za-zА-Яа-яЁё]/.test(title) && line.length <= 260) {
      return {
        numbering: numbered[1],
        title,
        level: numbered[1].split(".").length,
        heading: line.trim(),
      };
    }
  }

  const plainHeading = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁA-Za-zА-Яа-яЁё0-9 ,()-]{3,120})[:.]?$/);
  if (
    plainHeading &&
    !/^(kpi|api|pdf|docx|txt)$/i.test(plainHeading[1].trim()) &&
    plainHeading[1].trim().split(/\s+/).length <= 10
  ) {
    return {
      title: normalizeTitle(plainHeading[1]),
      level: 1,
      heading: line.trim(),
    };
  }

  return null;
}

function flattenSections(items: ParsedSection[], target: ParsedSection[] = []) {
  for (const item of items) {
    target.push(item);
    flattenSections(item.children, target);
  }

  return target;
}

export function parseDocumentStructure(text: string) {
  const lines = text.split(/\r?\n/);
  const root: ParsedSection = {
    id: "root",
    heading: "",
    title: "",
    level: 0,
    bodyLines: [],
    children: [],
  };

  const stack: ParsedSection[] = [root];
  let sectionIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = matchHeading(line);
    if (headingMatch) {
      const section = createSection(headingMatch, sectionIndex++);
      while (stack.length > 1 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(section);
      stack.push(section);
      continue;
    }

    stack[stack.length - 1].bodyLines.push(line);
  }

  return {
    intro: root.bodyLines.join("\n").trim(),
    sections: root.children,
    flatSections: flattenSections(root.children),
  };
}

export function collectSectionText(section: ParsedSection) {
  const own = section.bodyLines.join("\n").trim();
  const childText = section.children.map(collectSectionText).filter(Boolean).join("\n");
  return [own, childText].filter(Boolean).join("\n").trim();
}

export function tokenizeMeaningful(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
    .map((token) =>
      token
        .replace(
          /(иями|ями|ами|ого|ему|ому|ыми|ими|иях|ция|ции|цией|ость|ости|ение|ения|ировать|ться|ется|ются|ный|ная|ное|ные|ях|ах|ов|ев|ий|ый|ая|ое|ые|ть|ти|ся)$/u,
          "",
        )
        .replace(/-+/g, ""),
    )
    .filter((token) => token.length >= 3);
}

export function getSemanticDensity(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return 0;
  }

  const tokens = tokenizeMeaningful(normalized);
  const uniqueTokens = new Set(tokens);
  const bulletCount = (normalized.match(/(^|\n)\s*(?:[-*•]|\d+[.)])/g) || []).length;
  return uniqueTokens.size * 2 + Math.min(tokens.length, 24) + bulletCount * 4;
}

export function isSectionEffectivelyEmpty(section: ParsedSection) {
  const fullText = collectSectionText(section);
  if (!fullText) {
    return true;
  }

  const density = getSemanticDensity(fullText);
  return density < 16;
}

export function buildCompactSectionDigest(text: string, limit = 8, maxSectionLength = 360) {
  const { flatSections } = parseDocumentStructure(text);
  return flatSections.slice(0, limit).map((section) => {
    const content = collectSectionText(section).replace(/\s+/g, " ").trim();
    return {
      heading: section.heading,
      summary: content.slice(0, maxSectionLength),
      density: getSemanticDensity(content),
    };
  });
}
