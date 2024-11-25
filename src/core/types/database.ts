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
}

export interface QueryResult {
  sort(criteria: Record<string, number>): QueryResult;
  limit(n: number): QueryResult;
  exec(): Promise<unknown[]>;
} 