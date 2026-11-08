/** Interactive chat widgets derived from tool / confirm results */

export type ConfirmWidget = {
  type: "confirm";
  id: string;
  code: string;
  kind: string;
  title: string;
  summary: string;
  confirmLabel: string;
  cancelLabel: string;
};

export type ChoiceWidget = {
  type: "choices";
  id: string;
  prompt: string;
  options: { label: string; message: string }[];
};

export type ChatWidget = ConfirmWidget | ChoiceWidget;

type Toolish = {
  ok?: boolean;
  needsConfirm?: boolean;
  confirmCode?: string;
  summary?: string;
  tool?: string;
  name?: string;
};

function kindLabel(kind: string): string {
  switch (kind) {
    case "inventory_clear_all":
      return "Vaciar inventario";
    case "inventory_delete":
      return "Eliminar insumo";
    case "pendiente_delete":
      return "Eliminar pendiente";
    case "produccion_confirm":
      return "Confirmar producción";
    case "inventory_add_many":
    case "inventory_propose_add_many":
      return "Cargar insumos del adjunto";
    default:
      return "Confirmar acción";
  }
}

export function widgetsFromToolResults(
  toolResults: unknown[] | undefined | null,
  opts?: { messageId?: string }
): ChatWidget[] {
  if (!Array.isArray(toolResults)) return [];
  const widgets: ChatWidget[] = [];
  toolResults.forEach((raw, i) => {
    const t = raw as Toolish;
    if (t?.needsConfirm && t.confirmCode) {
      const kind =
        String(t.tool || t.name || "").replace(/:.*$/, "") ||
        inferKindFromSummary(t.summary || "");
      widgets.push({
        type: "confirm",
        id: `${opts?.messageId || "live"}-confirm-${i}-${t.confirmCode}`,
        code: String(t.confirmCode).toUpperCase(),
        kind,
        title: kindLabel(kind),
        summary: t.summary || "Acción destructiva pendiente de confirmación.",
        confirmLabel: "Confirmar",
        cancelLabel: "Cancelar",
      });
    }
  });
  return widgets;
}

function inferKindFromSummary(summary: string): string {
  const s = summary.toLowerCase();
  if (s.includes("todos los insumos") || s.includes("borrar todos")) {
    return "inventory_clear_all";
  }
  if (s.includes("eliminar «") || s.includes("eliminar \"")) {
    return "inventory_delete";
  }
  if (s.includes("producción") || s.includes("produccion")) {
    return "produccion_confirm";
  }
  if (s.includes("pendiente")) return "pendiente_delete";
  if (s.includes("líneas") || s.includes("lineas") || s.includes("adjunto")) {
    return "inventory_add_many";
  }
  return "pending";
}

export function widgetsFromActionsJson(
  actionsJson: string | null | undefined,
  messageId: string
): ChatWidget[] {
  if (!actionsJson) return [];
  try {
    const parsed = JSON.parse(actionsJson) as {
      widgets?: ChatWidget[];
      toolResults?: unknown[];
      staged?: boolean;
      confirmed?: boolean;
    };
    if (Array.isArray(parsed.widgets) && parsed.widgets.length > 0) {
      return parsed.widgets.map((w) => ({
        ...w,
        id: w.id || `${messageId}-${w.type}`,
      }));
    }
    if (parsed.confirmed) return [];
    return widgetsFromToolResults(parsed.toolResults, { messageId });
  } catch {
    return [];
  }
}

/** Quick-choice helpers the UI can attach after certain replies */
export function stockQuickChoices(): ChoiceWidget {
  return {
    type: "choices",
    id: "quick-stock",
    prompt: "Atajos",
    options: [
      { label: "Ver bajo stock", message: "¿qué insumos están bajos?" },
      { label: "Listar inventario", message: "listá el inventario" },
    ],
  };
}
