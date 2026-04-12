import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// ==========================================
// Auto-migrate: create PrefixMapping table
// ==========================================
async function ensureTable(pool: Awaited<ReturnType<typeof getDb>>) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PrefixMapping')
      BEGIN
        CREATE TABLE PrefixMapping (
          prefix_id    INT IDENTITY PRIMARY KEY,
          prefix_code  NVARCHAR(4) NOT NULL,
          customer_id  INT NOT NULL,
          notes        NVARCHAR(200),
          created_at   DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT FK_Prefix_Customer FOREIGN KEY (customer_id) REFERENCES Customers(customer_id),
          CONSTRAINT UQ_Prefix UNIQUE (prefix_code)
        );
      END
    `);
  } catch { /* table may already exist */ }
}

// ==========================================
// Boxtech Token Cache (in-memory)
// ==========================================
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getBoxtechToken(): Promise<string | null> {
  const now = Date.now();
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && tokenExpiresAt > now + 5 * 60 * 1000) {
    return cachedToken;
  }

  const username = process.env.BOXTECH_USERNAME;
  const password = process.env.BOXTECH_PASSWORD;
  if (!username || !password) {
    console.warn('⚠️ BOXTECH credentials not configured');
    return null;
  }

  try {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const res = await fetch('https://app.bic-boxtech.org/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const token = data.accessToken || data.access_token;
    if (!token) return null;

    cachedToken = token;
    // Parse expiry or default to 50 minutes
    if (data.accessTokenExpiresAt) {
      tokenExpiresAt = new Date(data.accessTokenExpiresAt).getTime();
    } else {
      tokenExpiresAt = now + 50 * 60 * 1000;
    }
    return token;
  } catch (err) {
    console.error('❌ Boxtech auth error:', err);
    return null;
  }
}

// ==========================================
// Boxtech API calls
// ==========================================
async function lookupBICCode(token: string, prefix: string) {
  try {
    const res = await fetch(`https://app.bic-boxtech.org/api/v2.0/codes/${prefix}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Returns array
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch { return null; }
}

async function lookupContainer(token: string, containerNumber: string) {
  try {
    const res = await fetch(`https://app.bic-boxtech.org/api/v2.0/container/${containerNumber}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Can return array or object
    return Array.isArray(data) ? data[0] || null : data;
  } catch { return null; }
}

// ==========================================
// Parse ISO size/type code
// ==========================================
function parseSizeType(groupSt: string): { size: string; type: string } | null {
  if (!groupSt || groupSt.length < 2) return null;
  const lengthCode = groupSt[0];
  const sizeMap: Record<string, string> = { '2': '20', '3': '30', '4': '40', 'L': '45', 'M': '48' };
  const typeChar = groupSt.length >= 3 ? groupSt[2] : groupSt[1];
  const typeMap: Record<string, string> = {
    'G': 'GP', 'V': 'GP', 'R': 'RF', 'H': 'HC', 'U': 'OT', 'T': 'TK', 'P': 'FR',
  };
  const size = sizeMap[lengthCode] || '20';
  const type = typeMap[typeChar] || 'GP';
  if (lengthCode === '4' && groupSt[1] === '5') return { size: '40', type: 'HC' };
  if (lengthCode === 'L') return { size: '45', type };
  return { size, type };
}

// ==========================================
// GET /api/boxtech?container_number=XXXX1234567
// ==========================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const containerNumber = searchParams.get('container_number')?.toUpperCase().replace(/[\s-]/g, '');

    if (!containerNumber || containerNumber.length < 4) {
      return NextResponse.json({ success: false, error: 'container_number required (min 4 chars)' }, { status: 400 });
    }

    const prefix = containerNumber.substring(0, 4); // e.g. "MSCU"

    // 1. Look up prefix → customer mapping in our DB
    const pool = await getDb();
    await ensureTable(pool);

    const prefixResult = await pool.request()
      .input('prefix', sql.NVarChar, prefix)
      .query(`
        SELECT pm.prefix_code, pm.customer_id, pm.notes,
               c.customer_name, c.credit_term,
               ISNULL(c.is_line, 0) as is_line,
               ISNULL(c.is_forwarder, 0) as is_forwarder,
               ISNULL(c.is_trucking, 0) as is_trucking
        FROM PrefixMapping pm
        JOIN Customers c ON pm.customer_id = c.customer_id
        WHERE pm.prefix_code = @prefix
      `);

    const customerMatch = prefixResult.recordset.length > 0 ? prefixResult.recordset[0] : null;

    // 2. Try Boxtech API
    const token = await getBoxtechToken();
    let bicData = null;
    let containerData = null;

    if (token) {
      // BIC Code lookup (always try, uses just prefix)
      bicData = await lookupBICCode(token, prefix);

      // Container detail lookup (requires full 11-digit number)
      if (containerNumber.length === 11) {
        containerData = await lookupContainer(token, containerNumber);
      }
    }

    // 3. Build response
    const response: Record<string, unknown> = {
      success: true,
      prefix,
    };

    // Shipping line name
    if (containerData?.current_operator) {
      response.shipping_line = containerData.current_operator;
    } else if (bicData?.name) {
      response.shipping_line = bicData.name;
    }

    // Size & type from container data
    if (containerData?.group_st) {
      const parsed = parseSizeType(containerData.group_st);
      if (parsed) {
        response.size = parsed.size;
        response.type = parsed.type;
      }
      response.group_st = containerData.group_st;
    }

    // Extra container details
    if (containerData?.tare_kg) response.tare_kg = containerData.tare_kg;
    if (containerData?.max_gross_mass_kg) response.max_gross_mass_kg = containerData.max_gross_mass_kg;
    if (containerData?.manufacture_date) response.manufacture_date = containerData.manufacture_date;

    // Customer match from prefix mapping
    if (customerMatch) {
      response.customer = {
        customer_id: customerMatch.customer_id,
        customer_name: customerMatch.customer_name,
        is_line: customerMatch.is_line,
        is_trucking: customerMatch.is_trucking,
        credit_term: customerMatch.credit_term,
      };
    } else {
      response.customer = null;
      response.unknown_prefix = true;
    }

    response.source = token ? 'boxtech' : 'prefix_only';

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Boxtech lookup error:', error);
    return NextResponse.json({ success: false, error: 'Lookup failed' }, { status: 500 });
  }
}
