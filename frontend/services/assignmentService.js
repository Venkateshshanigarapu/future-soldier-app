import { getApiBaseUrl } from './api';

const API_BASE_URL = getApiBaseUrl();
const ROOT_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

async function fetchWithFallback(relativePath) {
  const endpoints = [
    `${API_BASE_URL}${relativePath}`,
    `${ROOT_BASE_URL}${relativePath}`,
  ];
  let lastError;
  for (const url of endpoints) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        continue;
      }
      return await response.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Network error');
}

/**
 * Assignment Service for Future Soldiers APK
 * Handles all assignment-related API operations
 */
class AssignmentService {
  /**
   * Get all assignments with optional filtering
   */
  async getAssignments(options = {}) {
    try {
      const {
        userId,
        status,
        priority,
        assignedBy,
        limit = 50,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      const queryParams = new URLSearchParams();
      
      if (userId) queryParams.append('userId', userId);
      if (status) queryParams.append('status', status);
      if (priority) queryParams.append('priority', priority);
      if (assignedBy) queryParams.append('assignedBy', assignedBy);
      if (limit) queryParams.append('limit', limit);
      if (offset) queryParams.append('offset', offset);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);

      return await fetchWithFallback(`/assignments?${queryParams}`);
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
      throw error;
    }
  }

  /**
   * Get assignment by ID
   */
  async getAssignmentById(id) {
    try {
      return await fetchWithFallback(`/assignments/${id}`);
    } catch (error) {
      console.error('Failed to fetch assignment:', error);
      throw error;
    }
  }

  /**
   * Create new assignment
   */
  async createAssignment(assignmentData) {
    try {
      const response = await fetch(`${API_BASE_URL}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignmentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create assignment:', error);
      throw error;
    }
  }

  /**
   * Update assignment
   */
  async updateAssignment(id, updateData) {
    try {
      const response = await fetch(`${API_BASE_URL}/assignments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Assignment not found');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update assignment:', error);
      throw error;
    }
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(id, status) {
    try {
      const response = await fetch(`${API_BASE_URL}/assignments/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Assignment not found');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update assignment status:', error);
      throw error;
    }
  }

  /**
   * Delete assignment
   */
  async deleteAssignment(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/assignments/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Assignment not found');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      throw error;
    }
  }

  /**
   * Get assignment statistics
   */
  async getAssignmentStats(userId = null) {
    try {
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('userId', userId);

      return await fetchWithFallback(`/assignments/stats/overview?${queryParams}`);
    } catch (error) {
      console.error('Failed to fetch assignment stats:', error);
      throw error;
    }
  }

  /**
   * Get assignments for specific user
   */
  async getUserAssignments(userId, options = {}) {
    try {
      const {
        status,
        priority,
        limit = 50,
        offset = 0
      } = options;

      const queryParams = new URLSearchParams();
      
      if (status) queryParams.append('status', status);
      if (priority) queryParams.append('priority', priority);
      if (limit) queryParams.append('limit', limit);
      if (offset) queryParams.append('offset', offset);

      return await fetchWithFallback(`/assignments/user/${userId}?${queryParams}`);
    } catch (error) {
      console.error('Failed to fetch user assignments:', error);
      throw error;
    }
  }

  /**
   * Format assignment data for display
   */
  formatAssignment(assignment) {
    return {
      ...assignment,
      formattedDueDate: assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : null,
      isOverdue: assignment.due_date && new Date(assignment.due_date) < new Date() && assignment.status !== 'completed',
      daysUntilDue: assignment.due_date ? Math.ceil((new Date(assignment.due_date) - new Date()) / (1000 * 60 * 60 * 24)) : null,
      statusColor: this.getStatusColor(assignment.status),
      priorityColor: this.getPriorityColor(assignment.priority),
      priorityIcon: this.getPriorityIcon(assignment.priority),
      statusIcon: this.getStatusIcon(assignment.status)
    };
  }

  /**
   * Get status color
   */
  getStatusColor(status) {
    switch (status) {
      case 'pending':
        return '#F59E0B'; // Amber
      case 'in_progress':
        return '#3B82F6'; // Blue
      case 'completed':
        return '#10B981'; // Green
      case 'cancelled':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Get priority color
   */
  getPriorityColor(priority) {
    switch (priority) {
      case 'urgent':
        return '#EF4444'; // Red
      case 'high':
        return '#F59E0B'; // Amber
      case 'medium':
        return '#3B82F6'; // Blue
      case 'low':
        return '#10B981'; // Green
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Get priority icon
   */
  getPriorityIcon(priority) {
    switch (priority) {
      case 'urgent':
        return 'flash';
      case 'high':
        return 'trending-up';
      case 'medium':
        return 'remove';
      case 'low':
        return 'trending-down';
      default:
        return 'help-circle';
    }
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    switch (status) {
      case 'pending':
        return 'time';
      case 'in_progress':
        return 'play';
      case 'completed':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  }

  /**
   * Validate assignment data
   */
  validateAssignment(data) {
    const errors = [];

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!data.assigned_to) {
      errors.push('Assigned to is required');
    }

    if (!data.assigned_by) {
      errors.push('Assigned by is required');
    }

    if (data.due_date && new Date(data.due_date) < new Date()) {
      errors.push('Due date cannot be in the past');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default new AssignmentService();
