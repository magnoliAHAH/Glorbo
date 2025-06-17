// src/utils.js
// Вспомогательные функции для преобразования данных и рендеринга сайдбара

/**
 * Рекурсивно преобразует древовидную структуру FileNode в узлы и рёбра React Flow.
 * Используется, в основном, для инициализации узлов на холсте (если это корневой репозиторий)
 * и для отображения всей структуры в сайдбаре.
 * Важно: эта функция создает узлы для ВСЕЙ структуры.
 */
export function convertFileNodeToReactFlowElements(fileNode, parentId = null, depth = 0, siblingIndex = 0) {
    const nodes = [];
    const edges = [];

    // Базовые координаты для упорядоченного размещения (если нет сохраненных позиций)
    const initialX = depth * 250;
    const initialY = siblingIndex * 100 + depth * 50;

    let position = { x: initialX, y: initialY };
    let nodeType = 'default';

    if (fileNode.type === 'service') {
        // Если у сервиса есть сохраненные позиции, используем их
        if (fileNode.position && fileNode.position.x != null && fileNode.position.y != null) {
            position = { x: fileNode.position.x, y: fileNode.position.y };
        }
        nodeType = 'serviceNode'; // Кастомный тип узла для сервисов
    } else if (fileNode.type === 'repo') {
        nodeType = 'repoNode';
        position = { x: 50, y: 50 }; // Фиксированная позиция для узла репозитория
    } else if (fileNode.type === 'folder') {
        nodeType = 'folderNode';
    } else if (fileNode.type === 'file') {
        nodeType = 'fileNode';
    }

    nodes.push({
        id: fileNode.id,
        position: position,
        type: nodeType,
        data: {
            name: fileNode.name,
            type: fileNode.type,
            ...fileNode, // Копируем все остальные свойства FileNode в data
            // Обработка projectId: если приходит как { Int64: ..., Valid: ... } из Go,
            // берем Int64. Если просто число, то берем его напрямую.
            // Если projectId уже число, то fileNode.projectId?.Int64 будет undefined,
            // и тогда возьмется fileNode.projectId.
            projectId: fileNode.projectId?.Int64 !== undefined ? fileNode.projectId.Int64 : fileNode.projectId,
        },
        // Узлы репозитория и сервисов должны быть перетаскиваемыми
        draggable: fileNode.type === 'service' || fileNode.type === 'repo',
    });

    if (parentId) {
        edges.push({
            id: `edge-${parentId}-${fileNode.id}`,
            source: parentId,
            target: fileNode.id,
            type: 'smoothstep',
            animated: fileNode.type === 'service', // Анимируем связи для сервисов
        });
    }

    // Рекурсивно обрабатываем дочерние узлы
    fileNode.children?.forEach((child, idx) => {
        const { nodes: childNodes, edges: childEdges } = convertFileNodeToReactFlowElements(child, fileNode.id, depth + 1, idx);
        nodes.push(...childNodes);
        edges.push(...childEdges);
    });

    return { nodes, edges };
}

/**
 * Создает новый узел React Flow для сервиса.
 * @param {string} id - Уникальный ID узла.
 * @param {string} serviceType - Тип сервиса (e.g., 'backend', 'authentication').
 * @param {object} position - Объект {x, y} для позиции узла.
 * @param {string} name - Имя сервиса.
 * @param {number} projectId - ID проекта, к которому принадлежит сервис.
 * @returns {object} Объект узла React Flow.
 */
export function createReactFlowServiceNode(id, serviceType, position, name, projectId) {
    return {
        id: id,
        position: position,
        type: 'serviceNode',
        data: {
            id: id, // Добавляем ID в data для удобства
            name: name || `${serviceType}-service`, // Используем переданное имя, если есть
            type: 'service', // Общий тип
            serviceType: serviceType, // Специфический тип сервиса
            status: 'pending', // Начальный статус
            volume: '',
            version: '',
            projectId: projectId, // Включаем ProjectID в данные узла
        },
        draggable: true, // Новый сервис должен быть перетаскиваемым
    };
}

/**
 * Рекурсивная функция для рендеринга файловой структуры для сайдбара.
 * @param {object} node - Текущий узел (FileNode) для рендеринга.
 * @param {number} depth - Текущая глубина в древовидной структуре.
 * @returns {JSX.Element | null} JSX-элемент для отображения узла и его дочерних элементов.
 */

/**
 * Вспомогательная функция для плоского отображения информации о сервисе (для сайдбара).
 * Используется, когда выбирается ServiceNode.
 * @param {object} serviceData - Данные сервиса для отображения.
 * @returns {JSX.Element} JSX-элемент с деталями сервиса.
 */
export function renderServiceInfoForSidebar(serviceData) {
    if (!serviceData) return <p>No service selected.</p>;

    return (
        <div>
            <h4>Service Details:</h4>
            <p><strong>ID:</strong> {serviceData.id || 'N/A'}</p>
            <p><strong>Name:</strong> {serviceData.name || 'N/A'}</p>
            <p><strong>Type:</strong> {serviceData.serviceType || 'N/A'}</p>
            <p><strong>Status:</strong> {serviceData.status || 'N/A'}</p>
            {serviceData.position && (
                <p><strong>Position:</strong> X: {serviceData.position.x?.toFixed(0)}, Y: {serviceData.position.y?.toFixed(0)}</p>
            )}
            {serviceData.version && <p><strong>Version:</strong> {serviceData.version}</p>}
            {serviceData.volume && <p><strong>Volume:</strong> {serviceData.volume}</p>}
            {serviceData.projectId && <p><strong>Project ID:</strong> {serviceData.projectId}</p>} {/* Отображаем projectId */}
            {/* Добавьте больше полей по необходимости */}
            
        </div>
    );
}
/**
 * Вспомогательная функция для рекурсивного обхода и нормализации узлов файловой структуры.
 * Преобразует поля ProjectID/projectId из sql.NullInt64 в число или null.
 * @param {object} node - Узел файловой структуры.
 * @returns {object} Нормализованная копия узла.
 */
const normalizeFileNodeData = (node) => {
    if (!node) return null;

    const newNode = { ...node };

    // Проверяем и нормализуем `ProjectID` (с заглавной буквы, как в Go JSON)
    if (newNode.ProjectID && typeof newNode.ProjectID === 'object' &&
        'Int64' in newNode.ProjectID && 'Valid' in newNode.ProjectID) {
        newNode.ProjectID = newNode.ProjectID.Valid ? newNode.ProjectID.Int64 : null;
    }
    // Проверяем и нормализуем `projectId` (в нижнем регистре, если используется camelCase)
    if (newNode.projectId && typeof newNode.projectId === 'object' &&
        'Int64' in newNode.projectId && 'Valid' in newNode.projectId) {
        newNode.projectId = newNode.projectId.Valid ? newNode.projectId.Int64 : null;
    }

    // Рекурсивно обрабатываем детей
    // ИЗМЕНЕНИЕ ЗДЕСЬ: Вызов самой себя normalizeFileNodeData(child), а не несуществующей recursivelyNormalizeFileNode
    if (newNode.Children && Array.isArray(newNode.Children)) {
        newNode.Children = newNode.Children.map(child => normalizeFileNodeData(child));
    }

    return newNode;
};
/**
 * Вспомогательная функция для рекурсивного отображения древовидной структуры репозитория в сайдбаре.
 * @param {object} node - Текущий узел (файл или папка).
 * @param {number} depth - Глубина вложенности для отступов.
 * @returns {JSX.Element | null} JSX-элемент для отображения узла.
 */
export function renderFileNodeForSidebar(node, depth = 0) {
    // ВАЖНО: Убедитесь, что данные node уже нормализованы перед вызовом этой функции
    // (это должно происходить в onNodeClick в DashboardForMain).
    // Тем не менее, добавим здесь оборонительную проверку на случай, если данные не были нормализованы.
    const normalizedNode = normalizeFileNodeData(node); // Повторная нормализация для безопасности

    if (!normalizedNode) return null;

    if (normalizedNode.Type === 'folder') { // Предполагаем, что поле типа - 'Type'
        return (
            <FolderItem key={normalizedNode.id} depth={depth}>
                📁 {normalizedNode.name}
                {normalizedNode.Children && (
                    <ul>
                        {normalizedNode.Children.map(child => renderFileNodeForSidebar(child, depth + 1))}
                    </ul>
                )}
            </FolderItem>
        );
    } else if (normalizedNode.Type === 'file') { // Предполагаем, что поле типа - 'Type'
        return (
            <FileItem key={normalizedNode.id} depth={depth}>
                📄 {normalizedNode.name}
                {/* Здесь вы можете отобразить ProjectID или projectId, если оно есть и уже нормализовано */}
                {/* Оборонительная проверка: если ProjectID/projectId все еще объект, отображаем Int64 */}
                {normalizedNode.ProjectID !== undefined && normalizedNode.ProjectID !== null && (
                    <span> (ProjectID: {
                        typeof normalizedNode.ProjectID === 'object' && 'Int64' in normalizedNode.ProjectID
                            ? normalizedNode.ProjectID.Int64
                            : normalizedNode.ProjectID
                    })</span>
                )}
                 {normalizedNode.projectId !== undefined && normalizedNode.projectId !== null && (
                    <span> (projectId: {
                        typeof normalizedNode.projectId === 'object' && 'Int64' in normalizedNode.projectId
                            ? normalizedNode.projectId.Int64
                            : normalizedNode.projectId
                    })</span>
                )}
            </FileItem>
        );
    }
    // Для узлов репозитория (корневой узел, переданный в sidebarContent.type === 'repo')
    else if (normalizedNode.type === 'repo') { // Используем 'type' из React Flow data
        return (
            <div>
                <h4>Репозиторий: {normalizedNode.name}</h4>
                <p>URL: {normalizedNode.URL || 'N/A'}</p> {/* <-- ИЗМЕНЕНО ЗДЕСЬ: node.url на node.URL */}
                {normalizedNode.projectId !== undefined && normalizedNode.projectId !== null && (
                    <p>ID Проекта: {
                        typeof normalizedNode.projectId === 'object' && 'Int64' in normalizedNode.projectId
                            ? normalizedNode.projectId.Int64
                            : normalizedNode.projectId
                    }</p>
                )}
                {/* Отображаем дочерние элементы репозитория */}
                {normalizedNode.Children && Array.isArray(normalizedNode.Children) && (
                    <ul>
                        {normalizedNode.Children.map(child => renderFileNodeForSidebar(child, depth + 1))}
                    </ul>
                )}
            </div>
        );
    }
    return null; // Если тип узла неизвестен
}