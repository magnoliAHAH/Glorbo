import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CreateAuthServiceForm = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [status, setStatus] = useState(null);
  const [secret, setSecret] = useState(null);

  // Получаем projectId из localStorage
  const projectId = localStorage.getItem('projectId');

  // Если projectId отсутствует, просим выбрать проект
  useEffect(() => {
    if (!projectId) {
      navigate('/projects'); // Перенаправляем на страницу с проектами
    }
  }, [projectId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Идёт создание...');
    try {
      const res = await axios.post(
        `/api/projects/${projectId}/auth-services`,
        { name },
        { withCredentials: true }
      );
      setSecret(res.data.secret);
      setStatus('Сервис успешно создан');
    } catch (err) {
      console.error(err);
      setStatus(err.response?.data?.message || 'Ошибка при создании сервиса');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
      <h3>Создать Auth Service для проекта</h3>

      <div style={{ marginBottom: 12 }}>
        <label>
          Название сервиса:
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '6px 8px', marginTop: 4 }}
          />
        </label>
      </div>

      <button type="submit" disabled={!name}>
        Создать
      </button>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}
      {secret && (
        <p>
          <strong>Secret:</strong> <code>{secret}</code>
        </p>
      )}
    </form>
  );
};

export default CreateAuthServiceForm;
