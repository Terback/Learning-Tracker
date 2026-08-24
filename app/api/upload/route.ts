import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedSupabase } from "@/lib/supabase/server";
import { ATTACHMENTS_BUCKET, buildAttachmentPath } from "@/lib/storage";

const allowedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/pdf",
  "text/markdown",
  "text/plain"
]);

export async function POST(request: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const progressLogId = String(form.get("progressLogId") ?? "");
  const files = form.getAll("files").filter((file): file is File => file instanceof File);

  if (!progressLogId || files.length === 0) {
    return NextResponse.json({ error: "Missing progress log or files." }, { status: 400 });
  }

  const owned = await prisma.progressLog.findFirst({
    where: { id: progressLogId, goal: { userId: user.id } },
    select: { id: true }
  });
  if (!owned) {
    return NextResponse.json({ error: "Progress update not found." }, { status: 404 });
  }

  const attachments = [];
  const errors: { fileName: string; error: string }[] = [];
  for (const file of files) {
    if (!allowedTypes.has(file.type)) {
      errors.push({ fileName: file.name, error: `${file.name} is not a supported file type.` });
      continue;
    }

    const objectPath = buildAttachmentPath(user.id, progressLogId, file.name);
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(objectPath, Buffer.from(bytes), { contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      errors.push({ fileName: file.name, error: `Failed to upload ${file.name}: ${uploadError.message}` });
      continue;
    }

    attachments.push(
      await prisma.attachment.create({
        data: {
          progressLogId,
          fileName: file.name,
          filePath: objectPath,
          fileType: file.type || "application/octet-stream"
        }
      })
    );
  }

  return NextResponse.json({ attachments, errors });
}
