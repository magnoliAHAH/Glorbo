import React, { useEffect, useState } from 'react';

const ProjectUsersList = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const projectId = localStorage.getItem('projectId');

      if (!projectId) {
        setError('Project ID not found in localStorage');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `https://mixail.ermin33.fvds.ru/api/projects/${projectId}/users`,
          {
            credentials: 'include', // важно для передачи cookie с токеном
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const users = await response.json();
        const emailList = users.map((user) => user.email);
        setEmails(emailList);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) return <p>Загрузка...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h3>Список email-ов пользователей проекта</h3>
      <ul>
        {emails.map((email, index) => (
          <li key={index}>{email}</li>
        ))}
      </ul>
    </div>
  );
};

export default ProjectUsersList;
