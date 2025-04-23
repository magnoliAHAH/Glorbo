import React, { useState } from 'react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(''); // Сброс предыдущего результата

    try {
      const response = await fetch('https://supreme-roulette.work.gd/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(`✅ Успешный вход. ID пользователя: ${data.user_id}`);
        // Здесь вы можете сохранить токен или перенаправить пользователя
      } else {
        const errorText = await response.text();
        setResult(`❌ Ошибка входа: ${errorText}`);
      }
    } catch (error) {
      setResult(`❌ Ошибка запроса: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', fontFamily: 'Arial' }}>
      <h2>Вход</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', marginBottom: '1rem' }}
          />
        </label>
        <label>
          Пароль:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', marginBottom: '1rem' }}
          />
        </label>
        <button type="submit" style={{ width: '100%' }}>
          Войти
        </button>
      </form>
      {result && (
        <div style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{result}</div>
      )}
    </div>
  );
}

export default LoginForm;
