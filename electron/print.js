const PRINT_SHEET_CSS = `
@page { size: A4; margin: 12mm; }
@page announcer { size: A4; margin: 5mm; }
.print-sheet.announcer { page: announcer; }
html, body {
  background: #fff;
  color: #111;
  margin: 0;
  padding: 0;
}
.print-sheet {
  display: block;
  background: #fff;
  color: #111;
  font-family: "Segoe UI", sans-serif;
}
.print-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 3px solid #d60a0a;
}
.print-head img { height: 64px; }
.print-head p {
  margin: 0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 11px;
  color: #444;
}
.print-head h1 { margin: 4px 0 0; font-size: 26px; }
.print-head h2 { margin: 4px 0 0; font-size: 16px; font-weight: 600; color: #333; }
.print-sheet table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.print-sheet th,
.print-sheet td {
  padding: 6px 8px;
  border-bottom: 1px solid #ddd;
  text-align: left;
  vertical-align: middle;
}
.print-sheet th {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #555;
  border-bottom: 2px solid #111;
}
.print-sheet .num { text-align: right; width: 48px; font-variant-numeric: tabular-nums; }
.print-sheet .votes { font-weight: 800; font-size: 15px; }
.print-player {
  display: flex;
  align-items: center;
  gap: 8px;
}
.print-photo {
  width: 28px;
  height: 28px;
  object-fit: cover;
  border-radius: 4px;
}
.print-club {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.print-foot {
  margin-top: 16px;
  font-size: 11px;
  color: #666;
}
.print-round {
  break-inside: avoid;
  margin: 0 0 14px;
}
.print-round h3 {
  margin: 0 0 8px;
  font-size: 13px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d60a0a;
  border-bottom: 2px solid #111;
  padding-bottom: 4px;
}
.print-game {
  break-inside: avoid;
  margin: 0 0 10px;
  padding: 6px 0 8px;
  border-bottom: 1px solid #ddd;
}
.print-match {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 6px;
}
.print-match strong { font-size: 14px; }
.print-match span { font-size: 13px; font-weight: 700; }
.print-game ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.print-game li {
  display: grid;
  grid-template-columns: 28px 28px 1fr;
  gap: 10px;
  align-items: center;
  padding: 2px 0;
}
.print-game li b { font-size: 20px; line-height: 1; }
.print-game .print-club {
  width: 28px;
  height: 28px;
  object-fit: contain;
  display: block;
}
.print-game i.print-club { background: transparent; }
.print-game li span {
  font-size: 16px;
  font-weight: 700;
}
.print-game li small {
  display: inline;
  margin-left: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.print-skip {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #666;
}
.print-grade.next { break-before: page; padding-top: 4px; }
.print-grade-title {
  margin: 0 0 12px;
  font-size: 22px;
  border-bottom: 3px solid #d60a0a;
  padding-bottom: 6px;
}
.print-winner {
  break-inside: avoid;
  margin: 18px 0 8px;
  padding: 12px 14px;
  border: 2px solid #d60a0a;
}
.print-winner p {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 800;
  color: #d60a0a;
}
.print-winner-who { display: flex; align-items: center; gap: 10px; }
.print-winner .print-photo {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
}
.print-winner .print-club {
  width: 36px;
  height: 36px;
  object-fit: contain;
}
.print-winner strong { display: block; font-size: 22px; }
.print-winner small {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #333;
}
.print-sheet.announcer .print-head {
  gap: 10px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom-width: 2px;
}
.print-sheet.announcer .print-head img { height: 40px; }
.print-sheet.announcer .print-head p { font-size: 9px; }
.print-sheet.announcer .print-head h1 { margin-top: 1px; font-size: 18px; }
.print-sheet.announcer .print-head h2 { margin-top: 1px; font-size: 12px; }
.print-sheet.announcer .print-foot { margin-top: 8px; font-size: 9px; }
.print-sheet.announcer .print-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 284mm;
  overflow: hidden;
  break-after: page;
  page-break-after: always;
  break-inside: avoid;
}
.print-sheet.announcer .print-page.first {
  height: 268mm;
}
.print-sheet.announcer .print-page.last-sheet {
  height: 276mm;
}
.print-sheet.announcer .print-page:last-child {
  break-after: auto;
  page-break-after: auto;
}
.print-sheet.announcer .print-round,
.print-sheet.announcer .print-game,
.print-sheet.announcer .print-game ol {
  display: contents;
}
.print-sheet.announcer .print-round h3 {
  flex: 0 0 auto;
  margin: 4px 0 2px;
  font-size: 12px;
  padding-bottom: 2px;
  border-bottom-width: 2px;
}
.print-sheet.announcer .print-match {
  flex: 0 0 auto;
  margin: 3px 0 0;
  padding-top: 2px;
  border-top: 1px solid #ddd;
  gap: 8px;
}
.print-sheet.announcer .print-match strong { font-size: 12px; line-height: 1.1; }
.print-sheet.announcer .print-match span { font-size: 11px; }
.print-sheet.announcer .print-game li {
  flex: 0 0 var(--vote-row, 6mm);
  height: var(--vote-row, 6mm);
  min-height: 0;
  overflow: hidden;
  grid-template-columns: auto auto 1fr;
  gap: 0.4mm 1.5mm;
  padding: 0;
  align-items: center;
}
.print-sheet.announcer .print-game li b {
  font-size: calc(var(--vote-row, 6mm) * 0.82);
  line-height: 1;
}
.print-sheet.announcer .print-game .print-club {
  width: calc(var(--vote-row, 6mm) * 0.74);
  height: calc(var(--vote-row, 6mm) * 0.74);
}
.print-sheet.announcer .print-game li span {
  font-size: calc(var(--vote-row, 6mm) * 0.58);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.print-sheet.announcer .print-game li small {
  margin-left: 6px;
  font-size: 0.72em;
}
.print-sheet.announcer .print-skip {
  flex: 0 0 auto;
  font-size: 11px;
  margin: 0 0 1px;
}
.print-sheet.announcer .print-grade-title {
  flex: none;
  margin: 0 0 8px;
  font-size: 18px;
  padding-bottom: 4px;
  border-bottom-width: 2px;
}
.print-sheet.announcer .print-winner {
  flex: none;
  margin: 10px 0 0;
  padding: 8px 10px;
}
.print-sheet.announcer .print-winner p { margin-bottom: 4px; font-size: 11px; }
.print-sheet.announcer .print-winner .print-photo { width: 40px; height: 40px; }
.print-sheet.announcer .print-winner .print-club { width: 28px; height: 28px; }
.print-sheet.announcer .print-winner strong { font-size: 18px; }
.print-sheet.announcer .print-winner small { font-size: 12px; }
.print-sheet.runsheet .print-runsheet {
  list-style: none;
  margin: 0;
  padding: 0;
}
.print-sheet.runsheet .print-run-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 8px;
  align-items: start;
  break-inside: avoid;
  margin: 0 0 6px;
  padding: 4px 0 6px;
  border-bottom: 1px solid #ddd;
}
.print-sheet.runsheet .print-run-item > b {
  font-size: 14px;
  line-height: 1.2;
  color: #d60a0a;
}
.print-sheet.runsheet .print-run-item h3 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.print-sheet.runsheet .print-run-item p {
  margin: 1px 0 0;
  font-size: 11px;
  font-weight: 600;
  color: #333;
}
.print-sheet.runsheet .print-run-cue {
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #666;
}
.print-sheet.runsheet .runsheet-clubs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin: 4px 0 2px;
}
.print-sheet.runsheet .runsheet-clubs img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.print-sheet.runsheet .print-run-fixtures {
  list-style: none;
  margin: 3px 0 0;
  padding: 0;
}
.print-sheet.runsheet .print-run-fixtures li {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 2px;
  font-size: 11px;
}
.print-sheet.runsheet .print-run-fixtures em {
  min-width: 72px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #555;
}
.print-sheet.runsheet .print-run-fixtures .print-club {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.print-sheet.runsheet .runsheet-members {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
}
.print-sheet.runsheet .runsheet-members li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 3px;
}
.print-sheet.runsheet .runsheet-members strong { display: block; font-size: 12px; }
.print-sheet.runsheet .runsheet-members small {
  display: block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #333;
}
`;

export function printDocument(sheetHtml) {
  const html = sheetHtml || '';
  const announcer = /\bannouncer\b/.test(html) && !/\brunsheet\b/.test(html);
  const css = announcer
    ? PRINT_SHEET_CSS.replace('@page { size: A4; margin: 12mm; }', '@page { size: A4; margin: 5mm; }')
    : PRINT_SHEET_CSS;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>WFL Medal Count</title>
  <style>${css}</style>
</head>
<body>
${html}
</body>
</html>`;
}
