import { useState } from "react";

function CreateProjectForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("https://mixail.ermin33.fvds.ru/api/projects", {
      method: "POST",
      credentials: "include", // обязательно, чтобы отправить cookie с JWT
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, url }),
    });

    if (res.ok) {
      setMessage("Проект создан!");
      setName("");
      setUrl("");
    } else {
      const errorText = await res.text();
      setMessage("Ошибка: " + errorText);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Создать проект</h3>
      <div>
        <label>Название:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Ссылка (опц.):</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <button type="submit">Создать</button>
      <p>{message}</p>
    </form>
  );
}

export default CreateProjectForm;
