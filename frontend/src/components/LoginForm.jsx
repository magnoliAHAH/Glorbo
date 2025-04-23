import React, { useState } from 'react';
import { grpc } from '@improbable-eng/grpc-web';
import { AuthService } from './generated/auth_pb_service';  // Путь к сгенерированному файлу с сервисом
import { LoginRequest, LoginResponse } from './generated/auth_pb';  // Путь к сгенерированному файлу с запросом/ответом

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    const request = new LoginRequest();
    request.setUsername(username);
    request.setPassword(password);

    grpc.unary(AuthService.Login, {
      request: request,
      host: 'http://your-grpc-server-address',  // Замените на адрес вашего gRPC сервера
      onEnd: (response) => {
        if (response.status === grpc.Code.OK) {
          const loginResponse = response.message instanceof LoginResponse ? response.message : null;
          if (loginResponse) {
            setToken(loginResponse.getToken());
            setError('');
          }
        } else {
          setError('Ошибка при авторизации. Попробуйте снова.');
        }
      },
    });
  };

  return (
    <div className="login-form">
      <h2>Вход</h2>
      <input
        type="text"
        placeholder="Логин"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Войти</button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {token && <p>Токен: {token}</p>}
    </div>
  );
};

export default LoginForm;
