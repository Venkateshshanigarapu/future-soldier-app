
const pool = require('./db');
const fetch = require('node-fetch');

async function testFiltering() {
    const baseUrl = 'http://117.251.19.107:3001/api';

    try {
        console.log('--- Verifying Notification Filtering ---');

        // 1. Test GET /notifications without userId
        console.log('\n1. Testing GET /notifications (No userId)...');
        const resNoId = await fetch(`${baseUrl}/notifications`);
        const dataNoId = await resNoId.json();
        console.log(`Result: Got ${dataNoId.length} notifications. Expected: 0`);
        if (dataNoId.length === 0) {
            console.log('✅ PASS: No userId returned empty list.');
        } else {
            console.log('❌ FAIL: Returned data without userId.');
        }

        // 2. Test GET /notifications with a specific userId
        // Let's find a user with notifications first
        const userRes = await pool.query('SELECT user_id, COUNT(*) FROM notifications GROUP BY user_id LIMIT 1');
        if (userRes.rows.length > 0) {
            const testUserId = userRes.rows[0].user_id;
            console.log(`\n2. Testing GET /notifications?userId=${testUserId}...`);
            const resWithId = await fetch(`${baseUrl}/notifications?userId=${testUserId}`);
            const dataWithId = await resWithId.json();
            console.log(`Result: Got ${dataWithId.length} notifications.`);

            const allMatch = dataWithId.every(n => n.user_id === testUserId);
            if (allMatch && dataWithId.length > 0) {
                console.log(`✅ PASS: All ${dataWithId.length} notifications belong to user ${testUserId}`);
            } else {
                console.log('❌ FAIL: Notifications returned for wrong user or no notifications found for test.');
            }
        } else {
            console.log('\n⚠️ Skip: No users with notifications found in DB to test specific filtering.');
        }

        console.log('\n--- Verification Complete ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during verification:', err.message);
        process.exit(1);
    }
}

testFiltering();
