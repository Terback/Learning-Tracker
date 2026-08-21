export const ATTACHMENTS_BUCKET = "attachments";
export const SIGNED_URL_EXPIRES_IN = 60 * 60; // 1 hour

export function buildAttachmentPath(userId: string, progressLogId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return `${userId}/${progressLogId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
}
