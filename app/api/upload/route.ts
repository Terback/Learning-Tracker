import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/pdf",
  "text/markdown",
  "text/plain"
]);

export async function POST(request: Request) {
  const form = await request.formData();
  const progressLogId = String(form.get("progressLogId") ?? "");
  const files = form.getAll("files").filter((file): file is File => file instanceof File);

  if (!progressLogId || files.length === 0) {
    return NextResponse.json({ error: "Missing progress log or files." }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const attachments = [];
  for (const file of files) {
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: `${file.name} is not a supported file type.` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "-");
    const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, Buffer.from(bytes));

    attachments.push(
      await prisma.attachment.create({
        data: {
          progressLogId,
          fileName: file.name,
          fileUrl: `/uploads/${fileName}`,
          fileType: file.type || "application/octet-stream"
        }
      })
    );
  }

  return NextResponse.json({ attachments });
}
