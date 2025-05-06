import React, { useState } from 'react';

function RegistrationComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState('');
  const [app_id, setApp_id] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(''); // Сброс предыдущего результата

    try {
      const response = await fetch('https://supreme-roulette.work.gd/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, app_id }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(`✅ Успешная регистрация. ID пользователя: ${data.user_id}`);
      } else {
        const errorText = await response.text();
        setResult(`❌ Ошибка регистрации: ${errorText}`);
      }
    } catch (error) {
      setResult(`❌ Ошибка запроса: ${error.message}`);
    }
    console.log('Отправляем:', {
      email,
      password,
      app_id,
      json: JSON.stringify({ email, password, app_id })
    });
    
  };
  

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', fontFamily: 'Arial' }}>
      <h2>Регистрация</h2>
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
        <label>
          App ID:
          <input
            type="number"
            value={app_id}
            onChange={(e) => setApp_id(parseInt(e.target.value, 10) || 0)}
            required
            style={{ width: '100%', marginBottom: '1rem' }}
          />
        </label>
        <button type="submit" style={{ width: '100%' }}>
          Зарегистрироваться
        </button>

      </form>
      {result && (
        <div style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{result}</div>
      )}
    </div>
  );
}

export default RegistrationComponent;
