import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useProject } from '../context/ProjectContext';

const ProjectUsers = () => {
  const { currentProject } = useProject();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentProject) {
      setError('Сначала выберите проект.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    axios.get(
      `/api/projects/${currentProject.id}/users`,
      { withCredentials: true }
    )
    .then(res => {
      setUsers(res.data);
    })
    .catch(err => {
      console.error(err);
      setError(err.response?.data?.message || 'Ошибка при загрузке пользователей');
    })
    .finally(() => {
      setLoading(false);
    });
  }, [currentProject]);

  if (loading) return <p>Загрузка списка пользователей...</p>;
  if (error)   return <p style={{ color: 'red' }}>Ошибка: {error}</p>;

  return (
    <div>
      <h3>Пользователи проекта «{currentProject.name}»</h3>
      {users.length === 0
        ? <p>Пользователей нет.</p>
        : (
          <ul>
            {users.map(u => (
              <li key={u.id}>
                {u.email} (AppID: {u.app_id})
              </li>
            ))}
          </ul>
        )
      }
    </div>
  );
};

export default ProjectUsers;
