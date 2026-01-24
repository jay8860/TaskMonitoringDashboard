import axios from 'axios';

// In production (single service), use relative path. In dev, use localhost:8000.
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');
const API_URL = `${BASE_URL}/api/tasks`;
const EMP_URL = `${BASE_URL}/api/employees`;
const AUTH_URL = `${BASE_URL}/api/auth`;

export const api = {
    // --- Auth ---
    login: async (credentials) => {
        const response = await axios.post(`${AUTH_URL}/login`, credentials);
        return response.data;
    },

    getHint: async (username) => {
        const response = await axios.get(`${AUTH_URL}/hint/${username}`);
        return response.data;
    },

    forgotPassword: async (email) => {
        const response = await axios.post(`${AUTH_URL}/forgot-password`, { email });
        return response.data;
    },

    resetPassword: async (data) => {
        // data: { token, new_password }
        const response = await axios.post(`${AUTH_URL}/reset-password`, data);
        return response.data;
    },

    // --- Tasks ---
    getTasks: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.agency) params.append('agency', filters.agency);
        if (filters.status) params.append('status', filters.status);
        if (filters.search) params.append('search', filters.search);
        if (filters.sortBy) params.append('sort_by', filters.sortBy);

        const response = await axios.get(`${API_URL}/?${params.toString()}`);
        return response.data;
    },

    getStats: async () => {
        const response = await axios.get(`${API_URL}/stats`);
        return response.data;
    },

    createTask: async (taskData) => {
        const response = await axios.post(`${API_URL}/`, taskData);
        return response.data;
    },

    updateTask: async (taskId, updates) => {
        const response = await axios.put(`${API_URL}/${taskId}`, updates);
        return response.data;
    },

    deleteTask: async (taskId) => {
        const response = await axios.delete(`${API_URL}/${taskId}`);
        return response.data;
    },

    syncSheet: async () => {
        const response = await axios.post(`${API_URL}/sync`, null, { timeout: 20000 });
        return response.data;
    },

    // --- Employees ---
    getEmployees: async () => {
        const response = await axios.get(`${EMP_URL}/`);
        return response.data;
    },

    createEmployee: async (data) => {
        const response = await axios.post(`${EMP_URL}/`, data);
        return response.data;
    },

    updateEmployee: async (id, data) => {
        const response = await axios.put(`${EMP_URL}/${id}`, data);
        return response.data;
    },

    deleteEmployee: async (id) => {
        const response = await axios.delete(`${EMP_URL}/${id}`);
        return response.data;
    },

    syncDropdowns: async () => {
        const response = await axios.post(`${EMP_URL}/sync-dropdowns`, null, { timeout: 30000 });
        return response.data;
    }
};
