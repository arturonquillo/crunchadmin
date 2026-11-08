import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean slate for idempotent local seed
  await prisma.chatAttachment.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.pendienteAttachment.deleteMany();
  await prisma.produccionLinea.deleteMany();
  await prisma.produccion.deleteMany();
  await prisma.inventoryMovement.deleteMany();
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
      {
        name: "Aceite vegetal",
        category: "ACEITES",
        baseUnit: "L",
        quantityOnHand: 12,
        packSize: 20,
        minQty: 4,
        reorderHint: "Pedir 1 bidón de 20 L al bajar de 20%",
        purchaseNotes: "Bidón 20 L",
        fifoNote: "Rotar bidones: abrir el más antiguo primero",
      },
      {
        name: "Yema de huevo",
        category: "LACTEOS",
        baseUnit: "kg",
        quantityOnHand: 2.5,
        packSize: 5,
        minQty: 0.5,
        reorderHint: "Bandeja 5 kg",
        fifoNote: "Cámara: etiqueta fecha; usar primero lo más viejo",
      },
      {
        name: "Mostaza",
        category: "SECOS",
        baseUnit: "kg",
        quantityOnHand: 1.2,
        packSize: 2,
        minQty: 0.3,
        reorderHint: "Balde 2 kg",
      },
      {
        name: "Vinagre blanco",
        category: "SECOS",
        baseUnit: "L",
        quantityOnHand: 3,
        packSize: 5,
        minQty: 1,
        reorderHint: "Garrafa 5 L",
      },
      {
        name: "Sal",
        category: "SECOS",
        baseUnit: "kg",
        quantityOnHand: 5,
        packSize: 25,
        minQty: 1,
        reorderHint: "Saco 25 kg",
      },
      {
        name: "Papa",
        category: "FRESCOS",
        baseUnit: "kg",
        quantityOnHand: 25,
        packSize: 25,
        minQty: 8,
        purchaseNotes: "Mercado central",
        reorderHint: "Saco 25 kg",
        fifoNote: "Sacos nuevos detrás; usar los de adelante",
      },
      {
        name: "Frango",
        category: "CARNES",
        baseUnit: "kg",
        quantityOnHand: 18,
        packSize: 10,
        minQty: 5,
        reorderHint: "Caja 10 kg — reponer al llegar a 5 kg",
        fifoNote: "FIFO en cámara: fecha de recepción visible",
      },
      {
        name: "Ajo",
        category: "FRESCOS",
        baseUnit: "kg",
        quantityOnHand: 1.5,
        packSize: 5,
        minQty: 0.4,
        reorderHint: "Malla 5 kg",
      },
      {
        name: "Limón",
        category: "FRESCOS",
        baseUnit: "kg",
        quantityOnHand: 2,
        packSize: 10,
        minQty: 0.5,
        reorderHint: "Cajón 10 kg",
      },
      {
        name: "Pimentón",
        category: "ESPECIAS",
        baseUnit: "kg",
        quantityOnHand: 0.4,
        packSize: 1,
        minQty: 0.1,
        reorderHint: "Frasco 1 kg",
      },
      {
        name: "Extracto de vainilla",
        category: "ESPECIAS",
        baseUnit: "kg",
        quantityOnHand: 18,
        packSize: 25,
        minQty: 5,
        reorderHint: "Pack de compra 25 kg = 100% · reponer bajo 20%",
        purchaseNotes: "Envase industrial 25 kg",
        fifoNote: "Mantener cerrado; anotar lote al abrir",
      },
      {
        name: "Manteca",
        category: "LACTEOS",
        baseUnit: "kg",
        quantityOnHand: 3,
        packSize: 5,
        minQty: 1,
        reorderHint: "Caja 5 kg",
        fifoNote: "FIFO en cámara fría",
      },
    ].map((d) => prisma.insumo.create({ data: d }))
  );

  const byName = Object.fromEntries(insumos.map((i) => [i.name, i]));

  for (const item of insumos) {
    if (item.quantityOnHand > 0) {
      await prisma.inventoryMovement.create({
        data: {
          insumoId: item.id,
          kind: "AJUSTE",
          delta: item.quantityOnHand,
          note: "Stock inicial seed",
        },
      });
    }
  }

  const mayo = await prisma.receta.create({
    data: {
      name: "Mayonesa casa",
      notes: "Ficha técnica base — 1 kg. Usar el escalado / producción para batches.",
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
            quantity: 0.7,
            unit: "L",
            sortOrder: 1,
            insumoId: byName["Aceite vegetal"].id,
          },
          {
            name: "Yema de huevo",
            quantity: 0.15,
            unit: "kg",
            sortOrder: 2,
            insumoId: byName["Yema de huevo"].id,
          },
          {
            name: "Mostaza",
            quantity: 0.05,
            unit: "kg",
            sortOrder: 3,
            insumoId: byName["Mostaza"].id,
          },
          {
            name: "Vinagre",
            quantity: 0.08,
            unit: "L",
            sortOrder: 4,
            insumoId: byName["Vinagre blanco"].id,
          },
          {
            name: "Sal",
            quantity: 0.02,
            unit: "kg",
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

  const marinado = await prisma.receta.create({
    data: {
      name: "Marinado de frango",
      notes: "Ficha maestra 1 kg de frango marinado. Producir p.ej. 5 kg desde Producción.",
      yieldQty: 1,
      yieldUnit: "kg",
      yieldLabel: "frango marinado",
      userId: user.id,
    },
  });

  const marinadoV1 = await prisma.recetaVersion.create({
    data: {
      recetaId: marinado.id,
      number: 1,
      label: "v1",
      changelog: "Ficha demo producción 1 kg → 5 kg",
      authorId: user.id,
      lines: {
        create: [
          {
            name: "Frango",
            quantity: 1,
            unit: "kg",
            sortOrder: 1,
            insumoId: byName["Frango"].id,
          },
          {
            name: "Aceite",
            quantity: 0.04,
            unit: "L",
            sortOrder: 2,
            insumoId: byName["Aceite vegetal"].id,
          },
          {
            name: "Ajo",
            quantity: 0.02,
            unit: "kg",
            sortOrder: 3,
            insumoId: byName["Ajo"].id,
          },
          {
            name: "Limón",
            quantity: 0.03,
            unit: "kg",
            sortOrder: 4,
            insumoId: byName["Limón"].id,
          },
          {
            name: "Pimentón",
            quantity: 0.01,
            unit: "kg",
            sortOrder: 5,
            insumoId: byName["Pimentón"].id,
          },
          {
            name: "Sal",
            quantity: 0.015,
            unit: "kg",
            sortOrder: 6,
            insumoId: byName["Sal"].id,
          },
        ],
      },
    },
  });

  await prisma.receta.update({
    where: { id: marinado.id },
    data: { currentVersionId: marinadoV1.id },
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
                quantity: 0.8,
                unit: "kg",
                sortOrder: 1,
                insumoId: byName["Papa"].id,
              },
              {
                name: "Aceite para freír",
                quantity: 0.2,
                unit: "L",
                sortOrder: 2,
                insumoId: byName["Aceite vegetal"].id,
              },
              {
                name: "Sal",
                quantity: 0.008,
                unit: "kg",
                sortOrder: 3,
                insumoId: byName["Sal"].id,
              },
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
        title: "Pintar la pared de entrada de rojo",
        description: "Fachada / muro de acceso — marcar y pintar tono rojo casa",
        categoria: "MEJORAS_FISICAS",
        estado: "PENDIENTE",
        prioridad: "ALTA",
        zone: "pared_entrada",
        userId: user.id,
      },
      {
        title: "Reparar puerta de cámara fría",
        description: "Sello inferior gastado",
        categoria: "MEJORAS_FISICAS",
        estado: "PENDIENTE",
        prioridad: "ALTA",
        zone: "cocina",
        userId: user.id,
      },
      {
        title: "Comprar batidora industrial",
        categoria: "COMPRAS",
        estado: "EN_CURSO",
        prioridad: "MEDIA",
        zone: "oficina",
        userId: user.id,
      },
      {
        title: "Plan terraza verano",
        description: "Layout y mobiliario",
        categoria: "PLANES_FUTUROS",
        estado: "PENDIENTE",
        prioridad: "BAJA",
        zone: "exterior",
        userId: user.id,
      },
      {
        title: "Reponer aceite vegetal",
        categoria: "INSUMOS",
        estado: "PENDIENTE",
        prioridad: "CRITICA",
        zone: "cocina",
        insumoId: byName["Aceite vegetal"].id,
        userId: user.id,
      },
      {
        title: "Desarrollar aioli ahumado",
        categoria: "NUEVAS_RECETAS",
        estado: "PENDIENTE",
        prioridad: "MEDIA",
        zone: "oficina",
        recetaId: mayo.id,
        userId: user.id,
      },
      {
        title: "Cambiar luz de la barra",
        description: "Foco quemado sobre coctelería",
        categoria: "MEJORAS_FISICAS",
        estado: "PENDIENTE",
        prioridad: "MEDIA",
        zone: "barra",
        userId: user.id,
      },
      {
        title: "Reordenar mesas del salón",
        description: "Pasillo más amplio hacia cocina",
        categoria: "MEJORAS_FISICAS",
        estado: "EN_CURSO",
        prioridad: "BAJA",
        zone: "salon",
        userId: user.id,
      },
      {
        title: "Arreglar grifo del baño",
        categoria: "MEJORAS_FISICAS",
        estado: "PENDIENTE",
        prioridad: "ALTA",
        zone: "bano",
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
              "Eres el asistente de Crunchadmin. Ayudas con pendientes, inventario, producción, recetas (escalado) y menú. Responde en español.",
          },
        ],
      },
    },
  });

  console.log("Seed OK");
  console.log("  Receta demo mayo:", mayo.name);
  console.log("  Receta demo producción:", marinado.name, "→ 5 kg");
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
