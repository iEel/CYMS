import sql from 'mssql';

const config: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'CYMS_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined,
    useUTC: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getDb(): Promise<sql.ConnectionPool> {
  if (pool) {
    return pool;
  }
  try {
    pool = await sql.connect(config);
    console.log('✅ เชื่อมต่อ MS SQL Server สำเร็จ');
    return pool;
  } catch (error) {
    console.error('❌ เชื่อมต่อ MS SQL Server ล้มเหลว:', error);
    throw error;
  }
}

export async function query<T>(
  queryString: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  const db = await getDb();
  const request = db.request();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  return request.query(queryString);
}

export default sql;
