import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ProjectUsers = () => {
  const [users, setUsers] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const savedProject = localStorage.getItem('project');
    if (!savedProject) {
      setError('Сначала выберите проект.');
      setLoading(false);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(savedProject);
    } catch (err) {
      console.error('Ошибка парсинга project из localStorage:', err);
      setError('Некорректные данные проекта.');
      setLoading(false);
      return;
    }

    const projectId = parsed.id;
    const projectName = parsed.name;
    setProjectName(projectName);

    axios
      .get(`/api/projects/${projectId}/users`, {
        withCredentials: true,
      })
      .then((res) => {
        setUsers(res.data);
      })
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || 'Ошибка при загрузке пользователей');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Загрузка списка пользователей...</p>;
  if (error) return <p style={{ color: 'red' }}>Ошибка: {error}</p>;

  return (
    <div>
      <h3>Пользователи проекта «{projectName}»</h3>
      {users.length === 0 ? (
        <p>Пользователей нет.</p>
      ) : (
        <ul>
          {users.map((u) => (
            <li key={u.id}>
              {u.email} (AppID: {u.app_id})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProjectUsers;
