import React from 'react';

// Предполагаемые стилизованные компоненты (если используете Tailwind или свои CSS-модули)
// const Button = ({ onClick, children, className = "" }) => <button onClick={onClick} className={`px-4 py-2 rounded-md transition-colors duration-200 ${className}`}>{children}</button>;

// Заглушка для Button (если не определена глобально)
const Button = ({ onClick, children, className = "" }) => (
    <button
        onClick={onClick}
        className={className} // Allows custom classes from Tailwind if used
        style={{
            padding: '0.5rem 1rem', // px-4 py-2
            borderRadius: '0.375rem', // rounded-md
            transition: 'background-color 0.2s',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: '#3b82f6', // Example blue
            color: 'white',
            fontWeight: '600'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
    >
        {children}
    </button>
);


/**
 * Компонент для отображения логов работы сервиса.
 * В реальном приложении будет выполнять запрос к API для получения логов.
 * @param {object} props - Свойства компонента.
 * @param {string} props.serviceId - ID сервиса, для которого отображаются логи.
 */
const ServiceLogs = ({ serviceId }) => {
    // В реальном приложении здесь будет логика загрузки логов, например, с использованием useEffect и fetch
    // const [logs, setLogs] = useState([]);
    // useEffect(() => {
    //   const fetchLogs = async () => {
    //     try {
    //       const response = await fetch(`/api/services/${serviceId}/logs`);
    //       const data = await response.json();
    //       setLogs(data.logs);
    //     } catch (error) {
    //       console.error("Failed to fetch service logs:", error);
    //     }
    //   };
    //   fetchLogs();
    // }, [serviceId]);

    return (
        <div className="space-y-2">
            <h4 className="font-semibold">Логи сервиса для {serviceId}</h4>
            <p className="text-gray-400">Здесь будут отображаться логи работы сервиса.</p>
            <p className="text-gray-500">(Эта функция потребует API для получения логов.)</p>
            <pre className="bg-gray-700 p-2 rounded-md text-xs overflow-auto h-40">
                {/* Пример логов */}
                {`2023-10-27 10:00:01 [INFO] Service started successfully.
2023-10-27 10:00:05 [DEBUG] Processing request for /healthz
2023-10-27 10:00:10 [INFO] Data retrieved from database.
2023-10-27 10:00:15 [WARN] High CPU usage detected: 85%.
2023-10-27 10:00:20 [ERROR] Database connection failed. Retrying...`}
            </pre>
            <Button className="bg-green-600 hover:bg-green-700">Обновить логи</Button>
        </div>
    );
};

export default ServiceLogs;
