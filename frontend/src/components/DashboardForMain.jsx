import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Panel,
} from 'reactflow';
import 'reactflow/dist/style.css'; // Обязательно импортируйте стили React Flow

// Импортируем функции API и утилиты
import { createService, updateNodePosition, createAuthService } from '../functions/api/api';
import { createReactFlowServiceNode, renderFileNodeForSidebar, renderServiceInfoForSidebar, convertFileNodeToReactFlowElements } from '../functions/utils';

// --- Styled Components ---

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Page = styled.div`
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: 'Arial', sans-serif;
    background-color: #f0f2f5;
    overflow: hidden; /* Предотвращает прокрутку всей страницы */
`;

const Header = styled.header`
    background-color: #282c34;
    color: white;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 1000;
`;

const Title = styled.h1`
    margin: 0;
    font-size: 1.8em;
    color: #61dafb;
`;

const SwitchButton = styled.button`
    background-color: #61dafb;
    color: #282c34;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
    font-weight: bold;
    transition: background-color 0.3s ease;

    &:hover {
        background-color: #21a1f1;
    }
`;

const Content = styled.main`
    flex-grow: 1;
    display: flex;
    position: relative; /* Для позиционирования GraphWrapper */
`;

const GraphWrapper = styled.div`
    flex-grow: 1;
    height: 100%;
    position: relative; /* Чтобы ReactFlow занимал всю доступную высоту */
`;

const Spinner = styled.div`
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #61dafb;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

const Message = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: ${props => props.error ? 'red' : 'green'};
    font-size: 1.2em;
`;

const ContextMenuWrapper = styled.div`
    position: absolute;
    background: white;
    border: 1px solid #ddd;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    padding: 5px 0;
    animation: ${fadeIn} 0.1s ease-out;
`;

const ContextMenuItem = styled.div`
    padding: 8px 15px;
    cursor: pointer;
    &:hover {
        background-color: #f0f0f0;
    }
`;

// --- Custom Nodes for React Flow ---

const StyledNode = styled.div`
    padding: 10px 15px;
    border-radius: 5px;
    font-weight: bold;
    text-align: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    border: 1px solid;
    cursor: grab; /* Изменен курсор для перетаскивания */
`;

const RepoNodeContainer = styled(StyledNode)`
    background-color: #e0f7fa;
    border-color: #00bcd4;
    color: #006064;
    width: auto; /* Автоматическая ширина по содержимому */
    min-width: 150px; /* Минимальная ширина */
    display: inline-block; /* Позволяет содержимому определять ширину */
    white-space: nowrap; /* Предотвращает перенос текста */
    padding: 15px 25px; /* Увеличили отступы */
    font-size: 1.1em; /* Увеличили шрифт */
`;

const ServiceNodeContainer = styled(StyledNode)`
    background-color: ${props => {
        switch (props.serviceType) {
            case 'backend': return '#ffe0b2';
            case 'frontend': return '#c8e6c9';
            case 'database': return '#bbdefb';
            case 'redis': return '#ffccbc';
            case 'auth': return '#e1bee7'; // Общий тип "auth"
            case 'authentication': return '#d1c4e9'; // Специфический тип "authentication"
            case 'nginx': return '#f5f5dc';
            case 'message-queue': return '#ffcdd2';
            default: return '#f5f5f5';
        }
    }};
    border-color: ${props => {
        switch (props.serviceType) {
            case 'backend': return '#ff9800';
            case 'frontend': return '#4caf50';
            case 'database': return '#2196f3';
            case 'redis': return '#ff5722';
            case 'auth': return '#9c27b0';
            case 'authentication': return '#673ab7';
            case 'nginx': return '#cddc39';
            case 'message-queue': return '#ef5350';
            default: return '#cccccc';
        }
    }};
    color: #333;
    font-size: 0.9em;
`;

const RepoNode = ({ data }) => (
    <RepoNodeContainer>
        📦 {data.name || 'Repository'}
    </RepoNodeContainer>
);

const ServiceNode = ({ data }) => (
    <ServiceNodeContainer serviceType={data.serviceType}>
        ⚙️ {data.name || 'Service'} ({data.serviceType})
    </ServiceNodeContainer>
);

const nodeTypes = {
    repoNode: RepoNode,
    serviceNode: ServiceNode,
};

// --- Sidebar Components ---

const SidebarWrapper = styled.div`
    width: ${props => (props.isOpen ? '350px' : '0')};
    background-color: #fff;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: width 0.3s ease-in-out;
    display: flex;
    flex-direction: column;
    z-index: 999; /* Выше GraphWrapper, но ниже Header */
`;

const SidebarHeader = styled.div`
    padding: 15px 20px;
    background-color: #f8f9fa;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
    h3 {
        margin: 0;
        color: #333;
    }
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
    color: #666;
    &:hover {
        color: #333;
    }
`;

const SidebarContent = styled.div`
    flex-grow: 1;
    padding: 20px;
    overflow-y: auto;
    font-size: 0.9em;
    color: #555;

    pre {
        background-color: #f4f4f4;
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
    }

    ul {
        list-style: none;
        padding: 0;
    }

    li {
        margin-bottom: 5px;
    }
`;

const AddServiceButton = styled.button`
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.9em;
    margin-top: 20px;
    width: 100%;
    &:hover {
        background: #0056b3;
    }
`;

const RepoOrServiceDetailsSidebar = ({ isOpen, content, onClose, onAddAuthService }) => {
    return (
        <SidebarWrapper isOpen={isOpen}>
            <SidebarHeader>
                <h3>{content?.type === 'repo' ? 'Repository Structure' : 'Service Details'}</h3>
                <CloseButton onClick={onClose}>X</CloseButton>
            </SidebarHeader>
            <SidebarContent>
                {content ? (
                    content.type === 'repo' ? (
                        <>
                            {renderFileNodeForSidebar(content)}
                            {/* НОВАЯ КНОПКА ДЛЯ ДОБАВЛЕНИЯ AUTH SERVICE */}
                            <AddServiceButton onClick={() => onAddAuthService(content.id)}>
                                + Add Authentication Service
                            </AddServiceButton>
                        </>
                    ) : (
                        renderServiceInfoForSidebar(content)
                    )
                ) : (
                    <p>Select a node to view its details.</p>
                )}
            </SidebarContent>
        </SidebarWrapper>
    );
};


// --- Context Menu Component ---

const ContextMenu = ({ x, y, onCreateService, onClose }) => {
    // ИЗМЕНЕНИЕ: Убрали 'auth' из списка, так как для него будет отдельная кнопка в сайдбаре
    const serviceTypes = ['backend', 'frontend', 'database', 'redis', 'nginx', 'message-queue'];

    return (
        <ContextMenuWrapper style={{ left: x, top: y }} onMouseLeave={onClose}>
            {serviceTypes.map(type => (
                <ContextMenuItem key={type} onClick={() => { onCreateService(type); onClose(); }}>
                    Create {type}
                </ContextMenuItem>
            ))}
        </ContextMenuWrapper>
    );
};


// --- Main Dashboard Component ---

const DashboardForMain = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentRepoUrl, setCurrentRepoUrl] = useState('');
    const [structure, setStructure] = useState(null); // Здесь будет храниться вся структура репо
    const [contextMenu, setContextMenu] = useState(null); // Состояние для контекстного меню
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarContent, setSidebarContent] = useState(null); // Содержимое сайдбара

    const location = useLocation();
    const navigate = useNavigate();

    // Загрузка структуры репозитория при монтировании
    useEffect(() => {
        const repoFromStorage = localStorage.getItem('repo');
        if (!repoFromStorage) {
            navigate('/projects');
            return;
        }
        setCurrentRepoUrl(repoFromStorage);

        const fetchRepoStructure = async () => {
            setLoading(true);
            setError(null);
            try {
                // Извлекаем имя проекта из URL (для запроса к бэкенду)
                const repoName = repoFromStorage.split('/').pop();
                if (!repoName) {
                    throw new Error("Invalid repository URL in local storage.");
                }

                const response = await fetch(`/api/repo-tree?repoName=${encodeURIComponent(repoName)}`, {
                    credentials: 'include' // Это важно для отправки куки с токеном
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        navigate('/login');
                        return;
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                const fetchedStructure = await response.json();
                setStructure(fetchedStructure); // Сохраняем всю структуру

                // Преобразуем структуру в узлы и ребра для React Flow
                const { nodes: initialNodes, edges: initialEdges } = convertFileNodeToReactFlowElements(fetchedStructure);
                setNodes(initialNodes);
                setEdges(initialEdges);

            } catch (err) {
                console.error("Failed to fetch repository structure:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRepoStructure();
    }, [navigate]);


    // Обработчик для создания нового сервиса (вызывается из контекстного меню)
    const handleCreateService = useCallback(async (serviceType) => {
        // ИЗМЕНЕНИЕ 1: Проверяем, что структура и её имя доступны
        if (!structure || !structure.name) {
            alert('Project name not found from loaded structure. Cannot create service.');
            return;
        }

        const position = { x: contextMenu.x, y: contextMenu.y };

        try {
            // ИЗМЕНЕНИЕ 2: Замените currentRepoName на structure.name
            const result = await createService(structure.name, serviceType, position);
            alert(`Service created: ${result.serviceId}`);

            const newNode = createReactFlowServiceNode(result.serviceId, serviceType, position, result.name);
            setNodes((prevNodes) => [...prevNodes, newNode]);

        } catch (error) {
            console.error('Failed to create service:', error.message);
            alert(`Failed to create service: ${error.message}`);
        }
        // ИЗМЕНЕНИЕ 3: Добавьте 'structure' в массив зависимостей useCallback
    }, [structure, contextMenu, setNodes]);


    // НОВЫЙ ОБРАБОТЧИК: Создание специфического сервиса аутентификации (вызывается из сайдбара)
    const handleAddAuthService = useCallback(async (projectId) => {
        const appName = prompt('Enter a name for the authentication service (e.g., "Google Auth", "Auth0"):');
        if (!appName) {
            alert('Authentication service name cannot be empty.');
            return;
        }

        try {
            const result = await createAuthService(projectId, appName);
            alert(`Authentication service "${appName}" created with ID: ${result.authServiceId}`);
            console.log('Created Auth Service:', result);

            // Опционально: если вы хотите добавить узел для этого auth-сервиса на холст React Flow
            // ID для нового узла может быть уникальным (например, 'auth-service-' + result.authServiceId)
            // Позицию можно взять из sidebarContent.position (позиция репо-узла)
            const newNodeId = `auth-service-${result.authServiceId}`;
            const newNodePosition = { x: (sidebarContent?.position?.x || 50) + 200, y: (sidebarContent?.position?.y || 50) + 100 };
            
            const newAuthServiceNode = {
                id: newNodeId,
                position: newNodePosition,
                type: 'serviceNode', // Используем существующий тип serviceNode
                data: {
                    id: result.authServiceId,
                    name: appName,
                    serviceType: 'authentication', // Укажите, что это специфический тип auth
                    status: 'Active', // Или другой статус по умолчанию
                    projectId: projectId,
                },
                draggable: true,
            };
            setNodes((prevNodes) => [...prevNodes, newAuthServiceNode]);

        } catch (error) {
            console.error('Failed to create authentication service:', error.message);
            alert(`Failed to create authentication service: ${error.message}`);
        }
    }, [setNodes, sidebarContent]);


    // Обработчик соединения ребер
    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    // Обработчик перетаскивания узлов
    const onNodeDragStop = useCallback(async (event, node) => {
        // ИЗМЕНЕНИЕ: Используем structure.name, если доступно, иначе currentRepoUrl.split('/').pop()
        const projectNameForUpdate = structure?.name || currentRepoUrl?.split('/').pop();

        if ((node.type === 'repoNode' || node.type === 'serviceNode') && projectNameForUpdate) {
            try {
                await updateNodePosition(node.id, node.position, projectNameForUpdate);
                console.log(`Updated position for node ${node.id}`);
            } catch (error) {
                console.error(`Failed to update position for node ${node.id}:`, error.message);
            }
        }
        // ИЗМЕНЕНИЕ: Добавляем structure и currentRepoUrl в зависимости
    }, [structure, currentRepoUrl]);

    // Обработчик клика по узлу (для открытия сайдбара)
    const onNodeClick = useCallback((event, node) => {
        setIsSidebarOpen(true);
        // Сохраняем не только id и type, но и всю data узла, и его позицию
        setSidebarContent({
            id: node.id,
            type: node.type === 'repoNode' ? 'repo' : 'service',
            data: node.data,
            position: node.position, // Добавляем позицию узла
            // Если это RepoNode, то передаем структуру файлов для отображения
            ...(node.type === 'repoNode' && structure ? { fileStructure: structure.files } : {})
        });
    }, [structure]);


    // Обработчик ПКМ по фону (для открытия контекстного меню)
    const onPaneContextMenu = useCallback((event) => {
        event.preventDefault(); // Предотвращаем стандартное контекстное меню браузера
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
        });
    }, []);

    // Обработчик смены репозитория
    const handleChangeRepo = () => {
        localStorage.removeItem('repo');
        navigate('/projects');
    };

    return (
        <Page>
            <Header>
                <Title>📊 Dashboard проекта</Title>
                <SwitchButton onClick={handleChangeRepo}>Сменить репозиторий</SwitchButton>
            </Header>

            <Content>
                {loading && <Spinner />}
                {error && <Message error>{error}</Message>}
                {!loading && !error && (
                    <GraphWrapper>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeDragStop={onNodeDragStop}
                            onNodeClick={onNodeClick}
                            onPaneContextMenu={onPaneContextMenu} // Обработчик ПКМ по фону
                            nodeTypes={nodeTypes} // Передаем кастомные узлы
                            fitView // Автоматически центрировать и масштабировать схему
                            attributionPosition="bottom-left"
                        >
                            <MiniMap />
                            <Controls />
                            <Background variant="dots" gap={12} size={1} />
                            <Panel position="top-right">
                                {structure && structure.name && <div>Current Repo: <strong>{structure.name}</strong></div>}
                            </Panel>
                        </ReactFlow>

                        {contextMenu && (
                            <ContextMenu
                                x={contextMenu.x}
                                y={contextMenu.y}
                                onCreateService={handleCreateService} // Для общих сервисов
                                onClose={() => setContextMenu(null)} // Закрыть меню
                            />
                        )}
                    </GraphWrapper>
                )}
            </Content>

            <RepoOrServiceDetailsSidebar
                isOpen={isSidebarOpen}
                content={sidebarContent}
                onClose={() => setIsSidebarOpen(false)}
                onAddAuthService={handleAddAuthService} // ПЕРЕДАЕМ НОВУЮ ФУНКЦИЮ ДЛЯ AUTH-СЕРВИСОВ
            />
        </Page>
    );
};

export default DashboardForMain;