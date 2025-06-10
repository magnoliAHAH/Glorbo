import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Graph from '../components/Graph';
import styled, { keyframes } from 'styled-components';

const DashboardRepo = () => {
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const repo = localStorage.getItem('repo');
    if (!repo) {
      navigate('/projects');
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`https://mixail.ermin33.fvds.ru/api/structure?repo=${encodeURIComponent(repo)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `Ошибка ${res.status}`);
        return data;
      })
      .then(setStructure)
      .catch(err => {
        console.error('Error fetching structure:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [location.search, navigate]);

  const handleChangeRepo = () => {
    localStorage.removeItem('repo');
    navigate('/projects');
  };

  return (
    <Page>
      <Header>
        <Title>📊 Dashboard проекта</Title>
        <SwitchButton onClick={handleChangeRepo}>Сменить репозиторий</SwitchButton>
      </Header>

      <Content>
        {loading && <Spinner />}
        {error && <Message error>{error}</Message>}
        {!loading && !error && structure && (
          <GraphWrapper>
            <Graph structure={structure} />
          </GraphWrapper>
        )}
      </Content>
    </Page>
  );
};

export default DashboardRepo;

/* --- СТИЛИ --- */

const fade = keyframes`
  0% { opacity: 0.2; }
  50% { opacity: 0.6; }
  100% { opacity: 0.2; }
`;

const Page = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h2`
  font-size: 1.8rem;
  color: #333;
`;

const SwitchButton = styled.button`
  background: #3070f0;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #2554c7;
  }
`;

const Content = styled.div`
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #ddd;
  border-top-color: #3070f0;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const Message = styled.p`
  font-size: 1rem;
  color: ${({ error }) => (error ? 'crimson' : '#555')};
`;

const GraphWrapper = styled.div`
  width: 100%;
  height: 100%;
  padding: 1rem;
  background: #fafafa;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
`;
