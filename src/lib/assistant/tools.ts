import type OpenAI from "openai";

/** OpenAI Chat Completions tool definitions for Crunchadmin Hablar */
export const ASSISTANT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "inventory_add_stock",
      description:
        "Suma cantidad a un insumo existente, o lo crea si no existe. Uso: «agrega 20 kg de harina». Seguro: ejecuta de inmediato.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del insumo" },
          quantity: { type: "number", description: "Cantidad a sumar" },
          unit: { type: "string", description: "Unidad: kg, g, L, ml, ud" },
          category: {
            type: "string",
            description:
              "Categoría si se crea: ACEITES|CARNES|LACTEOS|SECOS|ESPECIAS|FRESCOS|OTROS",
          },
        },
        required: ["name", "quantity", "unit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inventory_set_stock",
      description:
        "Fija el stock absoluto de un insumo («quedan 8 L de aceite»). Seguro.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
        },
        required: ["name", "quantity", "unit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inventory_list_low",
      description: "Lista insumos en estado Reponer o Crítico (bajo pack/mínimo).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "inventory_delete",
      description:
        "Elimina UN insumo del catálogo. DESTRUCTIVO: no ejecuta; crea confirmación pendiente.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inventory_clear_all",
      description:
        "Borra TODOS los insumos. DESTRUCTIVO: nunca inmediato; pide confirmación.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pendiente_create",
      description:
        "Crea un pendiente/tarea operativa. Inferí zona si se menciona salón→salon, cocina→cocina, etc. Seguro.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          categoria: {
            type: "string",
            description:
              "MEJORAS_FISICAS|COMPRAS|PLANES_FUTUROS|INSUMOS|NUEVAS_RECETAS",
          },
          prioridad: { type: "string", description: "BAJA|MEDIA|ALTA|CRITICA" },
          zone: {
            type: "string",
            description:
              "pared_entrada|cocina|salon|barra|exterior|bano|oficina",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pendiente_update_status",
      description: "Cambia el estado de un pendiente (por título parcial o id). Seguro.",
      parameters: {
        type: "object",
        properties: {
          titleQuery: { type: "string" },
          id: { type: "string" },
          estado: { type: "string", description: "PENDIENTE|EN_CURSO|HECHO" },
        },
        required: ["estado"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pendiente_list",
      description: "Lista pendientes abiertos (opcional filtro zona/categoría).",
      parameters: {
        type: "object",
        properties: {
          zone: { type: "string" },
          categoria: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pendiente_delete",
      description: "Elimina un pendiente. DESTRUCTIVO: requiere confirmación.",
      parameters: {
        type: "object",
        properties: {
          titleQuery: { type: "string" },
          id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "receta_list",
      description: "Lista fichas técnicas / recetas.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "receta_create",
      description:
        "Crea una ficha técnica básica con nombre y líneas opcionales. Seguro.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          notes: { type: "string" },
          yieldQty: { type: "number" },
          yieldUnit: { type: "string" },
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
              },
              required: ["name"],
            },
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "menu_list",
      description: "Lista ítems del menú multi-plataforma.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "produccion_propose",
      description:
        "Calcula (preview) una producción escalada SIN descontar stock. Pedí confirmación al dueño antes de produccion_confirm.",
      parameters: {
        type: "object",
        properties: {
          recetaName: { type: "string" },
          targetQuantity: { type: "number" },
          targetUnit: { type: "string" },
          baseKind: { type: "string", description: "yield|line" },
        },
        required: ["recetaName", "targetQuantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "produccion_confirm",
      description:
        "Confirma y descuenta una producción. DESTRUCTIVO sobre stock: requiere confirmación pendiente si force o faltantes; si canConfirm, puede ir con confirmación ligera vía código.",
      parameters: {
        type: "object",
        properties: {
          recetaName: { type: "string" },
          targetQuantity: { type: "number" },
          targetUnit: { type: "string" },
          baseKind: { type: "string" },
          force: { type: "boolean" },
        },
        required: ["recetaName", "targetQuantity"],
      },
    },
  },
];

export const SYSTEM_PROMPT = `Eres el asistente operativo de Crunchadmin (restaurante). Respondé siempre en español.

OBLIGATORIO: para cualquier pedido de cambio (stock, pendientes, borrar, producción) DEBÉS llamar a la herramienta correspondiente. No digas que lo hiciste si la tool no corrió.

- Acciones seguras (sumar stock, crear pendiente, listar): llamá la tool y reportá el summary que devolvió.
- Acciones destructivas (borrar insumo, vaciar inventario, borrar pendiente, producción que descuenta): SIEMPRE llamá la tool. Ella te da un código real. Respondé exactamente con ese código: «Para confirmar, respondé con: CONFIRMAR ABC123». NUNCA inventes un código ni escribas «CONFIRMAR <código>» literal.
- Si el dueño ya manda CONFIRMAR <código> o solo «CONFIRMAR», el sistema lo procesa antes; no hace falta tool.
- PROHIBIDO decir «eliminé / borré / vacié el inventario» si no recibiste un summary real de una tool. Si no hay tool, pedí confirmación o decí que no se ejecutó nada.
- Inferí zonas: salón/salon→salon, cocina→cocina, barra→barra, baño→bano, oficina→oficina, exterior→exterior, entrada→pared_entrada.`;
