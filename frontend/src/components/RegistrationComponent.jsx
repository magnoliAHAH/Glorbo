import React, { useState } from 'react';
import styled from 'styled-components';

const RegistrationComponent = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [app_id, setApp_id] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult('');
    try {
      const numericAppId = parseInt(app_id, 10); // преобразуем в число перед отправкой

      const res = await fetch('https://mixail.ermin33.fvds.ru/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, app_id: numericAppId }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(`✅ Успешный вход. Токен: ${data.token}`);
      } else {
        const err = await res.text();
        setResult(`❌ Ошибка входа: ${err}`);
      }
    } catch (err) {
      setResult(`❌ Ошибка запроса: ${err.message}`);
    }
  };

  return (
    <Container>
      <Title>Регистрация</Title>
      <Form onSubmit={handleSubmit}>
        <Label>
          Email
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </Label>
        <Label>
          Пароль
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </Label>
        <Label>
          App ID
          <Input
            type="number"
            value={app_id}
            onChange={e => setApp_id(e.target.value)}
            required
          />
        </Label>
        <SubmitButton type="submit">Зарегистрироваться</SubmitButton>
      </Form>
      {result && <ResultMessage>{result}</ResultMessage>}
    </Container>
  );
};

export default RegistrationComponent;

/* Стили */
const Container = styled.div`
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  background: #1e1e1e;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  color: #eee;
`;

const Title = styled.h2`
  margin-bottom: 1rem;
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
`;

const Input = styled.input`
  margin-top: 0.25rem;
  padding: 0.5rem;
  border: 1px solid #444;
  background: #2a2a2a;
  color: #eee;
  border-radius: 4px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #3070f0;
  }
`;

const SubmitButton = styled.button`
  margin-top: 0.5rem;
  padding: 0.75rem;
  font-size: 1rem;
  background: #3070f0;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #2554c7;
  }
`;

const ResultMessage = styled.div`
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 4px;
  background: #333;
  white-space: pre-wrap;
`;
