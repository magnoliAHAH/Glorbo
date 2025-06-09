import React from 'react';
import { Link } from 'react-router-dom';
import { HomeLayout } from '../layouts/HomeLayout';

const Home = () => (
  <HomeLayout>
    <div style={{ padding: '20px', color: '#eee' }}>
      <h1>Welcome to Glorbo Deployment Dashboard</h1>
      <p>Перенос инфраструктуры проекта из Docker Compose в K3s.</p>
      <Link to="/login" style={{
        display: 'inline-block',
        marginTop: '20px',
        padding: '10px 20px',
        background: '#3070f0',
        color: '#fff',
        textDecoration: 'none',
        borderRadius: '4px'
      }}>Login</Link>
    </div>
  </HomeLayout>
);

export default Home;
