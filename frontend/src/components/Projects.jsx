import React, { useState } from 'react';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);

  const fetchProjects = async () => {
    try {
      const response = await fetch('https://supreme-roulette.work.gd/api/projects', {
        method: 'GET',
        credentials: 'include', // Включаем отправку cookie
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
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
