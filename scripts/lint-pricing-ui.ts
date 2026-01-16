import fs from "fs";
import path from "path";
import process from "process";

type RuleSetName = "forbiddenCopy" | "currency";

type RouteContextRule = {
  name: string;
  matchPathRegex: string;
  forbidRegexSet: "forbiddenCopy" | "currency";
};

type Config = {
  rootDir: string;
  scanGlobs: string[];
  ignoreGlobs: string[];
  allowGlobs: string[];
  forbiddenComponents: string[];
  forbiddenCopyRegex: string[];
  currencyRegex: string[];
  routeContextRules: RouteContextRule[];
};

function loadConfig(): Config {
  const p = path.resolve(process.cwd(), "scripts/lint-pricing-ui.config.json");
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as Config;
}

function globToRegex(glob: string): RegExp {
  let pattern = glob
    .replace(/\*\*/g, "§§DOUBLESTAR§§")
    .replace(/\*/g, "§§STAR§§")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/§§DOUBLESTAR§§/g, ".*")
    .replace(/§§STAR§§/g, "[^/]*");
  return new RegExp("^" + pattern + "$");
}

function matchesAnyGlob(filePath: string, globs: string[]): boolean {
  const unixPath = filePath.replace(/\\/g, "/");
  return globs.some((g) => globToRegex(g).test(unixPath));
}

function walkDir(dir: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else out.push(full);
  }
  return out;
}

function isScannable(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|mdx)$/i.test(filePath);
}

function stripComments(text: string): string {
  let result = text;
  result = result.replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length));
  result = result.replace(/\/\/.*$/gm, (match) => ' '.repeat(match.length));
  return result;
}

function compileRegexes(patterns: string[]): RegExp[] {
  return patterns.map((p) => {
    const flags = p.startsWith("(?i)") ? "gi" : "g";
    const source = p.startsWith("(?i)") ? p.slice(4) : p;
    return new RegExp(source, flags);
  });
}

function findAllMatches(text: string, rx: RegExp): Array<{ index: number; match: string }> {
  const out: Array<{ index: number; match: string }> = [];
  const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
  const r = new RegExp(rx.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    out.push({ index: m.index, match: m[0] });
    if (m.index === r.lastIndex) r.lastIndex++;
  }
  return out;
}

function indexToLineCol(text: string, idx: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

function snippetAt(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + len + 20);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function main() {
  const cfg = loadConfig();
  const root = path.resolve(process.cwd(), cfg.rootDir);

  const allFiles = walkDir(root).map((p) => path.relative(root, p).replace(/\\/g, "/"));
  const scanRegexes = cfg.scanGlobs.map(globToRegex);
  const candidates = allFiles
    .filter((rel) => scanRegexes.some((rx) => rx.test(rel)))
    .filter((rel) => !matchesAnyGlob(rel, cfg.ignoreGlobs))
    .map((rel) => path.join(root, rel));

  const forbiddenCopy = compileRegexes(cfg.forbiddenCopyRegex);
  const currency = compileRegexes(cfg.currencyRegex);

  const violations: string[] = [];

  function applyRegexSet(relPath: string, text: string, setName: RuleSetName) {
    const set = setName === "forbiddenCopy" ? forbiddenCopy : currency;
    for (const rx of set) {
      const matches = findAllMatches(text, rx);
      for (const m of matches) {
        const { line, col } = indexToLineCol(text, m.index);
        violations.push(
          `${relPath}:${line}:${col} [${setName}] matched "${m.match}" :: ${snippetAt(text, m.index, m.match.length)}`
        );
      }
    }
  }

  for (const abs of candidates) {
    if (!isScannable(abs)) continue;

    const relPath = path.relative(root, abs).replace(/\\/g, "/");

    const rawText = fs.readFileSync(abs, "utf8");
    const text = stripComments(rawText);

    const isAppTree = /^client\/src\/(pages|routes)\/app\//.test(relPath);
    if (isAppTree) {
      for (const comp of cfg.forbiddenComponents) {
        const jsxRx = new RegExp(String.raw`<\s*${comp}\b`);
        const importRx = new RegExp(String.raw`\b${comp}\b`);
        if (jsxRx.test(text) || importRx.test(text)) {
          violations.push(`${relPath}:1:1 [component] forbidden component reference "${comp}"`);
        }
      }
    }

    const isAllow = matchesAnyGlob(relPath, cfg.allowGlobs);

    for (const rule of cfg.routeContextRules) {
      const matchRx = new RegExp(rule.matchPathRegex);
      if (!matchRx.test(relPath)) continue;

      if (isAllow) continue;

      if (rule.forbidRegexSet === "forbiddenCopy") applyRegexSet(relPath, text, "forbiddenCopy");
      if (rule.forbidRegexSet === "currency") applyRegexSet(relPath, text, "currency");
    }
  }

  if (violations.length) {
    console.error("❌ Pricing UI lint failed. Violations:");
    for (const v of violations.slice(0, 200)) console.error(" - " + v);
    if (violations.length > 200) console.error(`... and ${violations.length - 200} more`);
    process.exit(1);
  } else {
    console.log("✅ Pricing UI lint passed.");
  }
}

main();
