export const fetchProjects = async () => {
    try {
      const response = await fetch('https://mixail.ermin33.fvds.ru/api/projects', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.message || `Ошибка: ${response.status}`);
      }
  
      if (Array.isArray(data)) {
        return { projects: data, message: null };
      } else if (data.message) {
        return { projects: [], message: data.message };
      } else {
        return { projects: [], message: 'Неизвестный формат ответа от сервера' };
      }
    } catch (err) {
      return { projects: [], message: err.message };
    }
  };
  
