// functions/api/api.js

// Функция для создания общего сервиса
export const createService = async (projectId, serviceType, position) => {
    // console.log('Sending createService request:', { projectId, serviceType, position }); // Для отладки

    const response = await fetch('/api/create-service', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            projectId: projectId, // Убедитесь, что это число
            serviceType,
            position,
        }),
        credentials: 'include',
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create service: ${response.statusText}`);
    }
    return response.json();
};

// Функция для обновления позиции узла
export const updateNodePosition = async (nodeId, position, projectName) => {
    const response = await fetch('/api/update-node-position', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            nodeId,
            position,
            projectName, // Используется для определения проекта
        }),
        credentials: 'include',
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update node position: ${response.statusText}`);
    }
    return response.json();
};

// Функция для создания сервиса аутентификации
export const createAuthService = async (projectId, appName) => {
    // console.log('Sending createAuthService request:', { projectId, appName }); // Для отладки

    const response = await fetch(`/api/projects/${projectId}/auth-services`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: appName,
        }),
        credentials: 'include',
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create auth service: ${response.statusText}`);
    }
    return response.json();
};