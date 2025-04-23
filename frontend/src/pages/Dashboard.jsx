import React, { useEffect, useState } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import Graph from '../components/Graph';

const Dashboard = () => {
  const [structure, setStructure] = useState(null);
  const location = useLocation();
  const history = useHistory();

  const params = new URLSearchParams(location.search);
  const urlRepo = params.get('repo');

  useEffect(() => {
    // Сначала проверим, если repo передано через URL
    const repo = urlRepo || localStorage.getItem('repo');

    if (!repo) {
      history.push('/projects');
      return;
    }
    
    fetch(`https://supreme-roulette.work.gd/api/structure?repo=${repo}`)
      .then(res => res.json())
      .then(data => setStructure(data))
      .catch((err) => console.error('Error fetching structure:', err));
  }, [urlRepo, history]);

  return (
    <div style={{ height: '80vh', width: '100%' }}>
      <h2>Dashboard</h2>
      {structure ? (
        <Graph structure={structure} />
      ) : (
        <p>Загрузка структуры проекта...</p>
      )}
    </div>
  );
};

export default Dashboard;
