const { Pool } = require('pg');
require('dotenv').config();

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '[HIDDEN - FOUND]' : 'NOT FOUND');

const hasConnStr = !!process.env.DATABASE_URL;
const shouldUseSsl = (process.env.DB_SSL || 'false').toLowerCase() === 'true';

// Build configuration from environment when DATABASE_URL is not provided
const envConfig = {
	user: process.env.PGUSER || 'postgres',
	host: process.env.PGHOST || 'localhost',
	database: process.env.PGDATABASE || 'OCFA',
	password: process.env.PGPASSWORD || '123456',
	port: Number(process.env.PGPORT || 5432),
};

if (!hasConnStr) {
	console.log('PG Config →', {
		host: envConfig.host,
		database: envConfig.database,
		user: envConfig.user,
		port: envConfig.port,
		ssl: shouldUseSsl ? 'enabled' : 'disabled',
	});
}

let pool = new Pool(
	hasConnStr
		? {
			connectionString: process.env.DATABASE_URL,
			ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
		}
		: {
			...envConfig,
			ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
		}
);

async function ensureDatabaseExistsAndConnect() {
	try {
		const c = await pool.connect();
		console.log('✅ Database connection successful');
		c.release();
		return pool;
	} catch (err) {
		// 3D000 = invalid_catalog_name (database does not exist)
		if (err && err.code === '3D000' && !hasConnStr) {
			console.warn(`⚠️ Database "${envConfig.database}" not found. Attempting to create it...`);
			try {
				const adminPool = new Pool({
					user: envConfig.user,
					host: envConfig.host,
					database: 'postgres',
					password: envConfig.password,
					port: envConfig.port,
					ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
				});
				await adminPool.query(`CREATE DATABASE "${envConfig.database}"`);
				await adminPool.end();
				console.log(`✅ Database "${envConfig.database}" created successfully`);
				// Recreate pool pointing to the desired database and retry
				pool = new Pool({ ...envConfig, ssl: shouldUseSsl ? { rejectUnauthorized: false } : false });
				const c2 = await pool.connect();
				console.log('✅ Database connection successful');
				c2.release();
				return pool;
			} catch (createErr) {
				console.error('❌ Failed to create database automatically:', createErr.message);
				console.error('   Please create the database manually or update PG* env vars.');
				throw err;
			}
		}
		console.error('❌ Database connection error details:', err);
		throw err;
	}
}

// Kick off connection (and auto-create DB if missing)
ensureDatabaseExistsAndConnect().catch(() => { });

module.exports = pool;
