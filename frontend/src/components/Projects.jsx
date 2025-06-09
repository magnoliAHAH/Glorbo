import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProjects } from '../functions/api/fetchProjects';

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isSupportedRepoUrl = (url) =>
  url.startsWith('https://github.com/') ||
  url.startsWith('https://gitlab.com/') ||
  url.startsWith('https://gitverse.ru/');

const Projects = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', url: '' });
  const [urlValid, setUrlValid] = useState(null);

  useEffect(() => {
    const raw = newProject.url.trim();
    if (!raw) {
      setUrlValid(null);
    } else {
      setUrlValid(isValidUrl(raw) && isSupportedRepoUrl(raw));
    }
  }, [newProject.url]);

  useEffect(() => {
    const load = async () => {
      const { projects, message } = await fetchProjects();
      setProjects(projects);
      setMessage(message);
    };
    load();
  }, []);

  const handleOpen = (url, id) => {
    localStorage.setItem('repo', url);
    localStorage.setItem('projectId', id);
    navigate(`/dashboard`);
  };

  const handleAddProject = async () => {
    try {
      const response = await fetch('https://mixail.ermin33.fvds.ru/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProject),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Ошибка при добавлении проекта');
      }

      const updatedProjects = [...projects, data];
      setProjects(updatedProjects);

      setNewProject({ name: '', url: '' });
      setShowAddForm(false);
      setMessage(null);
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {message && (
        <p style={{ color: message.startsWith('Ошибка') ? 'red' : 'black' }}>
          {message}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '15px',
          marginTop: '20px',
        }}
      >
        <div
          onClick={() => setShowAddForm((prev) => !prev)}
          style={{
            width: '200px',
            height: '120px',
            border: '2px dashed #aaa',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '2rem',
            color: '#555',
          }}
        >
          +
        </div>

        {showAddForm && (
          <div style={{ width: '100%', marginTop: '10px' }}>
            <input
              type="text"
              placeholder="Название проекта"
              value={newProject.name}
              onChange={(e) =>
                setNewProject({ ...newProject, name: e.target.value })
              }
              style={{ marginRight: '10px' }}
            />
            <input
              type="text"
              placeholder="URL проекта"
              value={newProject.url}
              onChange={(e) =>
                setNewProject({ ...newProject, url: e.target.value })
              }
              style={{ marginRight: '10px' }}
            />
            {urlValid === true && (
              <span style={{ color: 'green', marginRight: '10px' }}>✔️</span>
            )}
            {urlValid === false && (
              <span style={{ color: 'red', marginRight: '10px' }}>❌</span>
            )}
            <button onClick={handleAddProject} disabled={!urlValid}>
              Добавить
            </button>
          </div>
        )}

        {projects.map((project) => (
          <div
            key={project.id}
            style={{
              width: '200px',
              height: '120px',
              borderRadius: '12px',
              backgroundColor: '#f5f5f5',
              padding: '10px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <strong>{project.name}</strong>
            <button onClick={() => handleOpen(project.url, project.id)}>Открыть</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Projects;
