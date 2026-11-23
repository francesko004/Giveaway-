-- Integrity guards for the fairness engine.
-- These triggers make the draw history append-only at the database level, so that even
-- a compromised application layer (or a careless manual SQL session) cannot silently
-- rewrite a commitment, replace randomness, or delete evidence.

-- ── Draw ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION gv_guard_draw_update() RETURNS trigger AS $$
BEGIN
  -- Commitment is immutable.
  IF NEW."campaignId" IS DISTINCT FROM OLD."campaignId"
     OR NEW."sequence" IS DISTINCT FROM OLD."sequence"
     OR NEW."algorithmVersion" IS DISTINCT FROM OLD."algorithmVersion"
     OR NEW."snapshotHash" IS DISTINCT FROM OLD."snapshotHash"
     OR NEW."snapshot" IS DISTINCT FROM OLD."snapshot"
     OR NEW."entryCount" IS DISTINCT FROM OLD."entryCount"
     OR NEW."winnerCount" IS DISTINCT FROM OLD."winnerCount"
     OR NEW."alternateCount" IS DISTINCT FROM OLD."alternateCount"
     OR NEW."commitmentAt" IS DISTINCT FROM OLD."commitmentAt"
     OR NEW."drandNetwork" IS DISTINCT FROM OLD."drandNetwork"
     OR NEW."drandChainHash" IS DISTINCT FROM OLD."drandChainHash"
     OR NEW."drandPublicKey" IS DISTINCT FROM OLD."drandPublicKey"
     OR NEW."drandScheme" IS DISTINCT FROM OLD."drandScheme"
     OR NEW."drandPeriod" IS DISTINCT FROM OLD."drandPeriod"
     OR NEW."drandGenesis" IS DISTINCT FROM OLD."drandGenesis"
     OR NEW."drandRound" IS DISTINCT FROM OLD."drandRound"
     OR NEW."drandRoundAt" IS DISTINCT FROM OLD."drandRoundAt"
     OR NEW."supersedesId" IS DISTINCT FROM OLD."supersedesId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR NEW."createdById" IS DISTINCT FROM OLD."createdById" THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: draw commitment fields cannot be modified';
  END IF;

  -- Reveal values may be written exactly once.
  IF (OLD."randomness" IS NOT NULL AND NEW."randomness" IS DISTINCT FROM OLD."randomness")
     OR (OLD."signature" IS NOT NULL AND NEW."signature" IS DISTINCT FROM OLD."signature")
     OR (OLD."beaconFetchedAt" IS NOT NULL AND NEW."beaconFetchedAt" IS DISTINCT FROM OLD."beaconFetchedAt")
     OR (OLD."winningEntryId" IS NOT NULL AND NEW."winningEntryId" IS DISTINCT FROM OLD."winningEntryId")
     OR (OLD."completedAt" IS NOT NULL AND NEW."completedAt" IS DISTINCT FROM OLD."completedAt")
     OR (OLD."invalidatedAt" IS NOT NULL AND NEW."invalidatedAt" IS DISTINCT FROM OLD."invalidatedAt")
     OR (OLD."invalidationReason" IS NOT NULL AND NEW."invalidationReason" IS DISTINCT FROM OLD."invalidationReason") THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: draw reveal values cannot be replaced';
  END IF;

  -- Allowed status transitions.
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NOT (
      (OLD."status" = 'COMMITTED' AND NEW."status" IN ('COMPLETED', 'INVALIDATED')) OR
      (OLD."status" = 'COMPLETED' AND NEW."status" = 'INVALIDATED')
    ) THEN
      RAISE EXCEPTION 'GV_IMMUTABLE: illegal draw status transition % -> %', OLD."status", NEW."status";
    END IF;
  END IF;

  IF OLD."status" = 'INVALIDATED' AND (
       NEW."randomness" IS DISTINCT FROM OLD."randomness" OR
       NEW."signature" IS DISTINCT FROM OLD."signature" OR
       NEW."winningEntryId" IS DISTINCT FROM OLD."winningEntryId" OR
       NEW."completedAt" IS DISTINCT FROM OLD."completedAt") THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: an invalidated draw is frozen';
  END IF;

  IF NEW."status" = 'COMPLETED' AND (NEW."randomness" IS NULL OR NEW."signature" IS NULL OR NEW."completedAt" IS NULL) THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: a completed draw requires verified randomness';
  END IF;

  IF NEW."status" = 'INVALIDATED' AND (NEW."invalidatedAt" IS NULL OR coalesce(length(trim(NEW."invalidationReason")), 0) < 10) THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: invalidation requires a public reason';
  END IF;

  -- Randomness can only be revealed for a round that was committed before it existed.
  IF NEW."randomness" IS NOT NULL AND OLD."randomness" IS NULL AND NEW."commitmentAt" >= NEW."drandRoundAt" THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: committed round was not in the future at commitment time';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gv_guard_draw_insert() RETURNS trigger AS $$
BEGIN
  IF NEW."status" <> 'COMMITTED' OR NEW."randomness" IS NOT NULL OR NEW."signature" IS NOT NULL THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: draws must be created as commitments without randomness';
  END IF;
  IF NEW."drandRoundAt" <= NEW."commitmentAt" THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: committed drand round must be in the future';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gv_forbid_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'GV_IMMUTABLE: rows in % are append-only and cannot be deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gv_draw_insert BEFORE INSERT ON "Draw" FOR EACH ROW EXECUTE FUNCTION gv_guard_draw_insert();
CREATE TRIGGER gv_draw_update BEFORE UPDATE ON "Draw" FOR EACH ROW EXECUTE FUNCTION gv_guard_draw_update();
CREATE TRIGGER gv_draw_delete BEFORE DELETE ON "Draw" FOR EACH ROW EXECUTE FUNCTION gv_forbid_delete();

-- ── DrawResult ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION gv_guard_draw_result_insert() RETURNS trigger AS $$
DECLARE s "DrawStatus";
BEGIN
  SELECT "status" INTO s FROM "Draw" WHERE "id" = NEW."drawId";
  IF s IS DISTINCT FROM 'COMMITTED' THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: results can only be written while completing a committed draw';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gv_guard_draw_result_update() RETURNS trigger AS $$
BEGIN
  IF NEW."drawId" IS DISTINCT FROM OLD."drawId"
     OR NEW."position" IS DISTINCT FROM OLD."position"
     OR NEW."role" IS DISTINCT FROM OLD."role"
     OR NEW."snapshotIndex" IS DISTINCT FROM OLD."snapshotIndex"
     OR NEW."entryHash" IS DISTINCT FROM OLD."entryHash"
     OR NEW."participantId" IS DISTINCT FROM OLD."participantId"
     OR NEW."referenceNumber" IS DISTINCT FROM OLD."referenceNumber"
     OR (OLD."disqualifiedAt" IS NOT NULL AND NEW."disqualifiedAt" IS DISTINCT FROM OLD."disqualifiedAt")
     OR (OLD."disqualificationReason" IS NOT NULL AND NEW."disqualificationReason" IS DISTINCT FROM OLD."disqualificationReason") THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: draw results cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gv_draw_result_insert BEFORE INSERT ON "DrawResult" FOR EACH ROW EXECUTE FUNCTION gv_guard_draw_result_insert();
CREATE TRIGGER gv_draw_result_update BEFORE UPDATE ON "DrawResult" FOR EACH ROW EXECUTE FUNCTION gv_guard_draw_result_update();
CREATE TRIGGER gv_draw_result_delete BEFORE DELETE ON "DrawResult" FOR EACH ROW EXECUTE FUNCTION gv_forbid_delete();

-- ── AuditLog (append-only) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION gv_forbid_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'GV_IMMUTABLE: rows in % are append-only and cannot be modified', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gv_audit_update BEFORE UPDATE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION gv_forbid_update();
CREATE TRIGGER gv_audit_delete BEFORE DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION gv_forbid_delete();

-- ── Participant: no new or re-classified entries once the list is frozen ──────
CREATE OR REPLACE FUNCTION gv_guard_participant_insert() RETURNS trigger AS $$
DECLARE locked timestamp(3);
BEGIN
  SELECT "lockedAt" INTO locked FROM "Campaign" WHERE "id" = NEW."campaignId";
  IF locked IS NOT NULL THEN
    RAISE EXCEPTION 'GV_LOCKED: the entry list for this campaign is frozen';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gv_guard_participant_update() RETURNS trigger AS $$
DECLARE locked timestamp(3);
BEGIN
  SELECT "lockedAt" INTO locked FROM "Campaign" WHERE "id" = OLD."campaignId";
  IF locked IS NOT NULL AND (
       NEW."status" IS DISTINCT FROM OLD."status" OR
       NEW."campaignId" IS DISTINCT FROM OLD."campaignId" OR
       NEW."referenceNumber" IS DISTINCT FROM OLD."referenceNumber" OR
       NEW."registeredAt" IS DISTINCT FROM OLD."registeredAt") THEN
    RAISE EXCEPTION 'GV_LOCKED: entries cannot be re-classified after the list is frozen';
  END IF;
  IF NEW."referenceNumber" IS DISTINCT FROM OLD."referenceNumber" OR NEW."campaignId" IS DISTINCT FROM OLD."campaignId" THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: reference number and campaign of an entry are permanent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gv_guard_participant_delete() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Draw" WHERE "campaignId" = OLD."campaignId") THEN
    RAISE EXCEPTION 'GV_IMMUTABLE: entries of a campaign with draw history must be anonymised, not deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gv_participant_insert BEFORE INSERT ON "Participant" FOR EACH ROW EXECUTE FUNCTION gv_guard_participant_insert();
CREATE TRIGGER gv_participant_update BEFORE UPDATE ON "Participant" FOR EACH ROW EXECUTE FUNCTION gv_guard_participant_update();
CREATE TRIGGER gv_participant_delete BEFORE DELETE ON "Participant" FOR EACH ROW EXECUTE FUNCTION gv_guard_participant_delete();

-- ── Campaign: draw parameters are frozen while the entry list is locked ────────
CREATE OR REPLACE FUNCTION gv_guard_campaign_update() RETURNS trigger AS $$
BEGIN
  IF OLD."lockedAt" IS NOT NULL AND NEW."lockedAt" IS NOT NULL AND (
       NEW."startsAt" IS DISTINCT FROM OLD."startsAt" OR
       NEW."endsAt" IS DISTINCT FROM OLD."endsAt" OR
       NEW."closedAt" IS DISTINCT FROM OLD."closedAt" OR
       NEW."winnerCount" IS DISTINCT FROM OLD."winnerCount" OR
       NEW."alternateCount" IS DISTINCT FROM OLD."alternateCount" OR
       NEW."lockedAt" IS DISTINCT FROM OLD."lockedAt") THEN
    RAISE EXCEPTION 'GV_LOCKED: draw parameters cannot change while the entry list is frozen';
  END IF;
  IF OLD."lockedAt" IS NOT NULL AND NEW."lockedAt" IS NULL AND EXISTS (
       SELECT 1 FROM "Draw" WHERE "campaignId" = OLD."id" AND "status" <> 'INVALIDATED') THEN
    RAISE EXCEPTION 'GV_LOCKED: the entry list can only be unfrozen after the draw is publicly invalidated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gv_campaign_update BEFORE UPDATE ON "Campaign" FOR EACH ROW EXECUTE FUNCTION gv_guard_campaign_update();
CREATE TRIGGER gv_campaign_delete BEFORE DELETE ON "Campaign" FOR EACH ROW EXECUTE FUNCTION gv_forbid_delete();
