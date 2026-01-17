/**
 * SCM Badge Generator
 * 
 * Generates an SVG status badge from p2-operator-cert.json
 * Output: artifacts/qa/scm/p2-operator-cert-badge.svg
 */

import fs from "fs";
import path from "path";

type Overall = "PASS" | "HELD" | "FAIL";

function readOverall(certPath: string): Overall {
  const raw = fs.readFileSync(certPath, "utf8");
  const cert = JSON.parse(raw);
  const s = cert?.summary?.overall_status as Overall | undefined;
  if (s !== "PASS" && s !== "HELD" && s !== "FAIL") throw new Error("Invalid overall_status");
  return s;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function badgeSvg(label: string, value: string, valueColor: string): string {
  const leftW = Math.max(60, label.length * 7 + 20);
  const rightW = Math.max(60, value.length * 7 + 20);
  const w = leftW + rightW;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeXml(
    label
  )}: ${escapeXml(value)}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${w}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftW}" height="20" fill="#555"/>
    <rect x="${leftW}" width="${rightW}" height="20" fill="${valueColor}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle"
     font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
    <text x="${leftW / 2}" y="14">${escapeXml(label)}</text>
    <text x="${leftW + rightW / 2}" y="14">${escapeXml(value)}</text>
  </g>
</svg>`;
}

function main(): void {
  const certPath = path.resolve("artifacts/qa/scm/p2-operator-cert.json");
  if (!fs.existsSync(certPath)) {
    console.error("Missing cert:", certPath);
    process.exit(1);
  }

  const overall = readOverall(certPath);

  const color =
    overall === "PASS" ? "#2ea44f" : overall === "HELD" ? "#dbab09" : "#d73a49";

  const svg = badgeSvg("SCM", overall, color);

  const outPath = path.resolve("artifacts/qa/scm/p2-operator-cert-badge.svg");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, "utf8");

  console.log("Wrote badge:", outPath);
}

main();
