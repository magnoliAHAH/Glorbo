import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

const Header = ({ onSelectRepo }) => {
  const [repos, setRepos] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    // TODO: заменить на реальный API вызов получения списка репозиториев пользователя
    fetch('https://supreme-roulette.work.gd/api/projects', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRepos(data);
      })
      .catch(err => console.error('Error fetching repos:', err));
  }, []);

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <HeaderContainer>
      <Logo>🔥 project</Logo>
      <RepoSelector ref={menuRef}>
        <SelectorButton onClick={() => setShowMenu(prev => !prev)}>
          Выбрать репозиторий ▼
        </SelectorButton>
        {showMenu && (
          <Dropdown>
            {repos.map(repo => (
              <DropdownItem key={repo.id} onClick={() => {
                onSelectRepo(repo.url);
                setShowMenu(false);
              }}>
                {repo.name}
              </DropdownItem>
            ))}
          </Dropdown>
        )}
      </RepoSelector>
    </HeaderContainer>
  );
};

export default Header;

const HeaderContainer = styled.header`
  height: 60px;
  background-color: #1a1a1a;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  position: fixed;
  left: 240px;
  right: 0;
  top: 0;
  z-index: 99;
  border-bottom: 1px solid #2c2c2c;
`;

const Logo = styled.span`
  font-size: 1.2rem;
  font-weight: bold;
  margin-right: auto;
`;

const RepoSelector = styled.div`
  position: relative;
`;

const SelectorButton = styled.button`
  background: transparent;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1rem;
`;

const Dropdown = styled.ul`
  position: absolute;
  top: 100%;
  right: 0;
  background: #2c2c2c;
  list-style: none;
  margin: 5px 0 0;
  padding: 0;
  border: 1px solid #444;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
`;

const DropdownItem = styled.li`
  padding: 8px 12px;
  cursor: pointer;
  &:hover {
    background-color: #3a3a3a;
  }
`;