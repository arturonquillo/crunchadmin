-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUnit" TEXT NOT NULL,
    "purchaseNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Pendiente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoria" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
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

-- CreateTable
CREATE TABLE "PendienteAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pendienteId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendienteAttachment_pendienteId_fkey" FOREIGN KEY ("pendienteId") REFERENCES "Pendiente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "yieldQty" REAL,
    "yieldUnit" TEXT,
    "yieldLabel" TEXT,
    "currentVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Receta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecetaVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recetaId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT,
    "changelog" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    CONSTRAINT "RecetaVersion_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecetaVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecetaLinea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" REAL,
    "unit" TEXT,
    "isToTaste" BOOLEAN NOT NULL DEFAULT false,
    "canBeScaleBase" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "insumoId" TEXT,
    CONSTRAINT "RecetaLinea_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecetaVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecetaLinea_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "recetaId" TEXT,
    CONSTRAINT "MenuItem_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuPlatformSpec" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "displayName" TEXT,
    "price" REAL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "channelNotes" TEXT,
    CONSTRAINT "MenuPlatformSpec_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pendienteId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" DATETIME NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "Reminder_pendienteId_fkey" FOREIGN KEY ("pendienteId") REFERENCES "Pendiente" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actionsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RecetaVersion_recetaId_number_key" ON "RecetaVersion"("recetaId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "MenuPlatformSpec_menuItemId_platform_key" ON "MenuPlatformSpec"("menuItemId", "platform");
