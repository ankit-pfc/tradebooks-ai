export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'text/xml',
  'application/xml',
  'application/octet-stream', // fallback — detection handles actual validation
]);
