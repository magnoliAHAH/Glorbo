import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Graph from '../components/Graph';
import styled from 'styled-components';

const DashboardForMain = () => {
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const repo = localStorage.getItem('repo');

  useEffect(() => {
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
  }, [location.search, navigate, repo]);

  const handleChangeRepo = () => {
    localStorage.removeItem('repo');
    navigate('/projects');
  };

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  return (
    <Page>
      <Header>
        <Title>📊 Dashboard проекта</Title>
        <SwitchButton onClick={handleChangeRepo}>Сменить репозиторий</SwitchButton>
      </Header>

      <MainContent>
        <RepoCard onClick={togglePanel} isOpen={isPanelOpen}>
          <RepoName>{repo}</RepoName>
          <ToggleText>{isPanelOpen ? 'Скрыть граф' : 'Показать граф'}</ToggleText>
        </RepoCard>

        {isPanelOpen && (
          <Panel>
            {loading && <Spinner />}
            {error && <Message error>{error}</Message>}
            {!loading && !error && structure && <GraphWrapper><Graph structure={structure} /></GraphWrapper>}
          </Panel>
        )}
      </MainContent>
    </Page>
  );
};

export default DashboardForMain;

/* --- СТИЛИ --- */

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

const MainContent = styled.div`
  display: flex;
  gap: 20px;
`;

const RepoCard = styled.div`
  background: #e3f0ff;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  cursor: pointer;
  user-select: none;
  box-shadow: ${({ isOpen }) => (isOpen ? '0 0 8px #3070f0' : 'none')};
  flex-shrink: 0;
  width: 250px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: box-shadow 0.3s ease;
  font-weight: 600;
  font-size: 1.2rem;
  color: #3070f0;

  &:hover {
    background: #c9e2ff;
  }
`;

const RepoName = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ToggleText = styled.div`
  font-size: 0.9rem;
  color: #555;
`;

const Panel = styled.div`
  flex-grow: 1;
  min-height: 60vh;
  background: #fafafa;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
`;
