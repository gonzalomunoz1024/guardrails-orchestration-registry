/**
 * blastRadiusReport.ts
 *
 * Turns a guardrail's blast-radius analysis into a polished, self-contained,
 * print-to-PDF HTML report — release evidence for how a guardrail behaves across
 * real test inputs. Styled to match the studio's Apple design language.
 */

export interface BlastReportTest {
  name: string;
  correlationId?: string | null;
  applicationId?: string | null;
  status: 'passed' | 'failed' | 'error' | 'pending' | 'running';
  executionTimeMs?: number | null;
  input: unknown;
  output: unknown;
  error?: string | null;
}

export interface BlastReportData {
  guardrail: { id: string; name: string; version: string; enforcementType: string };
  executedAt: string;
  configuration: unknown;
  summary: { total: number; passed: number; failed: number; errors: number; passRate: number };
  tests: BlastReportTest[];
}

function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str: string): string {
  return (
    String(str || 'guardrail')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'guardrail'
  );
}

function fmtDate(ts: string): string {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function asJson(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const REPORT_CSS = `
:root{--ok:#34c759;--bad:#ff3b30;--warn:#ff9500;--info:#007aff;--ink:#1d1d1f;--sub:#6e6e73;--line:rgba(0,0,0,.1);--bg:#f5f5f7}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;
 -webkit-font-smoothing:antialiased}
.wrap{max-width:880px;margin:0 auto;padding:40px 28px 72px}
.toolbar{max-width:880px;margin:0 auto;padding:16px 28px 0;text-align:right}
.toolbar button{font:inherit;font-size:13px;font-weight:600;color:#fff;background:var(--info);
 border:0;border-radius:980px;padding:9px 18px;cursor:pointer}
header{background:#fff;border-radius:18px;padding:32px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:24px;letter-spacing:-.4px;margin:0 0 10px}
.eyebrow{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--sub);margin:0 0 14px}
.pill{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.3px;padding:6px 16px;border-radius:980px;color:#fff}
.pill.ok{background:var(--ok)}.pill.bad{background:var(--bad)}
.meta{display:flex;flex-wrap:wrap;gap:6px 28px;margin-top:18px;font-size:13px;color:var(--sub)}
.meta b{color:var(--ink);font-weight:600}
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:20px 0}
.card{background:#fff;border-radius:14px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.card .n{font-size:22px;font-weight:700;letter-spacing:-.5px}
.card .l{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--sub);margin-top:4px}
.card.ok .n{color:var(--ok)}.card.bad .n{color:var(--bad)}.card.warn .n{color:var(--warn)}
section.block{background:#fff;border-radius:18px;padding:8px 0;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden}
.section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--sub);padding:18px 28px 6px}
.step{border-top:1px solid var(--line);padding:18px 28px}
.step:first-of-type{border-top:0}
.step-head{display:flex;align-items:center;gap:10px}
.step-idx{font-size:12px;font-weight:700;color:var(--sub);min-width:22px}
.step-name{font-size:15px;font-weight:600;flex:1}
.tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{font-size:11px;color:var(--sub);background:#f5f5f7;border-radius:980px;padding:2px 10px}
.dot{font-size:12px;font-weight:700;padding:3px 11px;border-radius:980px;color:#fff}
.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}.dot.warn{background:var(--warn)}
.dur{font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums}
.io h4{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--sub);margin:14px 0 6px}
pre{background:#1d1d1f;color:#e6e6eb;border-radius:10px;padding:12px 14px;margin:0;
 font:12px/1.5 "SF Mono",ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;max-height:340px;overflow:auto}
table.kv{width:100%;border-collapse:collapse;font-size:13px}
table.kv td{padding:8px 28px;border-top:1px solid var(--line);vertical-align:top}
table.kv td:first-child{color:var(--sub);width:34%;font-weight:600}
table.kv td code{font-family:"SF Mono",ui-monospace,Menlo,monospace}
footer{text-align:center;color:var(--sub);font-size:12px;margin-top:28px;line-height:1.7}
@media print{
 body{background:#fff}.toolbar{display:none}
 header,section.block,.card{box-shadow:none;border:1px solid var(--line)}
 .wrap{padding:0}pre{max-height:none}
 section.block,.step{break-inside:avoid}
}
`;

function statusClass(status: BlastReportTest['status']): 'ok' | 'bad' | 'warn' {
  if (status === 'passed') return 'ok';
  if (status === 'error') return 'warn';
  return 'bad';
}

function statusLabel(status: BlastReportTest['status']): string {
  if (status === 'passed') return 'ALLOWED';
  if (status === 'failed') return 'DENIED';
  if (status === 'error') return 'ERROR';
  return status.toUpperCase();
}

function testHTML(t: BlastReportTest, index: number): string {
  const tags = [t.correlationId, t.applicationId].filter(Boolean) as string[];
  const parts: string[] = [];
  parts.push(`<div class="step">
    <div class="step-head">
      <span class="step-idx">${index}</span>
      <span class="step-name">${esc(t.name)}</span>
      <span class="dot ${statusClass(t.status)}">${statusLabel(t.status)}</span>
      <span class="dur">${t.executionTimeMs != null ? Math.round(t.executionTimeMs) + 'ms' : ''}</span>
    </div>`);
  if (tags.length) {
    parts.push(`<div class="tags" style="margin-top:8px">${tags.map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>`);
  }
  parts.push('<div class="io">');
  parts.push('<h4>Input</h4>');
  parts.push(`<pre>${esc(asJson(t.input))}</pre>`);
  if (t.error) {
    parts.push('<h4>Error</h4>');
    parts.push(`<pre>${esc(t.error)}</pre>`);
  } else {
    parts.push('<h4>Decision output</h4>');
    parts.push(`<pre>${esc(asJson(t.output))}</pre>`);
  }
  parts.push('</div></div>');
  return parts.join('');
}

export function buildBlastRadiusReportHTML(data: BlastReportData): string {
  const { guardrail, summary } = data;
  const allPassed = summary.failed === 0 && summary.errors === 0 && summary.total > 0;

  const configBlock =
    data.configuration && Object.keys(data.configuration as object).length
      ? `<section class="block">
          <div class="section-title">Configuration</div>
          <pre style="margin:8px 28px 20px">${esc(asJson(data.configuration))}</pre>
        </section>`
      : '';

  const metaRows = [
    ['Guardrail', esc(guardrail.name)],
    ['ID', `<code>${esc(guardrail.id)}</code>`],
    ['Version', esc(guardrail.version)],
    ['Enforcement', esc(guardrail.enforcementType)],
    ['Executed at', esc(fmtDate(data.executedAt))],
  ];

  const body = `
  <header>
    <p class="eyebrow">Blast Radius Analysis</p>
    <h1>${esc(guardrail.name)}</h1>
    <span class="pill ${allPassed ? 'ok' : 'bad'}">${summary.passed} / ${summary.total} allowed · ${summary.passRate}% pass rate</span>
    <div class="meta">
      ${metaRows.map(([k, v]) => `<div>${k}: <b>${v}</b></div>`).join('')}
    </div>
  </header>

  <div class="cards">
    <div class="card"><div class="n">${summary.total}</div><div class="l">Test cases</div></div>
    <div class="card ok"><div class="n">${summary.passed}</div><div class="l">Allowed</div></div>
    <div class="card ${summary.failed ? 'bad' : ''}"><div class="n">${summary.failed}</div><div class="l">Denied</div></div>
    <div class="card ${summary.errors ? 'warn' : ''}"><div class="n">${summary.errors}</div><div class="l">Errors</div></div>
    <div class="card"><div class="n">${summary.passRate}<span style="font-size:13px">%</span></div><div class="l">Pass rate</div></div>
  </div>

  ${configBlock}

  <section class="block">
    <div class="section-title">Test cases — Inputs &amp; Decisions</div>
    ${data.tests.map((t, i) => testHTML(t, i + 1)).join('')}
  </section>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blast Radius — ${esc(guardrail.name)}</title>
<style>${REPORT_CSS}</style></head>
<body>
<div class="toolbar"><button onclick="window.print()">Save as PDF / Print</button></div>
<div class="wrap">
${body}
<footer>
  Generated by the OPA Guardrail Registry · ${esc(fmtDate(new Date().toISOString()))}<br>
  Automated record of guardrail blast-radius evaluation, intended as release evidence.
</footer>
</div></body></html>`;
}

export function downloadBlastRadiusReport(data: BlastReportData): void {
  const date = new Date(data.executedAt).toISOString().split('T')[0];
  downloadBlob(
    `blast-radius-${slugify(data.guardrail.id || data.guardrail.name)}-${date}.html`,
    buildBlastRadiusReportHTML(data),
    'text/html'
  );
}
