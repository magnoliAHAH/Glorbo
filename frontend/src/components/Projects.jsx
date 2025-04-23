import React, { useState } from 'react';
import axios from 'axios';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*\=\s*([^;]*).*$)|^.*$/, "$1"); // Получаем токен из куки

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects', {
        headers: {
          Authorization: `Bearer ${token}`, // Отправляем токен в заголовке
        },
        withCredentials: true, // Включаем отправку cookies
      });

      setProjects(response.data.projects);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setProjects([]);
    }
  };

  return (
    <div>
      <button onClick={fetchProjects}>Загрузить проекты</button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {projects.length > 0 && (
        <ul>
          {projects.map((project, index) => (
            <li key={index}>{project}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Projects;
