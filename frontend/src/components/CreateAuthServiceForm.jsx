import React, { useState } from 'react';
import axios from 'axios';
import { useProject } from '../context/ProjectContext';

const CreateAuthServiceForm = () => {
  const { currentProject } = useProject();
  const [name, setName] = useState('');
  const [status, setStatus] = useState(null);
  const [secret, setSecret] = useState(null);

  // Если проект не выбран — просим выбрать его
  if (!currentProject) {
    return <p>Сначала выберите проект на странице “Проекты”.</p>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Идёт создание...');
    try {
      const res = await axios.post(
        `/api/projects/${currentProject.id}/auth-services`,
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
      <h3>Создать Auth Service для проекта “{currentProject.name}”</h3>

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
