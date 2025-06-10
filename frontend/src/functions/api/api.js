// src/api.js
// !!! Убедитесь, что API_BASE_URL совпадает с вашим бэкендом
const API_BASE_URL = 'https://mixail.ermin33.fvds.ru/api'; 

async function handleResponse(response) {
    if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData.message) errorMessage = errorData.message;
            else if (errorData.error) errorMessage = errorData.error;
        } catch (e) { console.warn('Could not parse error response as JSON:', e); }
        throw new Error(errorMessage);
    }
    const contentLength = response.headers.get('Content-Length');
    if (contentLength === '0' || response.status === 204) { return {}; }
    return response.json();
}

export async function getProjects() {
    const response = await fetch(`${API_BASE_URL}/projects`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    return handleResponse(response);
}

export async function createProject(name, url) {
    const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
    });
    return handleResponse(response);
}

export async function getRepoTree(repoURL) {
    // В вашем коде вы используете /api/structure, я адаптирую
    // Это уже покрывается вашим fetch в DashboardRepo
    const response = await fetch(`${API_BASE_URL}/repo-tree?repo=${encodeURIComponent(repoURL)}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    return handleResponse(response);
}

export async function createService(repoName, serviceType, position) {
    const response = await fetch(`${API_BASE_URL}/create-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName, serviceType, position }),
    });
    return handleResponse(response);
}

export async function updateNodePosition(nodeId, newPosition, repoName) {
    const response = await fetch(`${API_BASE_URL}/update-node-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, position: newPosition, repoName }),
    });
    return handleResponse(response);
}