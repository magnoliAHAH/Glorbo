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

// Импортируем функции API и утилиты
import { createService, updateNodePosition } from '../functions/api/api'; // getRepoTree не нужен напрямую, т.к. вы уже фечите структуру
import { createReactFlowServiceNode, renderFileNodeForSidebar, renderServiceInfoForSidebar } from '../functions/utils';

// --- Кастомные узлы React Flow с styled-components ---

const StyledNode = styled.div`
    padding: 10px;
    border-radius: 8px;
    font-size: 0.9em;
    text-align: center;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    cursor: grab;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-width: 150px;
    min-height: 60px;
    transition: box-shadow 0.2s ease, transform 0.1s ease;

    &:active {
        cursor: grabbing;
        box-shadow: 0 6px 15px rgba(0,0,0,0.2);
        transform: translateY(-2px);
    }
    &:hover {
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    }
`;

const RepoNodeContainer = styled(StyledNode)`
    background-color: #e0f7fa; /* Легкий циан */
    border: 2px solid #00bcd4; /* Цвет циан */
    color: #00796b;
    cursor: pointer; /* Курсор для кликабельности */
    &:hover {
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        transform: scale(1.02);
    }
`;

const ServiceNodeContainer = styled(StyledNode)`
    background-color: #e8f5e9; /* Светло-зеленый */
    border: 2px solid #4caf50; /* Зеленый */
    color: #2e7d32;
`;

const RepoNode = ({ data, onClick }) => (
    <RepoNodeContainer onClick={onClick}>
        📦 <strong>{data.name}</strong> <br/>
        <small>({data.type.toUpperCase()})</small>
    </RepoNodeContainer>
);

const ServiceNode = ({ data }) => (
    <ServiceNodeContainer>
        🚀 <strong>{data.name}</strong> <br/>
        <small>Type: {data.serviceType || 'N/A'}</small> <br/>
        <small>Status: {data.status || 'N/A'}</small>
    </ServiceNodeContainer>
);

const nodeTypes = {
    repoNode: RepoNode,
    serviceNode: ServiceNode,
    // Если вам нужны другие узлы (folder, file) на канвасе изначально,
    // вы можете добавить их здесь и стилизовать
};

// --- Боковое меню (Sidebar) с styled-components ---

const SidebarWrapper = styled.div`
    position: absolute;
    top: 0;
    right: 0;
    width: ${({ isOpen }) => (isOpen ? '400px' : '0')};
    height: 100%;
    background-color: #fff;
    box-shadow: -4px 0 15px rgba(0, 0, 0, 0.2);
    transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    overflow-x: hidden;
    overflow-y: auto;
    z-index: 200;
    display: flex;
    flex-direction: column;
    padding: ${({ isOpen }) => (isOpen ? '20px' : '0')};
    box-sizing: border-box; /* Важно для padding */
`;

const SidebarHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
    margin-bottom: 15px;
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
    color: #888;
    transition: color 0.2s ease;
    &:hover {
        color: #333;
    }
`;

const SidebarContent = styled.div`
    flex-grow: 1;
    color: #333;
`;

const RepoOrServiceDetailsSidebar = ({ isOpen, content, onClose }) => {
    return (
        <SidebarWrapper isOpen={isOpen}>
            <SidebarHeader>
                <h3>{content?.type === 'repo' ? 'Repository Structure' : 'Service Details'}</h3>
                <CloseButton onClick={onClose}>X</CloseButton>
            </SidebarHeader>
            <SidebarContent>
                {content ? (
                    content.type === 'repo' ? (
                        renderFileNodeForSidebar(content) // Для репозитория рендерим дерево
                    ) : (
                        renderServiceInfoForSidebar(content) // Для сервиса рендерим плоскую инфу
                    )
                ) : (
                    <p>Select a node to view its details.</p>
                )}
            </SidebarContent>
        </SidebarWrapper>
    );
};

// --- Контекстное меню (ПКМ) с styled-components ---

const ContextMenuWrapper = styled.div`
    position: absolute;
    z-index: 1000;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 5px 0;
`;

const ContextMenuItem = styled.div`
    padding: 8px 15px;
    cursor: pointer;
    font-size: 0.9em;
    color: #333;

    &:hover {
        background: #f0f0f0;
    }
`;

const ContextMenu = ({ x, y, onCreateService, onClose }) => {
    const serviceTypes = ['backend', 'frontend', 'database', 'redis', 'auth', 'nginx', 'message-queue'];

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

// --- Основной компонент DashboardRepo ---

const DashboardForMain = () => {
    const [structure, setStructure] = useState(null); // Полная структура репо из API
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Состояния React Flow
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    // Состояния сайдбара
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarContent, setSidebarContent] = useState(null); // Данные для сайдбара

    // Состояния контекстного меню
    const [contextMenu, setContextMenu] = useState(null);

    const location = useLocation();
    const navigate = useNavigate();
    const currentRepoName = localStorage.getItem('repo'); // Получаем имя репозитория

    // --- Загрузка структуры репозитория при монтировании ---
    useEffect(() => {
        if (!currentRepoName) {
            navigate('/projects');
            return;
        }

        setLoading(true);
        setError(null);

        // Используем ваш существующий fetch для структуры репозитория
        fetch(`https://mixail.ermin33.fvds.ru/api/repo-tree?repo=${encodeURIComponent(currentRepoName)}`)
            .then(async res => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || `Ошибка ${res.status}`);
                return data;
            })
            .then(fetchedStructure => {
                setStructure(fetchedStructure); // Сохраняем полную структуру

                // Инициализируем React Flow только узлом репозитория
                const repoNodeId = fetchedStructure.id;
                const repoNodeName = fetchedStructure.name || currentRepoName.split('/').pop();
                const initialNodes = [{
                    id: repoNodeId,
                    position: { x: 50, y: 50 }, // Фиксированная начальная позиция
                    type: 'repoNode',
                    data: {
                        id: repoNodeId,
                        name: repoNodeName,
                        type: 'repo',
                        URL: currentRepoName,
                        ...fetchedStructure // Передаем все данные из структуры в узел
                    },
                    draggable: true,
                }];

                // Добавляем уже существующие сервисы на холст при загрузке
                const { nodes: serviceNodes } = convertFileNodeToReactFlowElements(fetchedStructure);
                const existingServiceNodes = serviceNodes.filter(n => n.type === 'serviceNode');

                setNodes([...initialNodes, ...existingServiceNodes]);
                setEdges([]); // Пока нет рёбер, если только репозиторий и сервисы
            })
            .catch(err => {
                console.error('Error fetching structure:', err);
                setError(err.message);
                setNodes([]); // Очищаем узлы при ошибке
            })
            .finally(() => setLoading(false));
    }, [currentRepoName, navigate]);


    // --- Обработчики React Flow ---

    // Обработчик перетаскивания узлов
    const onNodeDragStop = useCallback(async (event, node) => {
        if ((node.type === 'repoNode' || node.type === 'serviceNode') && currentRepoName) {
            try {
                await updateNodePosition(node.id, node.position, currentRepoName);
                console.log(`Updated position for node ${node.id}`);
            } catch (error) {
                console.error(`Failed to update position for node ${node.id}:`, error.message);
            }
        }
    }, [currentRepoName]);

    // Обработчик клика по узлу (ЛКМ)
    const onNodeClick = useCallback((event, node) => {
        setIsSidebarOpen(true); // Открываем сайдбар

        if (node.type === 'repoNode' && structure) {
            setSidebarContent(structure); // Для репозитория показываем всю структуру
        } else if (node.type === 'serviceNode') {
            setSidebarContent(node.data); // Для сервиса показываем его данные
        } else {
            setSidebarContent(null); // Для других узлов, если они появятся, можно очистить
            console.log('Clicked non-special node:', node);
        }
    }, [structure]);

    // Обработчик правого клика по фону холста (ПКМ)
    const onPaneContextMenu = useCallback((event) => {
        event.preventDefault(); // Предотвращаем стандартное контекстное меню браузера
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
        });
    }, [setContextMenu]);

    // Обработчик для создания нового сервиса (вызывается из контекстного меню)
    const handleCreateService = useCallback(async (serviceType) => {
        if (!currentRepoName) {
            alert('Repository name not found. Cannot create service.');
            return;
        }

        // Позиция нового сервиса - там, где был сделан правый клик
        const position = { x: contextMenu.x, y: contextMenu.y };

        try {
            const result = await createService(currentRepoName, serviceType, position);
            alert(`Service created: ${result.serviceId}`);

            // Добавляем новый узел сервиса на холст React Flow
            const newNode = createReactFlowServiceNode(result.serviceId, serviceType, position);
            setNodes((prevNodes) => [...prevNodes, newNode]);

        } catch (error) {
            console.error('Failed to create service:', error.message);
            alert(`Failed to create service: ${error.message}`);
        }
    }, [currentRepoName, contextMenu, setNodes]);


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
                                {currentRepoName && <div>Current Repo: <strong>{currentRepoName.split('/').pop()}</strong></div>}
                            </Panel>
                        </ReactFlow>

                        {contextMenu && (
                            <ContextMenu
                                x={contextMenu.x}
                                y={contextMenu.y}
                                onCreateService={handleCreateService}
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
            />
        </Page>
    );
};

export default DashboardForMain;

/* --- СТИЛИ --- */

const fade = keyframes`
  0% { opacity: 0.2; }
  50% { opacity: 0.6; }
  100% { opacity: 0.2; }
`;

const Page = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  background-color: #f5f7fa; /* Светлый фон */
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  z-index: 10; /* Убедимся, что хедер поверх */
`;

const Title = styled.h2`
  font-size: 1.8rem;
  color: #333;
  margin: 0;
`;

const SwitchButton = styled.button`
  background: #3070f0;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s ease, transform 0.1s ease;

  &:hover {
    background: #2554c7;
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
`;

const Content = styled.div`
  flex-grow: 1; /* Занимает всё доступное пространство */
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative; /* Для позиционирования ReactFlow */
  overflow: hidden; /* Скрыть возможные переполнения */
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #ddd;
  border-top-color: #3070f0;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  position: absolute; /* Чтобы не мешал React Flow */
  z-index: 5; /* Поверх React Flow, но под контекстным меню */
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const Message = styled.p`
  font-size: 1rem;
  color: ${({ error }) => (error ? 'crimson' : '#555')};
  position: absolute;
  z-index: 5;
`;

const GraphWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative; /* Важно для ReactFlow */
  background: #fafafa;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden; /* Чтобы ReactFlow не вылезал за границы */
`;