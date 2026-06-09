// ── Storage Unit Tests ──
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import {
  getAllCredentials,
  getCredentialById,
  addCredential,
  updateCredential,
  deleteCredential,
} from "@/lib/storage";

const TEST_DIR = path.join(os.tmpdir(), "obs-test-" + Date.now());

describe("Storage (credentials.json)", () => {
  beforeAll(async () => {
    // Point data dir to temp dir via OBS_DATA_DIR env var
    process.env.OBS_DATA_DIR = path.join(TEST_DIR, ".data");
    await fs.mkdir(process.env.OBS_DATA_DIR, { recursive: true });
    // Set encryption key for tests
    process.env.OBS_ENCRYPTION_KEY = "test-encryption-key-32bytes!xxxxx";
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
    delete process.env.OBS_DATA_DIR;
    delete process.env.OBS_ENCRYPTION_KEY;
  });

  beforeEach(async () => {
    // Clean credentials file before each test
    const credFile = path.join(process.env.OBS_DATA_DIR!, "credentials.json");
    try {
      await fs.unlink(credFile);
    } catch {
      // File doesn't exist
    }
  });

  it("should return empty array when no credentials file exists", async () => {
    const creds = await getAllCredentials();
    expect(creds).toEqual([]);
  });

  it("should add a credential and retrieve it", async () => {
    const input = {
      alias: "Test AWS",
      accessKeyId: "AKIA123456789",
      secretAccessKey: "super-secret-key-12345",
      region: "us-east-1",
    };

    const added = await addCredential(input);
    expect(added.id).toBeDefined();
    expect(added.alias).toBe("Test AWS");
    expect(added.accessKeyId).toBe("AKIA123456789");
    expect(added.secretAccessKey).toBe("super-secret-key-12345");
    expect(added.region).toBe("us-east-1");
    expect(added.status).toBe("untested");
    expect(added.createdAt).toBeDefined();

    // Verify it was persisted
    const all = await getAllCredentials();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(added.id);
  });

  it("should retrieve a credential by ID", async () => {
    const input = {
      alias: "By ID Test",
      accessKeyId: "AKIA987654321",
      secretAccessKey: "another-secret",
      region: "us-west-2",
    };

    const added = await addCredential(input);
    const found = await getCredentialById(added.id);
    expect(found).toBeDefined();
    expect(found!.alias).toBe("By ID Test");
    expect(found!.secretAccessKey).toBe("another-secret");
  });

  it("should return undefined for non-existent ID", async () => {
    const found = await getCredentialById("non-existent-id");
    expect(found).toBeUndefined();
  });

  it("should update an existing credential", async () => {
    const added = await addCredential({
      alias: "Original",
      accessKeyId: "AKIA_OLD",
      secretAccessKey: "old-secret",
      region: "us-east-1",
    });

    const updated = await updateCredential(added.id, {
      alias: "Updated",
      region: "eu-west-1",
    });

    expect(updated).toBeDefined();
    expect(updated!.alias).toBe("Updated");
    expect(updated!.region).toBe("eu-west-1");
    expect(updated!.accessKeyId).toBe("AKIA_OLD"); // unchanged
  });

  it("should return undefined when updating non-existent credential", async () => {
    const result = await updateCredential("no-such-id", { alias: "Nope" });
    expect(result).toBeUndefined();
  });

  it("should delete a credential", async () => {
    const added = await addCredential({
      alias: "Delete Me",
      accessKeyId: "AKIA_DEL",
      secretAccessKey: "delete-secret",
      region: "ap-southeast-1",
    });

    const deleted = await deleteCredential(added.id);
    expect(deleted).toBe(true);

    const all = await getAllCredentials();
    expect(all).toHaveLength(0);
  });

  it("should return false when deleting non-existent credential", async () => {
    const result = await deleteCredential("no-such-id");
    expect(result).toBe(false);
  });

  it("should encrypt the secretAccessKey on disk", async () => {
    await addCredential({
      alias: "Encrypt Test",
      accessKeyId: "AKIA_ENCRYPT",
      secretAccessKey: "this-is-a-secret",
      region: "us-east-1",
    });

    // Read raw file and verify secretAccessKey is encrypted
    const raw = await fs.readFile(path.join(process.env.OBS_DATA_DIR!, "credentials.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const stored = parsed[0];

    // The secretAccessKey should be an object with encrypted, iv, tag — not plaintext
    expect(stored.secretAccessKey).toBeDefined();
    expect(typeof stored.secretAccessKey).toBe("object");
    expect(stored.secretAccessKey.encrypted).toBeDefined();
    expect(stored.secretAccessKey.iv).toBeDefined();
    expect(stored.secretAccessKey.tag).toBeDefined();
    expect(stored.secretAccessKey.encrypted).not.toBe("this-is-a-secret");
  });

  it("should handle multiple credentials", async () => {
    await addCredential({
      alias: "Cred 1",
      accessKeyId: "AKIA_1",
      secretAccessKey: "secret-1",
      region: "us-east-1",
    });
    await addCredential({
      alias: "Cred 2",
      accessKeyId: "AKIA_2",
      secretAccessKey: "secret-2",
      region: "eu-west-1",
    });
    await addCredential({
      alias: "Cred 3",
      accessKeyId: "AKIA_3",
      secretAccessKey: "secret-3",
      region: "ap-southeast-1",
    });

    const all = await getAllCredentials();
    expect(all).toHaveLength(3);
    expect(all.map((c) => c.alias).sort()).toEqual(["Cred 1", "Cred 2", "Cred 3"]);
  });
});