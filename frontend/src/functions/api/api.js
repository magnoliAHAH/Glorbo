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

export async function updateNodePosition(nodeId, newPosition, projectId) {
    const response = await fetch(`${API_BASE_URL}/update-node-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, position: newPosition, projectId: Number(projectId) }), 
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
            credentials: 'include',
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
            credentials: 'include',
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

        const url = `${API_BASE_URL}/projects/${projectId}/services/${serviceId}`;

        console.log(`Sending DELETE request to: ${url}`);

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });

        return handleResponse(response);
    } catch (error) {
        console.error('Error deleting service:', error);
        throw error;
    }
};

export async function runProjectTask(taskBody) {
    const response = await fetch(
      `${API_BASE_URL}/execute-task`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(taskBody),
      }
    );
  
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }
  
    const text = await response.text();
    return text;
  }
  
  

export async function createPodAndService(projectId, podSpec) {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/pods`, 
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(podSpec),
    }
  );
  return handleResponse(response);
}

export async function createDeploymentAndService(projectId, body) {
    const res = await fetch(`/api/projects/${projectId}/deploys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`createDeploymentAndService failed: ${res.statusText}`);
    return res.json();
  }

export const deleteK8sResources = async (namespace, deploymentName, serviceName) => {
  if (!namespace || !deploymentName || !serviceName) {
    throw new Error('namespace, deploymentName и serviceName обязательны для удаления ресурсов');
  }

  const url = `${API_BASE_URL}/delete-resources`;
  console.log(`Sending DELETE request to API: ${url}`, { namespace, deploymentName, serviceName });

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ namespace, deploymentName, serviceName }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete resources: ${response.status} ${text}`);
  }
};