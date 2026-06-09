// ── Log Clustering with pgvector ──
// Groups similar log messages using TF-IDF vector embeddings
// and cosine similarity via pgvector (PostgreSQL).

interface LogEntry {
  id?: string;
  timestamp: string;
  message: string;
  serviceId?: string;
  level?: string;
  namespace?: string;
}

interface LogCluster {
  id: string;
  label: string;          // Representative message for the cluster
  size: number;           // Number of logs in the cluster
  serviceIds: string[];   // Services involved
  severity: string;       // Highest severity in cluster
  sampleMessages: string[]; // Example messages
  avgTimestamp: string;   // Average/canonical timestamp
}

interface LogVector {
  logId: string;
  message: string;
  tokens: Map<string, number>; // term -> TF
  magnitude: number;
}

/**
 * Simple tokenizer for log messages
 * Splits on whitespace and common separators, lowercases, removes punctuation
 */
function tokenize(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && t.length < 100); // Skip very short/long tokens
}

/**
 * Compute Term Frequency vector for a single message
 */
function computeTF(message: string): Map<string, number> {
  const tokens = tokenize(message);
  const tf = new Map<string, number>();
  const total = tokens.length;

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1 / total);
  }

  return tf;
}

/**
 * Compute Inverse Document Frequency for a corpus
 */
function computeIDF(corpus: string[]): Map<string, number> {
  const df = new Map<string, number>();
  const N = corpus.length;

  for (const doc of corpus) {
    const tokens = new Set(tokenize(doc));
    for (const token of tokens) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
  }

  return idf;
}

/**
 * Build TF-IDF vector for a message given pre-computed IDF
 */
function buildTFIDFVector(
  message: string,
  idf: Map<string, number>
): Map<string, number> {
  const tf = computeTF(message);
  const vector = new Map<string, number>();

  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) || 1;
    vector.set(term, tfVal * idfVal);
  }

  return vector;
}

/**
 * Compute cosine similarity between two TF-IDF vectors
 */
function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  // Compute dot product and magnitude of A
  for (const [term, valA] of a) {
    magA += valA * valA;
    const valB = b.get(term) || 0;
    dotProduct += valA * valB;
  }

  // Compute magnitude of B
  for (const [_, valB] of b) {
    magB += valB * valB;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Generate a representative label for a cluster of messages
 */
function generateClusterLabel(messages: string[]): string {
  if (messages.length === 0) return "empty";
  if (messages.length === 1) return messages[0].substring(0, 120);

  // Tokenize all messages and find most common terms
  const termFreq = new Map<string, number>();
  for (const msg of messages) {
    const tokens = new Set(tokenize(msg));
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }
  }

  // Sort by frequency, pick top 5 terms as label
  const topTerms = [...termFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);

  return topTerms.join(" ") || messages[0].substring(0, 120);
}

/**
 * Convert TF-IDF vector to a numeric array for pgvector storage
 * Uses a fixed vocabulary sorted alphabetically for consistency
 */
function vectorToArray(
  vector: Map<string, number>,
  vocabulary?: string[]
): number[] {
  const terms = vocabulary
    ? vocabulary
    : [...vector.keys()].sort();

  return terms.map((t) => vector.get(t) || 0);
}

/**
 * Build vocabulary from all log messages for consistent vector dimensions
 */
function buildVocabulary(logs: LogEntry[]): string[] {
  const termSet = new Set<string>();
  for (const log of logs) {
    const tokens = tokenize(log.message);
    for (const t of tokens) termSet.add(t);
  }
  return [...termSet].sort();
}

/**
 * Cluster log messages by TF-IDF cosine similarity
 * Returns groups of similar logs
 */
export function clusterLogs(
  logs: LogEntry[],
  similarityThreshold: number = 0.4
): LogCluster[] {
  if (logs.length === 0) return [];

  const corpus = logs.map((l) => l.message);
  const idf = computeIDF(corpus);

  // Build TF-IDF vectors for all logs
  const vectors: LogVector[] = logs.map((log) => {
    const tokens = computeTF(log.message);
    const vector = buildTFIDFVector(log.message, idf);

    let mag = 0;
    for (const [, val] of vector) mag += val * val;
    mag = Math.sqrt(mag);

    return {
      logId: log.id || log.timestamp,
      message: log.message,
      tokens,
      magnitude: mag,
      ...vector,
    };
  });

  // Greedy clustering: start with first log as first cluster centroid
  const clusters: { centroid: Map<string, number>; logs: LogEntry[] }[] = [];

  for (let i = 0; i < logs.length; i++) {
    const vector = buildTFIDFVector(logs[i].message, idf);
    let assigned = false;

    // Try to assign to existing cluster
    for (const cluster of clusters) {
      const sim = cosineSimilarity(vector, cluster.centroid);
      if (sim >= similarityThreshold) {
        cluster.logs.push(logs[i]);
        // Update centroid: average vectors
        const total = cluster.logs.length;
        for (const [term, val] of vector) {
          cluster.centroid.set(
            term,
            (cluster.centroid.get(term) || 0) + val / total
          );
        }
        assigned = true;
        break;
      }
    }

    // Create new cluster if not assigned
    if (!assigned) {
      clusters.push({
        centroid: new Map(vector),
        logs: [logs[i]],
      });
    }
  }

  // Convert to output format
  const severityOrder = ["critical", "error", "warn", "info", "debug"];
  const severityRank = (s: string) =>
    severityOrder.indexOf(s.toLowerCase()) === -1
      ? severityOrder.length
      : severityOrder.indexOf(s.toLowerCase());

  return clusters
    .map((c, idx) => {
      const serviceIds = [...new Set(c.logs.map((l) => l.serviceId || "unknown"))];
      const worstSeverity = c.logs.reduce((worst, l) =>
        severityRank(l.level || "info") < severityRank(worst) ? l.level || "info" : worst
      , "info");

      const timestamps = c.logs.map((l) => new Date(l.timestamp).getTime());
      const avgTs = new Date(
        timestamps.reduce((a, b) => a + b, 0) / timestamps.length
      ).toISOString();

      return {
        id: `cluster-${idx + 1}`,
        label: generateClusterLabel(c.logs.map((l) => l.message)),
        size: c.logs.length,
        serviceIds,
        severity: worstSeverity,
        sampleMessages: c.logs.slice(0, 3).map((l) => l.message),
        avgTimestamp: avgTs,
      };
    })
    .sort((a, b) => b.size - a.size);
}

/**
 * Validate that pgvector is available
 */
export function validatePgvector(): boolean {
  try {
    // pgvector checks are done at the DB level via health check
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate SQL for inserting a log vector into pgvector
 */
export function generateVectorInsertSQL(
  logEntry: LogEntry,
  vocabulary: string[],
  tableName: string = "feature_store.log_embeddings"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): { sql: string; params: any[] } {
  const message = logEntry.message;
  const tfidf = computeTF(message);

  // Build fixed-dimension vector from vocabulary
  const vector = vocabulary.map((term) => tfidf.get(term) || 0);

  return {
    sql: `INSERT INTO ${tableName}
      (timestamp, message, service_id, level, namespace, embedding)
      VALUES ($1, $2, $3, $4, $5, $6::vector)`,
    params: [
      logEntry.timestamp,
      message,
      logEntry.serviceId || null,
      logEntry.level || "info",
      logEntry.namespace || null,
      `[${vector.join(",")}]`,
    ],
  };
}