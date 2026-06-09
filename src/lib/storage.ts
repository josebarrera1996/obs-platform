import { promises as fs } from "fs";
import path from "path";
import { randomUUID, createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

export interface AwsCredential {
  id: string;
  alias: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  createdAt: string;
  lastTestedAt?: string;
  status: "untested" | "valid" | "invalid";
}

/** Stored shape — secretAccessKey is encrypted */
interface EncryptedCredential extends Omit<AwsCredential, "secretAccessKey"> {
  secretAccessKey: {
    encrypted: string;
    iv: string;
    tag: string;
  };
}

/** Get data directory — overridable via OBS_DATA_DIR env var for testing */
function getDataDir(): string {
  return process.env.OBS_DATA_DIR || path.join(process.cwd(), ".data");
}

function getCredentialsFile(): string {
  return path.join(getDataDir(), "credentials.json");
}

// ── Encryption helpers (AES-256-GCM) ──

function getEncryptionKey(): Buffer {
  let key = process.env.OBS_ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    console.warn(
      "[storage] OBS_ENCRYPTION_KEY not set or too short — using DEV fallback. " +
        "Set a strong key in .env.local for production."
    );
    key = "dev-only-fallback-key-32chars!!";
  }
  // Derive a 256-bit key via SHA-256
  return createHash("sha256").update(key).digest();
}

function encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return { encrypted, iv: iv.toString("hex"), tag };
}

function decrypt(data: { encrypted: string; iv: string; tag: string }): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(data.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(data.tag, "hex"));
  let plaintext = decipher.update(data.encrypted, "hex", "utf8");
  plaintext += decipher.final("utf8");
  return plaintext;
}

// ── File I/O ──

async function ensureDataDir() {
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
  } catch {
    // directory exists
  }
}

async function readCredentials(): Promise<AwsCredential[]> {
  try {
    await ensureDataDir();
    const raw = await fs.readFile(getCredentialsFile(), "utf-8");
    const stored: EncryptedCredential[] = JSON.parse(raw);
    // Decrypt each credential's secretAccessKey
    return stored.map((cred) => ({
      ...cred,
      secretAccessKey: decrypt(cred.secretAccessKey),
    }));
  } catch {
    return [];
  }
}

async function writeCredentials(creds: AwsCredential[]): Promise<void> {
  await ensureDataDir();
  // Encrypt each credential's secretAccessKey before storing
  const encrypted: EncryptedCredential[] = creds.map((cred) => ({
    ...cred,
    secretAccessKey: encrypt(cred.secretAccessKey),
  }));
  await fs.writeFile(
    getCredentialsFile(),
    JSON.stringify(encrypted, null, 2),
    "utf-8"
  );
}

// ── Public API ──

export async function getAllCredentials(): Promise<AwsCredential[]> {
  return readCredentials();
}

export async function getCredentialById(
  id: string
): Promise<AwsCredential | undefined> {
  const creds = await readCredentials();
  return creds.find((c) => c.id === id);
}

export async function addCredential(
  input: Omit<AwsCredential, "id" | "createdAt" | "status">
): Promise<AwsCredential> {
  const creds = await readCredentials();
  const newCred: AwsCredential = {
    id: randomUUID(),
    alias: input.alias,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
    region: input.region,
    createdAt: new Date().toISOString(),
    status: "untested",
  };
  creds.push(newCred);
  await writeCredentials(creds);
  return newCred;
}

export async function updateCredential(
  id: string,
  input: Partial<Omit<AwsCredential, "id" | "createdAt">>
): Promise<AwsCredential | undefined> {
  const creds = await readCredentials();
  const idx = creds.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  creds[idx] = { ...creds[idx], ...input };
  await writeCredentials(creds);
  return creds[idx];
}

export async function deleteCredential(id: string): Promise<boolean> {
  const creds = await readCredentials();
  const filtered = creds.filter((c) => c.id !== id);
  if (filtered.length === creds.length) return false;
  await writeCredentials(filtered);
  return true;
}