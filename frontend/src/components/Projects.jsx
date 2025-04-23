import React, { useState } from 'react';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState(null);

  const fetchProjects = async () => {
    try {
      const response = await fetch('https://supreme-roulette.work.gd/api/projects', {
        method: 'GET',
        credentials: 'include', // для cookie
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Ошибка: ${response.status}`);
      }

      if (Array.isArray(data)) {
        setProjects(data);
        setMessage(null);
      } else if (data.message) {
        setProjects([]);
        setMessage(data.message);
      } else {
        setProjects([]);
        setMessage('Неизвестный формат ответа от сервера');
      }
    } catch (err) {
      setProjects([]);
      setMessage(err.message);
    }
  };

  return (
    <div>
      <button onClick={fetchProjects}>Загрузить проекты</button>

      {message && <p style={{ color: message.startsWith('Ошибка') ? 'red' : 'black' }}>{message}</p>}

      {projects.length > 0 && (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <strong>{project.name}</strong> — <a href={project.url} target="_blank" rel="noopener noreferrer">{project.url}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Projects;
