import React from 'react';
import Projects from '../components/Projects';
import styled from 'styled-components';
import { HeaderMain } from '../components/HeaderMain';
import { FooterMain } from '../components/FooterMain';

const ProjectsList = () => {
  return (
    <>
      <HeaderMain />
      <MainContent>
        <PageTitle>Projects</PageTitle>
        <Projects />
      </MainContent>
      <FooterMain />
    </>
  );
};

export default ProjectsList;

const MainContent = styled.main`
  padding-top: 60px;    /* освобождает место под Header */
  padding-bottom: 50px; /* освобождает место под Footer */
  min-height: calc(100vh - 110px); /* учитывает высоты Header + Footer */
  background: #121212;
  color: #eee;
`;

const PageTitle = styled.h1`
  margin: 20px 0;
  font-size: 2rem;
  text-align: center;
`;
