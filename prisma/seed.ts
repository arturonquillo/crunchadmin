import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean slate for idempotent local seed
  await prisma.chatAttachment.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.pendienteAttachment.deleteMany();
  await prisma.menuPlatformSpec.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.recetaLinea.deleteMany();
  await prisma.recetaVersion.deleteMany();
  await prisma.pendiente.deleteMany();
  await prisma.receta.deleteMany();
  await prisma.insumo.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: "owner@crunchadmin.local",
      name: "Dueño",
    },
  });

  const insumos = await Promise.all(
    [
      { name: "Aceite vegetal", baseUnit: "g", purchaseNotes: "Bidón 20 L" },
      { name: "Yema de huevo", baseUnit: "g" },
      { name: "Mostaza", baseUnit: "g" },
      { name: "Vinagre blanco", baseUnit: "g" },
      { name: "Sal", baseUnit: "g" },
      { name: "Papa", baseUnit: "kg", purchaseNotes: "Mercado central" },
    ].map((d) => prisma.insumo.create({ data: d }))
  );

  const byName = Object.fromEntries(insumos.map((i) => [i.name, i]));

  const mayo = await prisma.receta.create({
    data: {
      name: "Mayonesa casa",
      notes: "Ficha técnica base — 1 kg. Usar el escalado para batches (ej. 1,8 kg).",
      yieldQty: 1,
      yieldUnit: "kg",
      yieldLabel: "mayonesa",
      userId: user.id,
    },
  });

  const v1 = await prisma.recetaVersion.create({
    data: {
      recetaId: mayo.id,
      number: 1,
      label: "v1 — ficha inicial",
      changelog: "Versión inicial para demo de escalado 1 kg → 1,8 kg",
      authorId: user.id,
      lines: {
        create: [
          {
            name: "Aceite",
            quantity: 700,
            unit: "g",
            sortOrder: 1,
            insumoId: byName["Aceite vegetal"].id,
          },
          {
            name: "Yema de huevo",
            quantity: 150,
            unit: "g",
            sortOrder: 2,
            insumoId: byName["Yema de huevo"].id,
          },
          {
            name: "Mostaza",
            quantity: 50,
            unit: "g",
            sortOrder: 3,
            insumoId: byName["Mostaza"].id,
          },
          {
            name: "Vinagre",
            quantity: 80,
            unit: "g",
            sortOrder: 4,
            insumoId: byName["Vinagre blanco"].id,
          },
          {
            name: "Sal",
            quantity: 20,
            unit: "g",
            sortOrder: 5,
            insumoId: byName["Sal"].id,
          },
          {
            name: "Pimienta",
            quantity: null,
            unit: null,
            isToTaste: true,
            canBeScaleBase: false,
            sortOrder: 6,
          },
        ],
      },
    },
  });

  await prisma.receta.update({
    where: { id: mayo.id },
    data: { currentVersionId: v1.id },
  });

  const papas = await prisma.receta.create({
    data: {
      name: "Papas fritas crunch",
      notes: "Porción de servicio",
      yieldQty: 4,
      yieldUnit: "ud",
      yieldLabel: "porciones",
      userId: user.id,
      versions: {
        create: {
          number: 1,
          label: "v1",
          changelog: "Receta corta de ejemplo",
          authorId: user.id,
          lines: {
            create: [
              {
                name: "Papa",
                quantity: 800,
                unit: "g",
                sortOrder: 1,
                insumoId: byName["Papa"].id,
              },
              { name: "Aceite para freír", quantity: 200, unit: "ml", sortOrder: 2 },
              { name: "Sal", quantity: 8, unit: "g", sortOrder: 3 },
            ],
          },
        },
      },
    },
    include: { versions: true },
  });

  await prisma.receta.update({
    where: { id: papas.id },
    data: { currentVersionId: papas.versions[0].id },
  });

  const menuMayo = await prisma.menuItem.create({
    data: {
      name: "Salsa mayonesa",
      description: "Mayonesa de la casa",
      recetaId: mayo.id,
      platformSpecs: {
        create: [
          {
            platform: "FOODIE",
            displayName: "Mayo casa",
            price: 25,
            available: true,
            channelNotes: "Porción 60 ml",
          },
          {
            platform: "TIENDA_PROPIA",
            displayName: "Mayonesa casa",
            price: 20,
            available: true,
            channelNotes: "Incluida con combos",
          },
        ],
      },
    },
  });

  await prisma.menuItem.create({
    data: {
      name: "Papas crunch",
      description: "Porción clásica",
      recetaId: papas.id,
      platformSpecs: {
        create: [
          {
            platform: "FOODIE",
            displayName: "Papas Crunch",
            price: 55,
            available: true,
          },
          {
            platform: "TIENDA_PROPIA",
            displayName: "Papas fritas",
            price: 45,
            available: true,
          },
        ],
      },
    },
  });

  await prisma.pendiente.createMany({
    data: [
      {
        title: "Reparar puerta de cámara fría",
        description: "Sello inferior gastado",
        categoria: "MEJORAS_FISICAS",
        estado: "PENDIENTE",
        prioridad: "ALTA",
        userId: user.id,
      },
      {
        title: "Comprar batidora industrial",
        categoria: "COMPRAS",
        estado: "EN_CURSO",
        prioridad: "MEDIA",
        userId: user.id,
      },
      {
        title: "Plan terraza verano",
        description: "Layout y mobiliario",
        categoria: "PLANES_FUTUROS",
        estado: "PENDIENTE",
        prioridad: "BAJA",
        userId: user.id,
      },
      {
        title: "Reponer aceite vegetal",
        categoria: "INSUMOS",
        estado: "PENDIENTE",
        prioridad: "CRITICA",
        insumoId: byName["Aceite vegetal"].id,
        userId: user.id,
      },
      {
        title: "Desarrollar aioli ahumado",
        categoria: "NUEVAS_RECETAS",
        estado: "PENDIENTE",
        prioridad: "MEDIA",
        recetaId: mayo.id,
        userId: user.id,
      },
    ],
  });

  await prisma.reminder.create({
    data: {
      title: "Aceite crítico",
      body: "Reponer aceite vegetal esta semana",
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      userId: user.id,
    },
  });

  await prisma.chatThread.create({
    data: {
      title: "Operación diaria",
      userId: user.id,
      messages: {
        create: [
          {
            role: "SYSTEM",
            content:
              "Eres el asistente de Crunchadmin. Ayudas con pendientes, recetas (escalado) y menú. Responde en español.",
          },
        ],
      },
    },
  });

  console.log("Seed OK");
  console.log("  Receta demo:", mayo.name, "→ escala 1 kg a 1,8 kg");
  console.log("  Menú item:", menuMayo.name);
  console.log("  User:", user.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
