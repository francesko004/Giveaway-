-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'CLOSED', 'DRAW_COMPLETED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LOCATION', 'POSTER', 'SOCIAL', 'PARTNER', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ELIGIBLE', 'FLAGGED', 'INVALID');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'MARKETING', 'AGE');

-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('COMMITTED', 'COMPLETED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "DrawResultRole" AS ENUM ('WINNER', 'ALTERNATE');

-- CreateEnum
CREATE TYPE "VisitKind" AS ENUM ('SCAN', 'LANDING');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'DELETION', 'RECTIFICATION', 'MARKETING_OPT_OUT');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prizeName" TEXT NOT NULL,
    "prizeDescription" TEXT NOT NULL,
    "prizeImage" TEXT,
    "prizeValue" TEXT,
    "translations" JSONB NOT NULL DEFAULT '{}',
    "eligibility" TEXT NOT NULL DEFAULT '',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "drawAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "alternateCount" INTEGER NOT NULL DEFAULT 2,
    "showParticipantCount" BOOLEAN NOT NULL DEFAULT false,
    "referencePrefix" TEXT NOT NULL DEFAULT 'GIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRSource" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'OTHER',
    "destination" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailCanonical" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "referenceNumber" TEXT NOT NULL,
    "qrSourceId" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "termsVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'sq',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "statusReason" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "invalidatedById" TEXT,
    "flags" JSONB NOT NULL DEFAULT '[]',
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "ipHash" TEXT,
    "anonymizedAt" TIMESTAMP(3),

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'COMMITTED',
    "algorithmVersion" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "winnerCount" INTEGER NOT NULL,
    "alternateCount" INTEGER NOT NULL,
    "commitmentAt" TIMESTAMP(3) NOT NULL,
    "drandNetwork" TEXT NOT NULL,
    "drandChainHash" TEXT NOT NULL,
    "drandPublicKey" TEXT NOT NULL,
    "drandScheme" TEXT NOT NULL,
    "drandPeriod" INTEGER NOT NULL,
    "drandGenesis" INTEGER NOT NULL,
    "drandRound" INTEGER NOT NULL,
    "drandRoundAt" TIMESTAMP(3) NOT NULL,
    "randomness" TEXT,
    "signature" TEXT,
    "beaconFetchedAt" TIMESTAMP(3),
    "winningEntryId" TEXT,
    "completedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,
    "supersedesId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawResult" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "role" "DrawResultRole" NOT NULL,
    "snapshotIndex" INTEGER NOT NULL,
    "entryHash" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "disqualifiedAt" TIMESTAMP(3),
    "disqualificationReason" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "userId" TEXT,
    "campaignId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipHash" TEXT,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageVisit" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "qrSourceId" TEXT,
    "kind" "VisitKind" NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT 'Kompania Juaj',
    "companyLegalName" TEXT NOT NULL DEFAULT '',
    "companyNipt" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "defaultLocale" TEXT NOT NULL DEFAULT 'sq',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Tirane',
    "featuredCampaignId" TEXT,
    "registrationsPerIpPerHour" INTEGER NOT NULL DEFAULT 10,
    "minFormFillSeconds" INTEGER NOT NULL DEFAULT 3,
    "sendConfirmationEmail" BOOLEAN NOT NULL DEFAULT true,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publishSnapshot" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "sessionTtlHours" INTEGER NOT NULL DEFAULT 12,
    "termsVersion" TEXT NOT NULL DEFAULT '1.0',
    "privacyVersion" TEXT NOT NULL DEFAULT '1.0',
    "termsContent" JSONB NOT NULL DEFAULT '{}',
    "privacyContent" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'PENDING',
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_endsAt_idx" ON "Campaign"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "QRSource_code_key" ON "QRSource"("code");

-- CreateIndex
CREATE INDEX "QRSource_campaignId_idx" ON "QRSource"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "QRSource_campaignId_slug_key" ON "QRSource"("campaignId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_referenceNumber_key" ON "Participant"("referenceNumber");

-- CreateIndex
CREATE INDEX "Participant_campaignId_status_idx" ON "Participant"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Participant_campaignId_registeredAt_idx" ON "Participant"("campaignId", "registeredAt");

-- CreateIndex
CREATE INDEX "Participant_qrSourceId_idx" ON "Participant"("qrSourceId");

-- CreateIndex
CREATE INDEX "Participant_email_idx" ON "Participant"("email");

-- CreateIndex
CREATE INDEX "Participant_phone_idx" ON "Participant"("phone");

-- CreateIndex
CREATE INDEX "Participant_ipHash_idx" ON "Participant"("ipHash");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_campaignId_emailCanonical_key" ON "Participant"("campaignId", "emailCanonical");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_campaignId_phone_key" ON "Participant"("campaignId", "phone");

-- CreateIndex
CREATE INDEX "ConsentRecord_participantId_idx" ON "ConsentRecord"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Draw_supersedesId_key" ON "Draw"("supersedesId");

-- CreateIndex
CREATE INDEX "Draw_campaignId_status_idx" ON "Draw"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Draw_campaignId_sequence_key" ON "Draw"("campaignId", "sequence");

-- CreateIndex
CREATE INDEX "DrawResult_participantId_idx" ON "DrawResult"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawResult_drawId_position_key" ON "DrawResult"("drawId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_hash_key" ON "AuditLog"("hash");

-- CreateIndex
CREATE INDEX "AuditLog_campaignId_idx" ON "AuditLog"("campaignId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PageVisit_campaignId_createdAt_idx" ON "PageVisit"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "PageVisit_qrSourceId_idx" ON "PageVisit"("qrSourceId");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- CreateIndex
CREATE INDEX "DataRequest_status_idx" ON "DataRequest"("status");

-- CreateIndex
CREATE INDEX "DataRequest_email_idx" ON "DataRequest"("email");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRSource" ADD CONSTRAINT "QRSource_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_qrSourceId_fkey" FOREIGN KEY ("qrSourceId") REFERENCES "QRSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Draw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawResult" ADD CONSTRAINT "DrawResult_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVisit" ADD CONSTRAINT "PageVisit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVisit" ADD CONSTRAINT "PageVisit_qrSourceId_fkey" FOREIGN KEY ("qrSourceId") REFERENCES "QRSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
