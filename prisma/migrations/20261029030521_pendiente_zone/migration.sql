-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pendiente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoria" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "zone" TEXT NOT NULL DEFAULT 'oficina',
    "anchorHint" TEXT,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    "insumoId" TEXT,
    "recetaId" TEXT,
    "menuItemId" TEXT,
    CONSTRAINT "Pendiente_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pendiente_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pendiente_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pendiente_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Pendiente" ("categoria", "createdAt", "description", "dueDate", "estado", "id", "insumoId", "menuItemId", "prioridad", "recetaId", "title", "updatedAt", "userId") SELECT "categoria", "createdAt", "description", "dueDate", "estado", "id", "insumoId", "menuItemId", "prioridad", "recetaId", "title", "updatedAt", "userId" FROM "Pendiente";
DROP TABLE "Pendiente";
ALTER TABLE "new_Pendiente" RENAME TO "Pendiente";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
