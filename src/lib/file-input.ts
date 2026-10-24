/**
 * Reading one file from a file input as base64.
 *
 * It lives here rather than inside a page because two pages upload documents now —
 * the intake form and "attach the document we asked for" — and a second copy of
 * this would be a second place to get wrong. It reads the browser's own File
 * object and nothing else: no size or type decision is made here, because that
 * decision belongs to the server (`src/server/uploads.server.ts`), which judges
 * the file by its bytes.
 */
export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : "");
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
