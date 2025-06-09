import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProjects } from '../functions/api/fetchProjects';
import styled from 'styled-components';

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isSupportedRepoUrl = (url) =>
  url.startsWith('https://github.com/') ||
  url.startsWith('https://gitlab.com/') ||
  url.startsWith('https://gitverse.ru/');

const Projects = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', url: '' });
  const [urlValid, setUrlValid] = useState(null);

  useEffect(() => {
    const raw = newProject.url.trim();
    if (!raw) {
      setUrlValid(null);
    } else {
      setUrlValid(isValidUrl(raw) && isSupportedRepoUrl(raw));
    }
  }, [newProject.url]);

  useEffect(() => {
    const load = async () => {
      const { projects, message } = await fetchProjects();
      setProjects(projects);
      setMessage(message);
    };
    load();
  }, []);

  const handleOpen = (url, id) => {
    localStorage.setItem('repo', url);
    localStorage.setItem('projectId', id);
    navigate(`/dashboard`);
  };

  const handleAddProject = async () => {
    try {
      const response = await fetch('https://mixail.ermin33.fvds.ru/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProject),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Ошибка при добавлении проекта');
      }

      setProjects((prev) => [...prev, data]);
      setNewProject({ name: '', url: '' });
      setShowAddForm(false);
      setMessage(null);
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <Container>
      {message && <Message error={message.startsWith('Ошибка')}>{message}</Message>}

      <Grid>
        <AddCard onClick={() => setShowAddForm((prev) => !prev)}>+</AddCard>

        {showAddForm && (
          <FormWrapper>
            <Input
              type="text"
              placeholder="Название проекта"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            />
            <Input
              type="text"
              placeholder="URL проекта"
              value={newProject.url}
              onChange={(e) => setNewProject({ ...newProject, url: e.target.value })}
            />
            <ValidationIcon valid={urlValid}>
              {urlValid === true && '✔️'}
              {urlValid === false && '❌'}
            </ValidationIcon>
            <AddButton onClick={handleAddProject} disabled={!urlValid}>
              Добавить
            </AddButton>
          </FormWrapper>
        )}

        {projects.map((project) => (
          <ProjectCard key={project.id}>
            <ProjectName>{project.name}</ProjectName>
            <OpenButton onClick={() => handleOpen(project.url, project.id)}>Открыть</OpenButton>
          </ProjectCard>
        ))}
      </Grid>
    </Container>
  );
};

export default Projects;

const Container = styled.div`
  padding: 20px;
  background: #121212;
  min-height: 100vh;
  color: #eee;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const Message = styled.p`
  color: ${({ error }) => (error ? '#ff4d4f' : '#a0a0a0')};
  font-size: 1rem;
  margin-bottom: 10px;
`;

const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 20px;
`;

const AddCard = styled.div`
  width: 200px;
  height: 120px;
  border: 2px dashed #777;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  font-size: 3rem;
  color: #777;
  transition: border-color 0.3s, color 0.3s;

  &:hover {
    border-color: #3f83f8;
    color: #3f83f8;
  }
`;

const FormWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 600px;
  flex-wrap: wrap;
`;

const Input = styled.input`
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  outline: none;
  font-size: 1rem;
  flex: 1 1 200px;
  background: #222;
  color: #eee;
  box-shadow: inset 0 0 5px #000;
  transition: box-shadow 0.3s;

  &:focus {
    box-shadow: inset 0 0 8px #3f83f8;
  }
`;

const ValidationIcon = styled.span`
  font-size: 1.5rem;
  margin-left: 5px;
  color: ${({ valid }) => (valid ? '#4caf50' : '#f44336')};
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AddButton = styled.button`
  padding: 8px 16px;
  background-color: #3f83f8;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;
  flex-shrink: 0;

  &:disabled {
    background-color: #777;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background-color: #356ac3;
  }
`;

const ProjectCard = styled.div`
  width: 200px;
  height: 120px;
  border-radius: 12px;
  background-color: #1e1e1e;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(63, 131, 248, 0.3);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #cfd8dc;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-5px);
  }
`;

const ProjectName = styled.strong`
  font-size: 1.2rem;
  word-break: break-word;
`;

const OpenButton = styled.button`
  background-color: #3f83f8;
  border: none;
  border-radius: 8px;
  padding: 8px 0;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #356ac3;
  }
`;
