export interface Database {
  transaction(): Promise<Transaction>;
  collection(name: string): Collection;
}

export interface Transaction {
  insert(collection: string, data: unknown): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface Collection {
  find(query: Record<string, unknown>): QueryResult;
  updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { upsert?: boolean }
  ): Promise<{ modifiedCount: number }>;
  insertOne(
    doc: Record<string, unknown>
  ): Promise<{ insertedId: string }>;
}

export interface Snapshot {
  agentId: string;
  timestamp: Date;
  state: Record<string, unknown>;
}

export interface QueryResult {
  sort(criteria: Record<string, number>): QueryResult;
  limit(n: number): QueryResult;
  exec<T = unknown>(): Promise<T[]>;
} 