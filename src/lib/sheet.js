function escXml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escCsv(v) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(escCsv).join(";")];
  for (const row of rows) lines.push(row.map(escCsv).join(";"));
  return `\uFEFF${lines.join("\r\n")}`;
}

export function toExcelXml(sheetName, headers, rows) {
  const name = String(sheetName || "Sayfa").slice(0, 31);
  const head = headers
    .map((h) => `<Cell><Data ss:Type="String">${escXml(h)}</Data></Cell>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<Row>${row
          .map((c) => `<Cell><Data ss:Type="String">${escXml(c)}</Data></Cell>`)
          .join("")}</Row>`
    )
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escXml(name)}">
  <Table>
   <Row>${head}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

function splitLine(line, sep) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseCsv(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const sep = (lines[0].split(";").length >= lines[0].split(",").length) ? ";" : ",";
  const headers = splitLine(lines[0], sep).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line, sep);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  });
  return { headers, rows };
}

export function parseExcelXml(text) {
  const xml = String(text || "");
  if (!xml.includes("<Workbook") && !xml.includes("<Worksheet")) return null;
  const rowMatches = [...xml.matchAll(/<Row\b[^>]*>([\s\S]*?)<\/Row>/gi)];
  if (!rowMatches.length) return { headers: [], rows: [] };
  const cellsOf = (block) =>
    [...block.matchAll(/<Data\b[^>]*>([\s\S]*?)<\/Data>/gi)].map((m) =>
      m[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim()
    );
  const headers = cellsOf(rowMatches[0][1]);
  const rows = rowMatches.slice(1).map((r) => {
    const cells = cellsOf(r[1]);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  });
  return { headers, rows };
}

export function parseSheet(text) {
  const xml = parseExcelXml(text);
  if (xml && xml.headers.length) return xml;
  return parseCsv(text);
}
