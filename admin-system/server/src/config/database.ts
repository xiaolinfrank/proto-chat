import dotenv from 'dotenv';

import { drizzle } from 'drizzle-orm/postgres-js';
// @ts-expect-error - postgres package is missing from package.json
import postgres from 'postgres';
import * as schema from '../db/schema';
import * as userExtensionsSchema from '../db/user-extensions-schema';
import * as aiProvidersSchema from '../db/ai-providers-schema';
import * as subscriptionSchema from '../db/subscription-schema';
import * as creditSchema from '../db/credit-schema';
import * as protochatSchema from '../db/protochat-schema';

dotenv.config({ override: true });

// 创建数据库连接
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

console.log('🔍 Database connection string:', connectionString.slice(0, 15) + '...' + (connectionString.split('@')[1] || 'parse_error'));

const client = postgres(connectionString, {
  connect_timeout: 10,
  idle_timeout: 20,
  max: 10,
});
export const db = drizzle(client, {
  schema: {
    ...schema,
    ...userExtensionsSchema,
    ...aiProvidersSchema,
    ...subscriptionSchema,
    ...creditSchema,
    ...protochatSchema
  }
});

// 检查并创建表的函数
export async function checkAndCreateTables() {
  try {
    // 确保users表存在（主项目用户表）
    const usersTableExists = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `;

    if (!usersTableExists[0].exists) {
      console.log('⚠️ users table does not exist. Please ensure the main project database is set up correctly.');
    } else {
      console.log('✅ users table exists');
    }

    return true;
  } catch (error) {
    console.error('Error checking tables:', error);
    return false;
  }
}

export default db;