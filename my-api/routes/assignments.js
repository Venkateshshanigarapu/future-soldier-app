const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helpers
function normalizeStatusToApp(status) {
	if (!status) return null;
	const s = String(status).trim().toLowerCase();
	if (s === 'pending') return 'pending';
	if (s === 'in progress' || s === 'in_progress') return 'in_progress';
	if (s === 'completed' || s === 'complete') return 'completed';
	if (s === 'cancelled' || s === 'canceled') return 'cancelled';
	return s.replace(/\s+/g, '_');
}

function dbStatusFromApp(status) {
	if (!status) return null;
	switch (status) {
		case 'pending':
			return 'Pending';
		case 'in_progress':
			return 'In Progress';
		case 'completed':
			return 'Completed';
		case 'cancelled':
			return 'Cancelled';
		default:
			return status;
	}
}

// GET /api/assignments - list with filtering
router.get('/', async (req, res) => {
	const { status, priority, type, assignedCommander, sector, unitId, userId, timeframe, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

	// Security: unitId is required - never return all assignments
	if (!unitId) {
		return res.status(403).json({ error: 'unitId required' });
	}

	try {
		// Determine unit_id: if unitId is numeric, use it directly; if string, look it up in units table
		let finalUnitId = null;
		const unitIdNum = parseInt(unitId);
		
		if (!isNaN(unitIdNum) && String(unitIdNum) === String(unitId)) {
			// unitId is numeric - use it directly
			finalUnitId = unitIdNum;
		} else {
			// unitId is a string (unit name) - look it up in units table
			try {
				const unitResult = await pool.query(
					'SELECT id FROM public.units WHERE TRIM(name) ILIKE TRIM($1) LIMIT 1',
					[String(unitId).trim()]
				);
				if (unitResult.rows.length > 0) {
					finalUnitId = unitResult.rows[0].id;
					console.log(`[Assignments] Looked up unit "${unitId}" -> unit_id: ${finalUnitId}`);
				} else {
					console.warn(`[Assignments] Unit "${unitId}" not found in units table`);
					return res.status(404).json({ error: `Unit "${unitId}" not found` });
				}
			} catch (lookupErr) {
				console.error('Error looking up unit:', lookupErr);
				// If units table doesn't exist or query fails, return error
				return res.status(500).json({ error: 'Failed to look up unit. Please provide numeric unit_id.' });
			}
		}

		// Build WHERE clause filters
		const whereConditions = ['unit_id = $1'];
		const params = [finalUnitId];
		let paramCount = 1;

		if (status) {
			paramCount++;
			whereConditions.push(`LOWER(REPLACE(status, ' ', '_')) = LOWER(REPLACE($${paramCount}, ' ', '_'))`);
			params.push(status);
		}
		if (priority) {
			paramCount++;
			whereConditions.push(`priority = $${paramCount}`);
			params.push(priority);
		}
		if (type) {
			paramCount++;
			whereConditions.push(`type = $${paramCount}`);
			params.push(type);
		}
		if (assignedCommander) {
			paramCount++;
			whereConditions.push(`assigned_commander = $${paramCount}`);
			params.push(assignedCommander);
		}
		if (sector) {
			paramCount++;
			whereConditions.push(`sector = $${paramCount}`);
			params.push(sector);
		}
		if (timeframe) {
			paramCount++;
			whereConditions.push(`timeframe = $${paramCount}`);
			params.push(timeframe);
		}

		// Determine sort field and order
		const allowedSortFields = ['created_at', 'priority', 'status', 'assignment_name'];
		const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
		const order = (sortOrder || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
		const sortColumnMap = { title: 'assignment_name' };
		const finalSort = sortColumnMap[sortField] || sortField;

		// Build complete SQL query
		const safeLimit = Math.max(1, Math.min(parseInt(limit) || 50, 100));
		const safeOffset = Math.max(0, parseInt(offset) || 0);
		
		paramCount++;
		const limitParam = paramCount;
		paramCount++;
		const offsetParam = paramCount;

		const sql = `
			SELECT
				assignment_id AS id,
				assignment_name AS title,
				brief_description AS description,
				type,
				priority,
				sector,
				terrain,
				timeframe,
				assigned_commander,
				destination,
				pickup_point,
				geofence_setting,
				objectives,
				LOWER(REPLACE(status, ' ', '_')) AS status,
				created_at,
				unit_id
			FROM assignments
			WHERE ${whereConditions.join(' AND ')}
			ORDER BY ${finalSort} ${order}
			LIMIT $${limitParam} OFFSET $${offsetParam}
		`;

		params.push(safeLimit);
		params.push(safeOffset);

		console.log('[Assignments] Query:', sql);
		console.log('[Assignments] Params:', params);
		const { rows } = await pool.query(sql, params);
		console.log('[Assignments] Result count:', rows.length);
		res.json(rows);
	} catch (err) {
		console.error('Error fetching assignments:', err);
		console.error('Error details:', {
			message: err.message,
			code: err.code,
			detail: err.detail,
			hint: err.hint
		});
		res.status(500).json({ error: err.message || 'Failed to fetch assignments' });
	}
});

// GET /api/assignments/stats/overview
router.get('/stats/overview', async (req, res) => {
	const { unitId, userId } = req.query;

	// Security: unitId is required - never return all stats
	if (!unitId) {
		return res.status(403).json({ error: 'unitId required' });
	}

	try {
		// Determine unit_id: if unitId is numeric, use it directly; if string, look it up in units table
		let finalUnitId = null;
		const unitIdNum = parseInt(unitId);
		
		if (!isNaN(unitIdNum) && String(unitIdNum) === String(unitId)) {
			// unitId is numeric - use it directly
			finalUnitId = unitIdNum;
		} else {
			// unitId is a string (unit name) - look it up in units table
			try {
				const unitResult = await pool.query(
					'SELECT id FROM public.units WHERE TRIM(name) ILIKE TRIM($1) LIMIT 1',
					[String(unitId).trim()]
				);
				if (unitResult.rows.length > 0) {
					finalUnitId = unitResult.rows[0].id;
					console.log(`[Assignments Stats] Looked up unit "${unitId}" -> unit_id: ${finalUnitId}`);
				} else {
					console.warn(`[Assignments Stats] Unit "${unitId}" not found in units table`);
					return res.status(404).json({ error: `Unit "${unitId}" not found` });
				}
			} catch (lookupErr) {
				console.error('Error looking up unit:', lookupErr);
				return res.status(500).json({ error: 'Failed to look up unit. Please provide numeric unit_id.' });
			}
		}

		// Filter assignments by unit_id only (no filtering by assignee)
		let query = `
			SELECT
				COUNT(*) AS total,
				COUNT(CASE WHEN LOWER(REPLACE(status, ' ', '_')) = 'pending' THEN 1 END) AS pending,
				COUNT(CASE WHEN LOWER(REPLACE(status, ' ', '_')) = 'in_progress' THEN 1 END) AS in_progress,
				COUNT(CASE WHEN LOWER(REPLACE(status, ' ', '_')) = 'completed' THEN 1 END) AS completed,
				COUNT(CASE WHEN LOWER(REPLACE(status, ' ', '_')) = 'cancelled' THEN 1 END) AS cancelled
			FROM assignments
			WHERE unit_id = $1
		`;
		const params = [finalUnitId];

		const result = await pool.query(query, params);
		res.json(result.rows[0] || { total: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 });
	} catch (err) {
		console.error('Error fetching assignment stats:', err);
		res.status(500).json({ error: err.message });
	}
});

// GET /api/assignments/:id
router.get('/:id', async (req, res) => {
	const { id } = req.params;
	try {
		const result = await pool.query(
			`SELECT
				assignment_id AS id,
				assignment_name AS title,
				brief_description AS description,
				type,
				priority,
				sector,
				terrain,
				timeframe,
				assigned_commander,
				destination,
				pickup_point,
				geofence_setting,
				objectives,
				LOWER(REPLACE(status, ' ', '_')) AS status,
				created_at
			FROM assignments
			WHERE assignment_id = $1`,
			[id]
		);
		if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
		res.json(result.rows[0]);
	} catch (err) {
		console.error('Error fetching assignment by id:', err);
		res.status(500).json({ error: err.message });
	}
});

// POST /api/assignments
router.post('/', async (req, res) => {
	const { assignment_name, brief_description, type, priority, sector, terrain, timeframe, assigned_commander, destination, pickup_point, geofence_setting, objectives, status, unit_id } = req.body;
	if (!assignment_name) return res.status(400).json({ error: 'assignment_name is required' });
	if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });
	try {
		const result = await pool.query(
			`INSERT INTO assignments (
				assignment_name, brief_description, type, priority, sector, terrain, timeframe, assigned_commander, destination, pickup_point, geofence_setting, objectives, status, unit_id
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
			) RETURNING assignment_id AS id, unit_id`,
			[
				assignment_name,
				brief_description || null,
				type || null,
				priority || null,
				sector || null,
				terrain || null,
				timeframe || null,
				assigned_commander || null,
				destination || null,
				pickup_point || null,
				geofence_setting || null,
				objectives || null,
				status ? dbStatusFromApp(status) : 'Pending',
				parseInt(unit_id)
			]
		);
		
		const assignmentId = result.rows[0].id;
		const assignmentUnitId = result.rows[0].unit_id;

		// Look up unit name from unit_id (used for both alert and push notifications)
		let unitName = null;
		if (assignmentUnitId) {
			try {
				const unitResult = await pool.query(
					'SELECT name FROM public.units WHERE id = $1 LIMIT 1',
					[assignmentUnitId]
				);
				if (unitResult.rows.length > 0) {
					unitName = unitResult.rows[0].name;
				}
			} catch (unitErr) {
				console.error('Error looking up unit name:', unitErr);
			}
		}

		// Create alert in alerts table
		try {
			// Map priority to severity
			let severity = 'medium';
			if (priority) {
				const priorityLower = priority.toLowerCase();
				if (priorityLower === 'urgent' || priorityLower === 'high') {
					severity = 'high';
				} else if (priorityLower === 'low') {
					severity = 'low';
				}
			}

			// Build alert message
			const alertMessage = `New assignment: ${assignment_name}${brief_description ? ` - ${brief_description}` : ''}${sector ? ` (Sector: ${sector})` : ''}${priority ? ` [Priority: ${priority}]` : ''}`;

			// Insert alert
			const alertResult = await pool.query(
				`INSERT INTO alerts (category, message, severity, status, unit, created_at)
				 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
				 RETURNING *`,
				['assignment', alertMessage, severity, 'active', unitName || null]
			);

			console.log(`✅ Alert created for assignment ${assignmentId}:`, {
				alertId: alertResult.rows[0].id,
				category: 'assignment',
				unit: unitName
			});
		} catch (alertErr) {
			// Log error but don't fail the assignment creation
			console.error('❌ Error creating alert for assignment:', alertErr);
		}

		// Emit realtime event for new assignment - scoped to unit
		try {
			const io = req.app.get('io');
			if (io && assignmentUnitId) {
				// Emit to unit-specific room only
				io.to(`unit:${assignmentUnitId}`).emit('assignmentCreated', { id: assignmentId });
			}
		} catch (e) {
			console.error('Error emitting socket event:', e);
		}

		// Send push notifications to all users in the unit
		try {
			const { sendNotificationsByFilter } = require('../services/firebaseService');

			if (unitName) {
				// Send notifications to all users in the unit who have push tokens
				const notificationMessage = {
					title: `📋 New Assignment: ${assignment_name}`,
					body: brief_description || `A new assignment has been created for your unit`,
					data: {
						type: 'assignment',
						category: 'assignment',
						priority: priority === 'urgent' ? 'high' : 'normal',
						assignmentId: assignmentId.toString(),
						title: assignment_name,
						description: brief_description,
						priority: priority || 'medium',
						type: type,
						sector: sector,
						alertId: `assignment-${assignmentId}`,
						requiresAction: true,
						timestamp: new Date().toISOString()
					}
				};

				const notificationResult = await sendNotificationsByFilter(
					{ unit: unitName, hasPushToken: true },
					notificationMessage
				);

				console.log(`📱 Push notifications sent for assignment ${assignmentId} to unit "${unitName}":`, {
					count: notificationResult.count,
					message: notificationResult.message
				});
			} else {
				console.warn(`⚠️ Could not determine unit name for unit_id ${assignmentUnitId}, skipping push notifications`);
			}
		} catch (notifErr) {
			// Log error but don't fail the assignment creation
			console.error('❌ Error sending push notifications for assignment:', notifErr);
		}

		res.status(201).json({ id: assignmentId });
	} catch (err) {
		console.error('Error creating assignment:', err);
		res.status(500).json({ error: err.message });
	}
});

// PUT /api/assignments/:id
router.put('/:id', async (req, res) => {
	const { id } = req.params;
	const { assignment_name, brief_description, type, priority, sector, terrain, timeframe, assigned_commander, destination, pickup_point, geofence_setting, objectives, status } = req.body;
	try {
		const result = await pool.query(
			`UPDATE assignments SET
				assignment_name = COALESCE($1, assignment_name),
				brief_description = COALESCE($2, brief_description),
				type = COALESCE($3, type),
				priority = COALESCE($4, priority),
				sector = COALESCE($5, sector),
				terrain = COALESCE($6, terrain),
				timeframe = COALESCE($7, timeframe),
				assigned_commander = COALESCE($8, assigned_commander),
				destination = COALESCE($9, destination),
				pickup_point = COALESCE($10, pickup_point),
				geofence_setting = COALESCE($11, geofence_setting),
				objectives = COALESCE($12, objectives),
				status = COALESCE($13, status)
			WHERE assignment_id = $14
			RETURNING assignment_id AS id`,
			[
				assignment_name || null,
				brief_description || null,
				type || null,
				priority || null,
				sector || null,
				terrain || null,
				timeframe || null,
				assigned_commander || null,
				destination || null,
				pickup_point || null,
				geofence_setting || null,
				objectives || null,
				status ? dbStatusFromApp(status) : null,
				id
			]
		);
		if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

		// Emit realtime event for update - scoped to unit
		try {
			const io = req.app.get('io');
			if (io) {
				// Get unit_id for this assignment
				const unitResult = await pool.query('SELECT unit_id FROM assignments WHERE assignment_id = $1', [id]);
				if (unitResult.rows[0]?.unit_id) {
					// Emit to unit-specific room only
					io.to(`unit:${unitResult.rows[0].unit_id}`).emit('assignmentUpdated', { id: result.rows[0].id });
				}
			}
		} catch (e) {}

		res.json({ id: result.rows[0].id });
	} catch (err) {
		console.error('Error updating assignment:', err);
		res.status(500).json({ error: err.message });
	}
});

// PATCH /api/assignments/:id/status
router.patch('/:id/status', async (req, res) => {
	const { id } = req.params;
	const { status } = req.body;
	if (!status) return res.status(400).json({ error: 'status is required' });
	try {
		const dbStatus = dbStatusFromApp(normalizeStatusToApp(status));
		const result = await pool.query(
			`UPDATE assignments SET status = $1 WHERE assignment_id = $2 RETURNING assignment_id AS id`,
			[dbStatus, id]
		);
		if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
		
		// Emit realtime event for status update - scoped to unit
		try {
			const io = req.app.get('io');
			if (io) {
				// Get unit_id for this assignment
				const unitResult = await pool.query('SELECT unit_id FROM assignments WHERE assignment_id = $1', [id]);
				if (unitResult.rows[0]?.unit_id) {
					// Emit to unit-specific room only
					io.to(`unit:${unitResult.rows[0].unit_id}`).emit('assignmentUpdated', { id: result.rows[0].id });
				}
			}
		} catch (e) {}
		
		res.json({ id: result.rows[0].id, status: normalizeStatusToApp(dbStatus) });
	} catch (err) {
		console.error('Error updating assignment status:', err);
		res.status(500).json({ error: err.message });
	}
});

// DELETE /api/assignments/:id
router.delete('/:id', async (req, res) => {
	const { id } = req.params;
	try {
		// Get unit_id before deleting (for socket emission)
		const unitResult = await pool.query('SELECT unit_id FROM assignments WHERE assignment_id = $1', [id]);
		const unitId = unitResult.rows[0]?.unit_id;
		
		const result = await pool.query(`DELETE FROM assignments WHERE assignment_id = $1 RETURNING assignment_id`, [id]);
		if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

		// Emit realtime event for delete - scoped to unit
		try {
			const io = req.app.get('io');
			if (io && unitId) {
				// Emit to unit-specific room only
				io.to(`unit:${unitId}`).emit('assignmentDeleted', { id });
			}
		} catch (e) {}

		res.json({ message: 'Assignment deleted successfully' });
	} catch (err) {
		console.error('Error deleting assignment:', err);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;