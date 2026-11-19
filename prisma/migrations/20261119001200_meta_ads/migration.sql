-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'meta',
    "metaUserId" TEXT NOT NULL,
    "metaUserName" TEXT,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME,
    "scopes" TEXT NOT NULL DEFAULT 'ads_read,ads_management',
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MetaAdAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "accountStatus" INTEGER NOT NULL DEFAULT 1,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetaAdAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MetaConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdsDailyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actId" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdAccount_connectionId_actId_key" ON "MetaAdAccount"("connectionId", "actId");

-- CreateIndex
CREATE UNIQUE INDEX "AdsDailyReport_actId_reportDate_key" ON "AdsDailyReport"("actId", "reportDate");
