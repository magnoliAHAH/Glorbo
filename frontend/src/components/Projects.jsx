import React, { useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);

  const fetchProjects = async () => {
    try {

      // Выполняем запрос к API с использованием JWT
      const response = await axios.get('/api/projects', {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true, // Включаем отправку cookie
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
