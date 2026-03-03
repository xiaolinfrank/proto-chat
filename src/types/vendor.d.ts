// Ambient module stubs for packages used in workspace sub-packages.
// Required because tsgo (TypeScript 7 native preview) includes workspace files
// that are listed in tsconfig exclude, which is a known tsgo limitation.

declare module 'postgres' {
  interface TransactionSql extends Sql {
    savepoint<T>(cb: (sql: TransactionSql) => Promise<T>): Promise<T>;
  }

  interface Sql {
    (strings: TemplateStringsArray, ...values: any[]): Promise<any[]>;
    <T>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]>;
    begin<T>(cb: (sql: TransactionSql) => Promise<T>): Promise<T>;
    end(): Promise<void>;
  }

  function postgres(url: string, options?: Record<string, unknown>): Sql;
  export default postgres;
}
