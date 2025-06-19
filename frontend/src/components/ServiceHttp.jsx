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
 * Компонент для отображения информации о последних обновлениях сервиса.
 * В реальном приложении будет выполнять запрос к API для получения истории обновлений.
 * @param {object} props - Свойства компонента.
 * @param {string} props.serviceId - ID сервиса, для которого отображаются обновления.
 */
const ServiceHttp = ({ serviceId }) => {
    // В реальном приложении здесь будет логика загрузки истории обновлений, например, с использованием useEffect и fetch
    // const [updates, setUpdates] = useState([]);
    // useEffect(() => {
    //   const fetchUpdates = async () => {
    //     try {
    //       const response = await fetch(`/api/services/${serviceId}/updates`);
    //       const data = await response.json();
    //       setUpdates(data.updates);
    //     } catch (error) {
    //       console.error("Failed to fetch service updates:", error);
    //     }
    //   };
    //   fetchUpdates();
    // }, [serviceId]);

    return (
        <div className="space-y-2">
            <h4 className="font-semibold">Обновления для {serviceId}</h4>
            <p className="text-gray-400">Здесь будет информация о последних запросах на  сервис.</p>
            <p className="text-gray-500">(Эта функция потребует API для получения истории обновлений.)</p>
            <ul className="list-disc list-inside bg-gray-700 p-2 rounded-md text-xs">
                <li><strong>v1.0.1</strong>: Minor bug fixes. Deployed on 2023-10-26.</li>
                <li><strong>v1.0.0</strong>: Initial release. Deployed on 2023-10-20.</li>
            </ul>
            <Button className="bg-purple-600 hover:bg-purple-700">Проверить обновления</Button>
        </div>
    );
};

export default ServiceHttp;
