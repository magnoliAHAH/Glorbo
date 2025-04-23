import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import StartButton from '../components/ConsoleButton';
import Graph from '../components/Graph';

const Dashboard = () => {
  const [structure, setStructure] = useState(null);
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const repo = params.get('repo');

  useEffect(() => {
    if (repo) {
      fetch(`https://supreme-roulette.work.gd/api/structure?repo=${encodeURIComponent(repo)}`)
        .then(res => res.json())
        .then(data => setStructure(data));
    }
  }, [repo]);

  return (
    <div style={{ height: '80vh', width: '100%' }}>
      <h2>Dashboard</h2>
      <StartButton />
      {structure ? (
        <Graph structure={structure} />
      ) : (
        <p>Загрузка структуры проекта...</p>
      )}
    </div>
  );
};

export default Dashboard;
