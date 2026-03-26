/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Type declarations for mssql v12+
 * Provides complete type coverage for all usage patterns in the codebase:
 * - import sql from 'mssql'  → sql.Int, sql.NVarChar, sql.connect(), etc.
 * - sql.config, sql.ConnectionPool, sql.IResult  → namespace types
 */
declare module 'mssql' {
  interface ISqlType { type: any; }
  interface ISqlTypeWithLength extends ISqlType { (length?: number): ISqlType; }
  interface ISqlTypeWithPrecisionScale extends ISqlType { (precision?: number, scale?: number): ISqlType; }

  export interface config {
    server: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    domain?: string;
    connectionTimeout?: number;
    requestTimeout?: number;
    stream?: boolean;
    parseJSON?: boolean;
    options?: {
      encrypt?: boolean;
      trustServerCertificate?: boolean;
      instanceName?: string;
      useUTC?: boolean;
      enableArithAbort?: boolean;
      appName?: string;
    };
    pool?: {
      max?: number;
      min?: number;
      idleTimeoutMillis?: number;
    };
  }

  export interface IResult<T> {
    recordsets: T[][];
    recordset: T[];
    rowsAffected: number[];
    output: { [key: string]: any };
  }

  export class Request {
    input(name: string, value: any): Request;
    input(name: string, type: any, value: any): Request;
    output(name: string, type: any, value?: any): Request;
    query<T = any>(command: string): Promise<IResult<T>>;
    execute<T = any>(procedure: string): Promise<IResult<T>>;
    batch<T = any>(batch: string): Promise<IResult<T>>;
    cancel(): void;
  }

  export class Transaction {
    constructor(pool?: ConnectionPool);
    begin(isolationLevel?: any): Promise<Transaction>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    request(): Request;
  }

  export class ConnectionPool {
    constructor(config: config, callback?: (err?: Error) => void);
    connect(): Promise<ConnectionPool>;
    close(): Promise<void>;
    request(): Request;
    transaction(): Transaction;
    query<T = any>(command: string): Promise<IResult<T>>;
    query<T = any>(command: TemplateStringsArray, ...args: any[]): Promise<IResult<T>>;
    readonly connected: boolean;
    readonly connecting: boolean;
  }

  export class Table {
    constructor(name?: string);
    columns: any;
    rows: any[][];
    create: boolean;
  }

  // Data type constants
  export const Int: ISqlType;
  export const BigInt: ISqlType;
  export const Float: ISqlType;
  export const Bit: ISqlType;
  export const DateTime: ISqlType;
  export const DateTime2: ISqlType;
  export const Date: ISqlType;
  export const NVarChar: ISqlTypeWithLength;
  export const VarChar: ISqlTypeWithLength;
  export const NChar: ISqlTypeWithLength;
  export const Char: ISqlTypeWithLength;
  export const Text: ISqlType;
  export const NText: ISqlType;
  export const Decimal: ISqlTypeWithPrecisionScale;
  export const Numeric: ISqlTypeWithPrecisionScale;
  export const Money: ISqlType;
  export const SmallMoney: ISqlType;
  export const UniqueIdentifier: ISqlType;
  export const MAX: number;

  // Top-level functions
  export function connect(config: config | string): Promise<ConnectionPool>;
  export function close(): Promise<void>;
  export function query<T = any>(command: string): Promise<IResult<T>>;
  export function query<T = any>(command: TemplateStringsArray, ...args: any[]): Promise<IResult<T>>;
}
