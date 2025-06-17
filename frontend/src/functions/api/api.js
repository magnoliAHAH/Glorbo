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
            else if (typeof errorData === 'string') errorMessage = errorData;
        } catch (e) { 
            console.warn('Could not parse error response as JSON:', e); 
            errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }
    const contentLength = response.headers.get('Content-Length');
    if (contentLength === '0' || response.status === 204) { 
        return {}; 
    }
    return response.json();
}

export async function getProjects() {
    const response = await fetch(`${API_BASE_URL}/projects`, { 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    });
    return handleResponse(response);
}

export async function createProject(name, url) {
    const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
        credentials: 'include',
    });
    return handleResponse(response);
}

export async function getRepoTree(repoURL) {
    const response = await fetch(`${API_BASE_URL}/repo-tree?repo=${encodeURIComponent(repoURL)}`, { 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
    });
    return handleResponse(response);
}

// Изменение: теперь функция createService будет принимать projectId (число)
// Мы будем передавать его из DashboardForMain.jsx, где он будет прочитан из localStorage
export async function createService(projectId, serviceType, position) {
    console.log('Sending createService request with:', { projectId, serviceType, position });
    const response = await fetch(`${API_BASE_URL}/create-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: Number(projectId), serviceType, position }), 
        credentials: 'include',
    });
    return handleResponse(response);
}

// Изменение: функция updateNodePosition теперь будет принимать projectId
export async function updateNodePosition(nodeId, newPosition, projectId) { // Изменено на projectId
    const response = await fetch(`${API_BASE_URL}/update-node-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, position: newPosition, projectId: Number(projectId) }), // Отправляем projectId
        credentials: 'include',
    });
    return handleResponse(response);
}

// Изменение: функция createAuthService будет принимать projectId
export async function createAuthService(projectId, appName) {
    console.log('Sending createAuthService request with:', { projectId, appName });
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/auth-services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: appName }),
        credentials: 'include',
    });
    return handleResponse(response);
}

export async function getProjectServices(projectId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${parseInt(projectId, 10)}/services`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Важно для отправки JWT-токена
        });
        return handleResponse(response);
    } catch (error) {
        console.error(`Error fetching services for project ${projectId}:`, error);
        throw error;
    }
}

export async function getServicesList(projectId) {
    try {
        const response = await fetch(`${API_BASE_URL}/projects/${parseInt(projectId, 10)}/services`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Важно для отправки JWT-токена
        });
        return handleResponse(response);
    } catch (error) {
        console.error(`Error fetching services for project ${projectId}:`, error);
        throw error;
    }
}

export const deleteService = async (serviceId, projectId) => {
    try {
        if (!serviceId || typeof projectId !== 'number') {
            throw new Error('Service ID and Project ID are required for deletion.');
        }

        // Формируем URL, включая serviceId и projectId в пути
        const url = `${API_BASE_URL}/projects/${projectId}/services/${serviceId}`;

        console.log(`Sending DELETE request to: ${url}`);

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                // Если ваш бэкенд ожидает заголовок Authorization,
                // убедитесь, что он также обрабатывается middleware (например, WithAuth)
                // и что ваш фронтенд отправляет его (чаще всего через HTTP-куки,
                // что обеспечивается 'credentials: "include"').
            },
            credentials: 'include', // Важно для отправки куки с JWT
        });

        return handleResponse(response);
    } catch (error) {
        console.error('Error deleting service:', error);
        throw error; // Перебрасываем ошибку для дальнейшей обработки в UI
    }
};

