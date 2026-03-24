import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

type ReportColumn = { key: string; label: string };
type ReportRow = Record<string, any>;

const escapeHtml = (value: any): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export async function exportStyledPdfReport(params: {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  filename?: string;
}) {
  const { title, subtitle, generatedAt, columns, rows } = params;
  const timeStamp = generatedAt || new Date().toLocaleString();

  const headerCols = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const bodyRows = rows
    .map((row) => {
      const tds = columns.map((c) => `<td>${escapeHtml(row[c.key])}</td>`).join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #1f2937; }
          .top { border: 1px solid #d1d5db; border-left: 6px solid #4f46e5; padding: 12px; margin-bottom: 16px; }
          .title { font-size: 24px; font-weight: 700; color: #4f46e5; margin: 0 0 4px 0; }
          .sub { color: #6b7280; font-size: 12px; margin: 0; }
          .section { font-size: 18px; color: #4338ca; margin: 16px 0 10px 0; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #4f46e5; color: #fff; padding: 8px; text-align: left; border: 1px solid #d1d5db; }
          td { padding: 8px; border: 1px solid #e5e7eb; }
          tr:nth-child(even) td { background: #f9fafb; }
          .footer { margin-top: 18px; font-size: 10px; color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <div class="top">
          <p class="title">${escapeHtml(title)}</p>
          <p class="sub">${escapeHtml(subtitle || '')}</p>
        </div>
        <div class="section">Report Details</div>
        <table>
          <thead><tr>${headerCols}</tr></thead>
          <tbody>${bodyRows || `<tr><td colspan="${columns.length}">No records</td></tr>`}</tbody>
        </table>
        <div class="footer">Report Generated: ${escapeHtml(timeStamp)}</div>
      </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
    return;
  }

  const file = await Print.printToFileAsync({ html });
  const safeTitle = (params.filename || title || 'report').replace(/[^a-z0-9-_]/gi, '_');
  const stampedName = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
  const fs: any = FileSystem as any;
  if (Platform.OS === 'android') {
    const permissions = await fs.StorageAccessFramework?.requestDirectoryPermissionsAsync?.();
    if (permissions.granted) {
      const base64 = await fs.readAsStringAsync(file.uri, { encoding: fs.EncodingType?.Base64 ?? 'base64' });
      const targetUri = await fs.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        stampedName,
        'application/pdf'
      );
      await fs.writeAsStringAsync(targetUri, base64, { encoding: fs.EncodingType?.Base64 ?? 'base64' });
      return targetUri;
    }
  }

  const baseDir = fs.documentDirectory || fs.cacheDirectory || '';
  const targetUri = `${baseDir}${stampedName}`;
  await fs.copyAsync({ from: file.uri, to: targetUri });
  return targetUri;
}
