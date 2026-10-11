// Tiny CSV helpers for exporting tables (used by the audit log page).
//
// Two things matter here beyond "put commas between values":
//  1. Quoting — any cell containing a comma, quote or newline is wrapped
//     in double quotes, with inner quotes doubled (the CSV standard).
//  2. Formula injection — a cell that STARTS with = + - or @ is run as
//     a formula by Excel/Sheets when the file is opened. Audit entries
//     contain text people typed (names, reasons, notes), so a value
//     like =HYPERLINK("http://evil") could execute on an admin's
//     machine. We neutralise it by prefixing a single quote.
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')]
  rows.forEach((row) => lines.push(row.map(csvCell).join(',')))
  return lines.join('\r\n')
}

// Triggers a browser download of `text` as a file. A BOM is added so
// Excel reads accented/non-Latin characters correctly.
export function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
