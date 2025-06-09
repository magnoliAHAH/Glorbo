import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Graph from '../components/Graph';

const Dashboard = () => {
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const savedRepo = localStorage.getItem('repo');
    const repo = savedRepo;

    if (!repo) {
      navigate('/projects');
      return;
    }


    // Fetch project structure
    setLoading(true);
    setError(null);
    fetch(`https://mixail.ermin33.fvds.ru/api/structure?repo=${encodeURIComponent(repo)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Ошибка: ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        setStructure(data);
      })
      .catch((err) => {
        console.error('Error fetching structure:', err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  // Rerun effect when search changes
  }, [location.search, navigate]);

  const handleChangeRepo = () => {
    // Clear saved repo and redirect to projects
    localStorage.removeItem('repo');
    navigate('/projects');
  };

  return (
    <div style={{ padding: '20px', height: '80vh', width: '100%' }}>
      <h2>Dashboard</h2>
      {loading && <p>Загрузка структуры проекта...</p>}
      {error && <p style={{ color: 'red' }}>Ошибка: {error}</p>}
      {!loading && !error && structure && (
        <Graph structure={structure} />
      )}
      <button onClick={handleChangeRepo} style={{ marginTop: '15px' }}>
        Сменить репозиторий
      </button>
    </div>
  );
};

export default Dashboard;
