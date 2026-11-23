// Integration tests run against a dedicated database (never the development one).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/giveaway_test";
process.env.APP_URL ??= "http://localhost:3000";
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-0123456789";
process.env.EMAIL_DISABLED = "1";
process.env.TRUST_PROXY = "true";
