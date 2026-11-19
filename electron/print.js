const PRINT_SHEET_CSS = `
@page { size: A4; margin: 12mm; }
@page announcer { size: A4; margin: 5mm; }
@page umpire-slips { size: A4; margin: 0; }
@page umpire-pay { size: A4; margin: 6mm; }
.print-sheet.announcer { page: announcer; }
.print-sheet.umpire-slips-print,
.print-sheet.umpire-envelopes-print { page: umpire-slips; }
.print-sheet.umpire-pay-print { page: umpire-pay; }
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
  flex: 0 0 auto;
  gap: 8px;
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom-width: 2px;
}
.print-sheet.announcer .print-head img { height: 42px; }
.print-sheet.announcer .print-head p { font-size: 10px; }
.print-sheet.announcer .print-head h1 { margin-top: 1px; font-size: 20px; }
.print-sheet.announcer .print-head h2 { margin-top: 1px; font-size: 13px; }
.print-sheet.announcer .print-foot { flex: 0 0 auto; margin-top: 4px; font-size: 10px; }
.print-sheet.announcer .print-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 270mm;
  overflow: hidden;
  break-after: page;
  page-break-after: always;
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
  font-size: 15px;
  padding-bottom: 2px;
  border-bottom-width: 2px;
}
.print-sheet.announcer .print-match {
  flex: 0 0 auto;
  margin: 2px 0 0;
  padding-top: 2px;
  border-top: 1px solid #ddd;
  gap: 6px;
}
.print-sheet.announcer .print-match strong { font-size: 14px; line-height: 1.1; }
.print-sheet.announcer .print-match span { font-size: 12px; }
.print-sheet.announcer .print-game li {
  box-sizing: border-box;
  flex: 1 1 0;
  min-height: 0;
  height: auto;
  overflow: hidden;
  grid-template-columns: 20px 22px 1fr;
  gap: 0 6px;
  padding: 0.2mm 0;
  align-items: center;
}
.print-sheet.announcer .print-game li b {
  font-size: 20px;
  line-height: 1;
}
.print-sheet.announcer .print-game .print-club {
  width: 22px;
  height: 22px;
}
.print-sheet.announcer .print-game li span {
  font-size: 16px;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.print-sheet.announcer .print-game li small {
  margin-left: 6px;
  font-size: 11px;
}
.print-sheet.announcer .print-skip {
  flex: 0 0 auto;
  font-size: 13px;
  margin: 0 0 1px;
}
.print-sheet.announcer .print-grade-title {
  flex: none;
  margin: 0 0 8px;
  font-size: 20px;
  padding-bottom: 4px;
  border-bottom-width: 2px;
}
.print-cues {
  break-before: page;
  padding-top: 4px;
}
.print-cue-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.print-cue-list li {
  margin: 0 0 14px;
  padding: 0 0 10px;
  border-bottom: 1px solid #ddd;
}
.print-cue-list h3 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.print-cue-list p {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 600;
}
.print-sheet.announcer .print-cues .print-run-cue {
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #666;
  font-size: 14px;
}
.print-sheet.announcer .print-winner {
  flex: none;
  margin: 6px 0 0;
  padding: 8px 10px;
}
.print-sheet.announcer .print-winner p { margin-bottom: 4px; font-size: 13px; }
.print-sheet.announcer .print-winner .print-photo { width: 48px; height: 48px; }
.print-sheet.announcer .print-winner .print-club { width: 34px; height: 34px; }
.print-sheet.announcer .print-winner strong { font-size: 22px; }
.print-sheet.announcer .print-winner small { font-size: 13px; }
.umpire-slip-page {
  box-sizing: border-box;
  height: 270mm;
  max-height: 270mm;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
}
.umpire-slip-page.is-break {
  break-before: page;
  page-break-before: always;
}
.umpire-slip {
  box-sizing: border-box;
  flex: 1 1 33.333%;
  height: 90mm;
  max-height: 90mm;
  min-height: 0;
  padding: 3.5mm 6mm 3mm;
  color: #111;
  background: #fff;
  font-family: "Segoe UI", sans-serif;
  display: flex;
  flex-direction: column;
  gap: 2mm;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
  border-bottom: 1px dashed #999;
}
.print-sheet.umpire-slips-print .umpire-slip:last-child {
  border-bottom: 0;
}
.umpire-slip-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 2mm;
  border-bottom: 2px solid #d60a0a;
}
.umpire-slip-brand img {
  height: 9mm;
  width: auto;
  object-fit: contain;
}
.umpire-slip-brand p {
  margin: 0;
  font-size: 7.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
}
.umpire-slip-brand h1 {
  margin: 1px 0 0;
  font-size: 12px;
  line-height: 1.1;
}
.umpire-slip-brand h2 {
  margin: 1px 0 0;
  font-size: 10px;
  font-weight: 700;
  color: #333;
}
.umpire-slip-meta-line {
  display: grid;
  grid-template-columns:
    minmax(20mm, 0.7fr)
    minmax(20mm, 0.7fr)
    minmax(28mm, 0.95fr)
    minmax(24mm, 0.95fr)
    minmax(0, 1.4fr);
  gap: 2mm;
  align-items: end;
  padding: 1mm 0 1.5mm;
  border-bottom: 1px solid #ddd;
}
.umpire-slip-meta-line > span {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.umpire-slip-meta-line small {
  font-size: 7.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #666;
}
.umpire-slip-meta-line b {
  display: block;
  min-height: 5mm;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.15;
  border-bottom: 1px solid #bbb;
  padding-bottom: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.umpire-slip-meta-teams {
  display: flex !important;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}
.umpire-slip-meta-teams em {
  font-style: normal;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #888;
  font-weight: 700;
}
.umpire-slip-meta-teams .umpire-fill {
  flex: 1;
  min-width: 18mm;
}
.umpire-slip-votes {
  width: 100%;
  border-collapse: collapse;
  flex: 1;
}
.umpire-slip-votes th {
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #666;
  text-align: left;
  padding: 0 2mm 1.2mm 0;
  border-bottom: 1.5px solid #111;
}
.umpire-slip-votes td {
  padding: 1.8mm 2mm 1.8mm 0;
  border-bottom: 1px solid #ddd;
  vertical-align: middle;
}
.umpire-slip-votes .pts { width: 9mm; text-align: center; padding-right: 0; }
.umpire-slip-votes .pts b {
  display: grid;
  place-items: center;
  width: 6.5mm;
  height: 6.5mm;
  border-radius: 50%;
  background: #d60a0a;
  color: #fff;
  font-size: 11px;
}
.umpire-slip-votes .num { width: 14mm; }
.umpire-fill {
  display: block;
  width: 100%;
  height: 4mm;
  border-bottom: 1px solid #999;
}
.umpire-fill.short { width: 11mm; }
.umpire-slip-sign {
  margin-top: auto;
  flex-shrink: 0;
}
.umpire-slip-sign-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 3mm 1.2mm;
  table-layout: fixed;
}
.umpire-slip-sign-table th,
.umpire-slip-sign-table td {
  width: 33.33%;
  vertical-align: bottom;
  text-align: left;
  border: 0 !important;
  border-bottom: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  font-size: inherit;
  letter-spacing: normal;
  text-transform: none;
  color: inherit;
}
.umpire-slip-sign-table th {
  text-align: center !important;
  font-size: 10px !important;
  font-weight: 800 !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  color: #d60a0a !important;
  padding-bottom: 0.6mm !important;
}
.umpire-slip-sign-table small {
  display: block;
  margin-bottom: 0.4mm;
  font-size: 7px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #666;
  font-weight: 600;
}
.umpire-slip-sign-table .umpire-fill {
  display: block;
  width: 100%;
}
.umpire-slip-votes th,
.umpire-slip-votes td {
  padding: 1.8mm 2mm 1.8mm 0 !important;
  font-size: inherit;
  letter-spacing: normal;
  text-transform: none;
  color: inherit;
}
.umpire-slip-votes th {
  font-size: 8px !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
  color: #666 !important;
  border-bottom: 1.5px solid #111 !important;
}
/* 4-3-2-1 needs one extra vote row — tighten so signatures stay on the slip. */
.umpire-slip.is-women-scale {
  gap: 1.4mm;
  padding: 3mm 5.5mm 2.5mm;
}
.umpire-slip.is-women-scale .umpire-slip-brand {
  padding-bottom: 1.2mm;
}
.umpire-slip.is-women-scale .umpire-slip-brand img {
  height: 7.5mm;
}
.umpire-slip.is-women-scale .umpire-slip-meta-line {
  padding: 0.5mm 0 0.8mm;
}
.umpire-slip.is-women-scale .umpire-slip-meta-line b {
  min-height: 4mm;
  font-size: 10.5px;
}
.umpire-slip.is-women-scale .umpire-slip-votes td {
  padding: 1mm 2mm 1mm 0 !important;
}
.umpire-slip.is-women-scale .umpire-slip-votes .pts b {
  width: 5.5mm;
  height: 5.5mm;
  font-size: 9.5px;
}
.umpire-slip.is-women-scale .umpire-fill {
  height: 3.1mm;
}
.umpire-slip.is-women-scale .umpire-slip-sign-table {
  border-spacing: 2.2mm 0.7mm;
}
.umpire-envelope {
  box-sizing: border-box;
  height: 99mm;
  padding: 6mm 8mm 5mm;
  color: #111;
  background: #fff;
  font-family: "Segoe UI", sans-serif;
  display: flex;
  flex-direction: column;
  gap: 4mm;
  overflow: hidden;
  break-inside: avoid;
  page-break-inside: avoid;
  border-bottom: 1px dashed #999;
}
.print-sheet.umpire-envelopes-print .umpire-envelope:nth-child(3n) {
  border-bottom: 0;
  break-after: page;
  page-break-after: always;
}
.print-sheet.umpire-envelopes-print .umpire-envelope:last-child {
  border-bottom: 0;
  break-after: auto;
  page-break-after: auto;
}
.umpire-envelope-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 2.5mm;
  border-bottom: 2.5px solid #d60a0a;
}
.umpire-envelope-brand img {
  height: 12mm;
  width: auto;
  object-fit: contain;
}
.umpire-envelope-brand p {
  margin: 0;
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #555;
}
.umpire-envelope-brand h1 {
  margin: 1px 0 0;
  font-size: 16px;
  line-height: 1.05;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.umpire-envelope-brand h2 {
  margin: 2px 0 0;
  font-size: 11px;
  font-weight: 700;
  color: #333;
}
.umpire-envelope-hero {
  display: grid;
  gap: 2mm;
  justify-items: center;
  text-align: center;
  padding: 3mm 0 2mm;
  flex: 1;
  align-content: center;
}
.umpire-envelope-round {
  margin: 0;
  font-size: 14px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #d60a0a;
  line-height: 1.2;
  min-height: 5mm;
}
.umpire-envelope-round .umpire-fill {
  width: 40mm;
  margin: 0 auto;
}
.umpire-envelope-match {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  text-align: center;
  width: 100%;
}
.umpire-envelope-match strong {
  font-size: 36px;
  font-weight: 800;
  line-height: 1.02;
}
.umpire-envelope-match em {
  font-style: normal;
  font-size: 16px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #888;
  font-weight: 700;
}
.umpire-envelope-match .umpire-fill {
  width: 58mm;
  height: 9mm;
}
.umpire-envelope-grade {
  margin: 0;
  font-size: 22px;
  font-weight: 750;
  line-height: 1.15;
  letter-spacing: 0.02em;
  min-height: 7mm;
  max-width: 100%;
}
.umpire-envelope-grade .umpire-fill {
  width: 50mm;
  margin: 0 auto;
}
.umpire-envelope-meta-line {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 4mm;
  align-items: end;
  padding-top: 2mm;
  border-top: 1px solid #ddd;
}
.umpire-envelope-meta-line > span {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.umpire-envelope-meta-line small {
  font-size: 7.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #666;
}
.umpire-envelope-meta-line b {
  display: block;
  min-height: 5.5mm;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.15;
  border-bottom: 1px solid #bbb;
  padding-bottom: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.umpire-envelope-foot {
  margin: 2mm 0 0;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #666;
  text-align: center;
}
.umpire-pay-sheet {
  color: #111;
  font-family: "Segoe UI", sans-serif;
}
.umpire-pay-day {
  box-sizing: border-box;
  /* One fixture = one page. Keep League on this page with the other grades. */
  height: 285mm;
  max-height: 285mm;
  display: flex;
  flex-direction: column;
  page-break-inside: avoid;
  break-inside: avoid;
}
.umpire-pay-day.is-break {
  break-before: page;
  page-break-before: always;
}
/*
 * Same-day Women sheets: lock each match to a quarter-page (Round 8 / 4-game size)
 * so 2-game days don't blow up, and 4-game days fill the sheet evenly.
 */
.umpire-pay-day.is-by-day .umpire-pay-grade-block {
  height: 66mm;
}
.umpire-pay-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  margin-bottom: 6px;
  padding-bottom: 5px;
  border-bottom: 2px solid #d60a0a;
}
.umpire-pay-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.umpire-pay-head img {
  height: 36px;
  width: auto;
  object-fit: contain;
}
.umpire-pay-brand p,
.umpire-pay-match p {
  margin: 0;
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
}
.umpire-pay-brand h1 {
  margin: 1px 0 0;
  font-size: 17px;
  line-height: 1.1;
}
.umpire-pay-match {
  text-align: right;
  max-width: 48%;
}
.umpire-pay-match strong {
  display: block;
  margin-top: 1px;
  font-size: 13px;
  line-height: 1.15;
}
.umpire-pay-match strong.umpire-pay-match-blank {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 6px;
  min-width: 160px;
}
.umpire-pay-match strong.umpire-pay-match-blank .umpire-fill {
  flex: 1;
  min-width: 48px;
  min-height: 14px;
  height: 14px;
}
.umpire-pay-match strong em {
  font-style: normal;
  color: #888;
  margin: 0 5px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.umpire-pay-match span {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: #444;
  font-weight: 600;
}
.umpire-pay-match-meta-blank {
  display: grid !important;
  grid-template-columns: 0.9fr 0.9fr 1.2fr;
  gap: 8px;
  margin-top: 4px !important;
  min-width: 200px;
}
.umpire-pay-match-meta-blank .umpire-fill {
  min-height: 12px;
  height: 12px;
}
.umpire-pay-table {
  width: 100%;
  flex: 1 1 auto;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 10.5px;
  line-height: 1.1;
}
.umpire-pay-table thead {
  display: table-header-group;
}
.umpire-pay-table thead th {
  padding: 3px 5px;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #555;
  text-align: left;
  border-bottom: 2px solid #111;
  vertical-align: middle;
  background: #fff;
}
.umpire-pay-grade-block {
  /* Never kick a whole grade (League) onto the next page. */
  break-inside: auto;
  page-break-inside: auto;
}
.umpire-pay-grade-row th {
  padding: 1px 5px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: left;
  color: #111;
  background: #efefef;
  border-top: 1px solid #ccc;
  border-bottom: 1px solid #111;
  line-height: 1.15;
  height: 0;
}
.umpire-pay-table thead th {
  height: 0;
}
.umpire-pay-table td {
  padding: 1px 5px 2px;
  border-bottom: 1px solid #ddd;
  text-align: left;
  vertical-align: bottom;
  height: 1%;
}
.umpire-pay-table .role {
  width: 22%;
  font-weight: 700;
  white-space: nowrap;
  vertical-align: middle;
}
.umpire-pay-table .pay {
  width: 18%;
  white-space: nowrap;
  font-size: 9.5px;
  vertical-align: middle;
}
.umpire-pay-table .pay b { font-weight: 700; }
.umpire-pay-table .umpire-fill {
  display: block;
  width: 100%;
  min-height: 18px;
  height: 100%;
  border-bottom: 1.5px solid #777;
}
.umpire-pay-table .umpire-fill.short {
  width: 70%;
  min-width: 36px;
  height: 18px;
}
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
  const umpirePay = /\bumpire-pay-print\b/.test(html);
  const umpire =
    !umpirePay && (/\bumpire-slips-print\b/.test(html) || /\bumpire-envelopes-print\b/.test(html));
  const announcer = !umpire && !umpirePay && /\bannouncer\b/.test(html) && !/\brunsheet\b/.test(html);
  let css = PRINT_SHEET_CSS;
  if (announcer) {
    css = css.replace('@page { size: A4; margin: 12mm; }', '@page { size: A4; margin: 5mm; }');
  } else if (umpire) {
    css = css.replace('@page { size: A4; margin: 12mm; }', '@page { size: A4; margin: 0; }');
  } else if (umpirePay) {
    css = css.replace('@page { size: A4; margin: 12mm; }', '@page { size: A4; margin: 6mm; }');
  }
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
