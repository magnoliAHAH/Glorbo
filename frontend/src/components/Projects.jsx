import React, { useState } from 'react';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);

  const fetchProjects = async () => {
    try {
      const response = await fetch('https://supreme-roulette.work.gd/api/projects', {
        method: 'GET',
        credentials: 'include', // Важно для отправки cookies
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка: ${response.status}`);
      }

      const data = await response.json();
      setProjects(data.projects);
      setError(null);
    } catch (err) {
      setError(err.message);
      setProjects([]);
    }
  };

  return (
    <div>
      <button onClick={fetchProjects}>Загрузить проекты</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {projects.length > 0 ? (
        <ul>
          {projects.map((project, index) => (
            <li key={index}>{project}</li>
          ))}
        </ul>
      ) : !error && <p>Нет загруженных проектов</p>}
    </div>
  );
};

export default Projects;