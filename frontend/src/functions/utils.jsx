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
export function createReactFlowServiceNode(id, serviceType, position, name, projectId, serviceStatus) {
    return {
        id: id,
        position: position,
        type: 'serviceNode',
        data: {
            id: id, // Добавляем ID в data для удобства
            name: name || `${serviceType}-service`, // Используем переданное имя, если есть
            type: 'service', // Общий тип
            serviceType: serviceType, // Специфический тип сервиса
            status: serviceStatus, // Начальный статус
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
export function renderFileNodeForSidebar(node, depth = 0) {
    if (!node) return null;

    const indent = depth * 20;

    const nodeStyle = {
        marginLeft: `${indent}px`,
        padding: '5px',
        borderLeft: depth > 0 ? '1px solid #ccc' : 'none',
        marginBottom: '2px',
        backgroundColor: `rgba(255,255,255,${0.03 + depth * 0.01})`,
        borderRadius: '3px'
    };

    let icon = '📄';
    let typeText = node.type;
    let details = [];

    if (node.type === 'folder') {
        icon = '📁';
        typeText = 'Folder';
    } else if (node.type === 'service') {
        icon = '🚀';
        typeText = 'Service';
        if (node.serviceType) details.push(<div key="s-type"><strong>Type:</strong> {node.serviceType}</div>);
        if (node.status) details.push(<div key="s-status"><strong>Status:</strong> {node.status}</div>);
        if (node.position) details.push(
            <div key="s-pos"><strong>Position:</strong> ({node.position.x?.toFixed(0)}, {node.position.y?.toFixed(0)})</div>
        );
        if (node.version) details.push(<div key="s-version"><strong>Version:</strong> {node.version}</div>);
        if (node.volume) details.push(<div key="s-volume"><strong>Volume:</strong> {node.volume}</div>);
        if (node.projectId?.Valid) details.push(<div key="s-proj"><strong>Project ID:</strong> {node.projectId.Int64}</div>);
    } else if (node.type === 'repo') {
        icon = '📦';
        typeText = 'Repository';
        if (node.url) details.push(<div key="r-url"><strong>URL:</strong> {node.url}</div>);
        if (node.projectId?.Valid) details.push(<div key="r-proj"><strong>Project ID:</strong> {node.projectId.Int64}</div>);
    } else if (node.type === 'file') {
        typeText = 'File';
        if (node.size) details.push(<div key="f-size"><strong>Size:</strong> {node.size}</div>);
    }

    return (
        <div key={node.id} style={nodeStyle}>
            <span style={{ fontWeight: 'bold' }}>{icon} {node.name}</span>
            <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '5px' }}>[{typeText}]</span>
            {details.length > 0 && (
                <div style={{ fontSize: '0.85em', color: '#555', marginTop: '5px' }}>
                    {details}
                </div>
            )}
            {Array.isArray(node.children) && node.children.length > 0 && (
                <div style={{ paddingLeft: '10px' }}>
                    {node.children.map(child => renderFileNodeForSidebar(child, depth + 1))}
                </div>
            )}
        </div>
    );
}


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