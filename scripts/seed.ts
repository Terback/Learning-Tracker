import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.attachment.deleteMany();
  await prisma.progressLog.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.tag.deleteMany();

  const goal = await prisma.goal.create({
    data: {
      title: "Embedded / Engineering Learning",
      description:
        "A long-term roadmap for embedded systems, electronics workflow, AI hardware, software apps, and hardware-connected products.",
      status: "ACTIVE",
      startDate: new Date("2026-08-01T12:00:00"),
      targetDate: new Date("2027-02-28T12:00:00"),
      tags: {
        connectOrCreate: [
          { where: { name: "ESP32" }, create: { name: "ESP32" } },
          { where: { name: "Hardware" }, create: { name: "Hardware" } },
          { where: { name: "AI" }, create: { name: "AI" } }
        ]
      }
    }
  });

  const milestones = [
    ["MQTT workflow", "COMPLETED", "HIGH"],
    ["PlatformIO fundamentals", "COMPLETED", "HIGH"],
    ["KiCad PCB fabrication workflow", "COMPLETED", "HIGH"],
    ["Oscilloscope usage and debugging", "IN_PROGRESS", "HIGH"],
    ["EIM CRM development", "IN_PROGRESS", "MEDIUM"],
    ["STM32", "TODO", "HIGH"],
    ["KC25 ESP32 book", "TODO", "MEDIUM"],
    ["Software app development", "TODO", "MEDIUM"],
    ["Hardware-connected app", "TODO", "HIGH"],
    ["OpenCV / MediaPipe / YOLO", "TODO", "HIGH"],
    ["Personal server", "TODO", "MEDIUM"],
    ["Motor drivers and PID control", "TODO", "HIGH"],
    ["Fusion 360 + KiCad PCB integration", "TODO", "MEDIUM"]
  ] as const;

  const createdMilestones = await Promise.all(
    milestones.map(([title, status, priority], order) =>
      prisma.milestone.create({
        data: {
          goalId: goal.id,
          title,
          description: `Learning track for ${title}.`,
          status,
          priority,
          order,
          targetDate: new Date(`2026-${String(Math.min(12, 8 + Math.floor(order / 2))).padStart(2, "0")}-25T12:00:00`)
        }
      })
    )
  );

  const mqtt = createdMilestones[0];
  await prisma.progressLog.create({
    data: {
      goalId: goal.id,
      milestoneId: mqtt.id,
      title: "MQTT Workflow Completed",
      date: new Date("2026-08-19T12:00:00"),
      content:
        "Used ESP32 with PlatformIO and connected it to a Mosquitto MQTT broker.\n\nInitially controlled it through the terminal, then moved to Node-RED Dashboard for a better web interface.\n\nUnderstood that ESP32, Terminal and Node-RED are all MQTT clients while the broker acts as the message exchange layer.\n\nLater connected the system to HiveMQ to experiment with cloud MQTT.",
      conceptsLearned: "Broker / Client architecture, topics, cloud MQTT",
      skillsDeveloped: "ESP32, PlatformIO, Mosquitto, Node-RED, HiveMQ",
      problems: "Understanding how local clients and cloud brokers fit together.",
      solutions: "Mapped each tool as either an MQTT client or broker and tested the message flow step by step.",
      nextStep: "Document a reusable ESP32 MQTT template.",
      tags: {
        connectOrCreate: [
          { where: { name: "MQTT" }, create: { name: "MQTT" } },
          { where: { name: "IoT" }, create: { name: "IoT" } }
        ]
      }
    }
  });

  await prisma.progressLog.create({
    data: {
      goalId: goal.id,
      milestoneId: createdMilestones[9].id,
      title: "First YOLO Detection Running",
      date: new Date("2026-08-18T12:00:00"),
      content: "Successfully ran YOLO detection locally and started comparing it with OpenCV masking workflows.",
      conceptsLearned: "Object detection, model inference",
      skillsDeveloped: "Python, YOLO, OpenCV",
      nextStep: "Capture screenshots and compare YOLO with MediaPipe for hardware-assisted demos.",
      tags: {
        connectOrCreate: [
          { where: { name: "Computer Vision" }, create: { name: "Computer Vision" } },
          { where: { name: "Python" }, create: { name: "Python" } }
        ]
      }
    }
  });

  await prisma.resource.createMany({
    data: [
      {
        goalId: goal.id,
        milestoneId: mqtt.id,
        title: "HiveMQ MQTT Essentials",
        url: "https://www.hivemq.com/mqtt/",
        type: "DOCUMENTATION",
        description: "Reference material for MQTT concepts and broker/client architecture."
      },
      {
        goalId: goal.id,
        milestoneId: createdMilestones[2].id,
        title: "KiCad Documentation",
        url: "https://docs.kicad.org/",
        type: "DOCUMENTATION",
        description: "PCB design and fabrication workflow reference."
      },
      {
        goalId: goal.id,
        milestoneId: createdMilestones[9].id,
        title: "OpenCV Documentation",
        url: "https://docs.opencv.org/",
        type: "DOCUMENTATION",
        description: "Image processing, masking, and computer vision reference."
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
