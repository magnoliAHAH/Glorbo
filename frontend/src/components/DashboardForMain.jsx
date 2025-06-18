import React, { useEffect, useState, useCallback } from 'react';
import {useNavigate } from 'react-router-dom';
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
import 'reactflow/dist/style.css';

import MessageBox from './MessageBox';

// Импорты API и утилит
import { createService, updateNodePosition, getRepoTree, createAuthService, getProjectServices, deleteService, createPodAndService, runProjectTask } from '../functions/api/api';
import { createReactFlowServiceNode, renderFileNodeForSidebar, renderServiceInfoForSidebar, convertFileNodeToReactFlowElements } from '../functions/utils';

// --- Styled Components --- (без изменений)
const fadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
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

// --- Custom Nodes for React Flow --- (без изменений)
const StyledNode = styled.div`
    padding: 10px 15px;
    border-radius: 5px;
    font-weight: bold;
    text-align: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    border: 1px solid;
    cursor: grab;
`;

const RepoNodeContainer = styled(StyledNode)`
    background-color: #e0f7fa;
    border-color: #00bcd4;
    color: #006064;
    width: auto;
    min-width: 150px;
    display: inline-block;
    white-space: nowrap;
    padding: 15px 25px;
    font-size: 1.1em;
`;

const ServiceNodeContainer = styled(StyledNode)`
    background-color: ${props => {
        switch (props.serviceType) {
            case 'backend': return '#ffe0b2';
            case 'frontend': return '#c8e6c9';
            case 'database': return '#bbdefb';
            case 'redis': return '#ffccbc';
            case 'auth':
            case 'authentication': return '#e1bee7';
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
            case 'auth':
            case 'authentication': return '#9c27b0';
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
      <div>⚙️ {data.name || 'Service'}</div>
      <StatusText>{data.status || 'unknown'}</StatusText>
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
    z-index: 999;
    /* !!! ИЗМЕНЕНИЕ: Позиционирование сайдбара */
    position: absolute; /* Делаем его абсолютно позиционированным */
    right: 0;           /* Прикрепляем к правой стороне */
    top: 0;             /* Прикрепляем к верху */
    bottom: 0;          /* Растягиваем на всю высоту */
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

const RepoOrServiceDetailsSidebar = ({ isOpen, content, onClose, onDeleteNode }) => {
    const isServiceNode = content?.type === 'serviceNode'|| content?.type === 'service';

    const handleDeleteClick = () => {
        // Убедимся, что это serviceNode и что есть onDeleteNode проп и необходимые данные
        if (isServiceNode && onDeleteNode && content?.id && typeof content?.projectId === 'number') {
            // Опционально: добавить подтверждение пользователя перед удалением
            if (window.confirm(`Вы уверены, что хотите удалить сервис "${content.name || content.id}"?`)) {
                onDeleteNode(content.id, content.projectId);
            }
        } else {
            console.warn('Attempted to delete a node that is not a serviceNode or is missing ID/ProjectID.', content);
        }
    };
    return (
        <SidebarWrapper isOpen={isOpen}>
            <SidebarHeader>
                <h3>{content?.type === 'repo' ? 'Repository Structure' : 'Service Details'}</h3>
                <CloseButton onClick={onClose}>X</CloseButton>
            </SidebarHeader>
            <SidebarContent>
                {content ? (
                    content.type === 'repo' ? (
                        // !!! ИЗМЕНЕНИЕ: Убедимся, что renderFileNodeForSidebar правильно обрабатывает URL
                        // content уже содержит URL, переданный из DashboardForMain.jsx
                        renderFileNodeForSidebar(content)
                    ) : (
                        renderServiceInfoForSidebar(content)
                    )
                ) : (
                    <p>Select a node to view its details.</p>
                )}
                <DeleteButton onClick={handleDeleteClick}>Удалить сервис</DeleteButton>
            </SidebarContent>
        </SidebarWrapper>
    );
};


// --- Context Menu Component --- (без изменений)
const ContextMenu = ({ x, y, onCreateService, onClose }) => {
    const serviceTypes = ['backend', 'frontend', 'database', 'redis', 'authentication', 'nginx', 'message-queue'];

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
    const [structure, setStructure] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentProjectId, setCurrentProjectId] = useState(null);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarContent, setSidebarContent] = useState(null);

    const [contextMenu, setContextMenu] = useState(null);

    const [showMessageBox, setShowMessageBox] = useState(null);

    const navigate = useNavigate();
    const currentRepoUrl = localStorage.getItem('repo');

    // !!! ИЗМЕНЕНИЕ 1: useEffect для чтения projectId из localStorage
    // Убедимся, что projectId установлен перед загрузкой repoTree
    useEffect(() => {
        const storedProjectId = localStorage.getItem('projectId');
        if (storedProjectId) {
            const parsedProjectId = Number(storedProjectId);
            // Убедимся, что projectId является валидным положительным числом
            if (!isNaN(parsedProjectId) && parsedProjectId > 0) {
                setCurrentProjectId(parsedProjectId);
            } else {
                console.warn('Invalid Project ID found in localStorage:', storedProjectId, '. Redirecting to projects.');
                navigate('/projects');
            }
        } else {
            console.warn('Project ID not found in localStorage! Redirecting to projects.');
            navigate('/projects');
        }
    }, [navigate]);

    // !!! ИЗМЕНЕНИЕ 2: Загрузка структуры репозитория зависит от currentProjectId
    useEffect(() => {
        if (!currentRepoUrl) {
          navigate('/projects');
          return;
        }
        if (typeof currentProjectId !== 'number' || currentProjectId <= 0) {
          console.log('Waiting for valid currentProjectId. Current:', currentProjectId);
          return;
        }
      
        setLoading(true);
        setError(null);
      
        // Шаг 1: получить дерево репозитория
        getRepoTree(currentRepoUrl)
          .then(fetchedStructure => {
            console.log('Fetched structure:', fetchedStructure);
            setStructure(fetchedStructure);
      
            // Собираем узел репозитория
            const repoNode = {
              id: fetchedStructure.id,
              position: { x: 50, y: 50 },
              type: 'repoNode',
              data: {
                id: fetchedStructure.id,
                name: fetchedStructure.name || currentRepoUrl.split('/').pop(),
                type: 'repo',
                URL: currentRepoUrl,
                projectId: currentProjectId,
              },
              draggable: true,
            };
      
            // Параллельно запрашиваем список сервисов
            return Promise.all([
              Promise.resolve(repoNode),
              Promise.resolve(convertFileNodeToReactFlowElements(fetchedStructure)),
              getProjectServices(currentProjectId)
            ]);
          })
          .then(([repoNode, { nodes: fileNodes = [], edges: fileEdges = [] }, services]) => {
            // Преобразуем сервисы из API в узлы
            const filteredFileServiceNodes = fileNodes.filter(n => n.type === 'serviceNode');
            const serviceNodes = services.map(svc =>
              createReactFlowServiceNode(
                svc.id,
                svc.type,
                { x: svc.positionX, y: svc.positionY },
                svc.name,
                svc.projectId
              )
            );
      
            // Собираем итоговый набор узлов
            setNodes([
              repoNode,
              ...filteredFileServiceNodes,
              ...serviceNodes
            ]);
      
            // Сбрасываем рёбра
            setEdges(fileEdges);
          })
          .catch(err => {
            console.error('Error fetching dashboard data:', err);
            setError(err.message || 'Unknown error');
            setNodes([]);
            setEdges([]);
          })
          .finally(() => {
            setLoading(false);
          });
      }, [currentRepoUrl, currentProjectId, navigate, setNodes, setEdges, setStructure]);
      

    // Обработчик перетаскивания узлов
    const onNodeDragStop = useCallback(async (event, node) => {
        console.log('onNodeDragStop called for node:', node.id, 'with currentProjectId:', currentProjectId, 'and type:', node.type); // ДОБАВЛЕНО ЛОГИРОВАНИЕ ТИПА
    
        if (typeof currentProjectId !== 'number' || currentProjectId <= 0) {
            console.warn('Cannot update node position: currentProjectId is not valid. Not sending update.');
            return;
        }
    
        // !!! ГЛАВНОЕ ИЗМЕНЕНИЕ: Отправляем только для SERVICE NODES !!!
        if (node.type === 'serviceNode') { // <--- ИЗМЕНЕНО С "repoNode || serviceNode"
            try {
                console.log(`Attempting to update position for service node ${node.id} to {x: ${node.position.x}, y: ${node.position.y}} in project ${currentProjectId}`);
                await updateNodePosition(node.id, node.position, currentProjectId);
                console.log(`Successfully updated position for service node ${node.id}`);
            } catch (error) {
                console.error(`Failed to update position for service node ${node.id}:`, error.message);
                alert(`Failed to update position for service node ${node.id}: ${error.message}`);
            }
        } else {
            console.log(`Node type ${node.type} is not a service node. Position not saved.`);
            // Если вы хотите сохранять позиции repoNode,
            // вам потребуется отдельная таблица/поле в таблице 'projects'
            // и отдельный API-эндпоинт для этого.
        }
    }, [currentProjectId]);

    const handleDeleteNode = useCallback(async (serviceId, projectId) => {
        try {
          console.log(`Попытка удалить сервис ${serviceId} из проекта ${projectId}`);
          await deleteService(serviceId, projectId);
          alert(`Сервис ${serviceId} успешно удален.`);
          console.log(`Сервис ${serviceId} успешно удален.`);
      
          // Удаляем из React Flow любой узел с этим id:
          setNodes(prev => prev.filter(node => node.id !== serviceId));
      
          setIsSidebarOpen(false);
          setSidebarContent(null);
        } catch (error) {
          console.error(`Не удалось удалить сервис ${serviceId}:`, error.message);
          alert(`Не удалось удалить сервис ${serviceId}: ${error.message}`);
        }
      }, [setNodes]);
      
      const recursivelyNormalizeFileNode = (node) => {
        if (!node) return null;
    
        const newNode = { ...node };
    
        // Check for `ProjectID` (Go's exported field name)
        if (newNode.ProjectID && typeof newNode.ProjectID === 'object' &&
            'Int64' in newNode.ProjectID && 'Valid' in newNode.ProjectID) {
            newNode.ProjectID = newNode.ProjectID.Valid ? newNode.ProjectID.Int64 : null;
        }
        // Check for `projectId` (common JavaScript camelCase)
        if (newNode.projectId && typeof newNode.projectId === 'object' &&
            'Int64' in newNode.projectId && 'Valid' in newNode.projectId) {
            newNode.projectId = newNode.projectId.Valid ? newNode.projectId.Int64 : null;
        }
    
        // Recursively process children
        if (newNode.Children && Array.isArray(newNode.Children)) {
            newNode.Children = newNode.Children.map(child => recursivelyNormalizeFileNode(child));
        }
    
        return newNode;
    };

    // Обработчик клика по узлу (ЛКМ)
    const onNodeClick = useCallback((event, node) => {
    setIsSidebarOpen(true);

    if (node.type === 'repoNode' && structure) {
        // Применяем рекурсивную нормализацию ко всей структуре перед передачей в sidebarContent
        const fullyNormalizedStructure = recursivelyNormalizeFileNode(structure);
        setSidebarContent({ type: 'repo', ...fullyNormalizedStructure, URL: node.data.URL });
    } else if (node.type === 'serviceNode') {
        setSidebarContent({ type: 'serviceNode', ...node.data });
    } else {
        // Если это не repoNode или serviceNode, и специфичное содержимое сайдбара не требуется, устанавливаем в null
        setSidebarContent(null);
    }
    }, [structure, currentProjectId]);

    // Обработчик правого клика по фону холста (ПКМ)
    const onPaneContextMenu = useCallback((event) => {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
        });
    }, []);

    // Обработчик для создания нового сервиса
        // Обновленная функция handleCreateService для работы с MessageBox с типом 'form'

        // Убедитесь, что вы импортируете все необходимые функции, такие как:
        // createReactFlowServiceNode, createAuthService, createService, runProjectTask
        // и состояния React, такие как currentProjectId, contextMenu, setNodes, setShowMessageBox, currentRepoUrl
        // из вашего основного компонента (вероятно, DashboardForMain.jsx)
        
        // Предполагаемые пропсы или контекст, необходимые для этой функции:
        // - currentProjectId (number): ID текущего проекта
        // - contextMenu (object): Объект контекстного меню, содержащий x, y координаты
        // - setNodes (function): Функция React.useState для обновления узлов React Flow
        // - setShowMessageBox (function): Функция React.useState для управления видимостью MessageBox
        // - currentRepoUrl (string): Текущий URL репозитория (если применимо)
        // - runProjectTask (function): Функция для запуска задач проекта (сборка, деплой)
        // - createAuthService (function): Функция для создания службы аутентификации
        // - createService (function): Функция для создания общего сервиса
        // - createReactFlowServiceNode (function): Функция для создания нового узла React Flow
        
        const handleCreateService = useCallback(async (serviceType) => {
          // Проверка на действительность ID проекта
          if (typeof currentProjectId !== 'number' || currentProjectId <= 0) {
              setShowMessageBox({
                  isOpen: true,
                  type: 'alert',
                  title: 'Ошибка',
                  message: 'ID проекта не найден или недействителен. Невозможно создать сервис.',
                  onClose: () => {
                      setShowMessageBox(null);
                      setContextMenu(null);
                  }
              });
              console.error('Project ID is invalid for service creation:', currentProjectId);
              return;
          }
      
          // Получаем позицию из контекстного меню для размещения нового узла
          // Убедитесь, что contextMenu объект доступен и содержит x, y
          const position = contextMenu ? { x: contextMenu.x, y: contextMenu.y } : { x: 0, y: 0 };
      
          // Закрываем контекстное меню сразу после выбора типа сервиса
          setContextMenu(null);
      
          // Определяем поля формы, общие для всех типов сервисов, но с предустановками для каждого
          let formFields = [
              { name: 'deploymentName', label: 'Имя деплоя:', type: 'text', placeholder: 'my-app-service', defaultValue: '', autoFocus: true },
              { name: 'image', label: 'Docker образ:', type: 'text', placeholder: 'registry/image:tag' },
              { name: 'namespace', label: 'Namespace:', type: 'text', defaultValue: `project-${currentProjectId}`, placeholder: `project-${currentProjectId}` },
              { name: 'containerPort', label: 'Порт контейнера:', type: 'number', defaultValue: 80, placeholder: '80' },
              { name: 'replicas', label: 'Количество реплик:', type: 'number', defaultValue: 1, placeholder: '1' },
              { name: 'volume', label: 'Объем (если применимо, e.g. 5GB):', type: 'text', defaultValue: '', placeholder: 'Объем (опционально)' },
              { name: 'version', label: 'Версия (e.g. 1.0.0):', type: 'text', defaultValue: '1.0.0', placeholder: 'Версия (опционально)' },
              { name: 'path', label: 'Путь (для фронтенда/бэкенда):', type: 'text', defaultValue: '', placeholder: 'Путь к сервису в репозитории (опционально)' }
          ];
      
          // Дополнительные предустановки для специфичных типов сервисов
          switch (serviceType) {
              case 'frontend':
                  formFields = formFields.map(field => {
                      if (field.name === 'image') field.placeholder = `mixail.ermin33.fvds.ru:31339/your-frontend-app:main`;
                      if (field.name === 'path') field.defaultValue = 'frontend';
                      return field;
                  });
                  break;
              case 'backend':
                  formFields = formFields.map(field => {
                      if (field.name === 'path') field.defaultValue = 'backend';
                      if (field.name === 'image') field.placeholder = 'my-backend:latest';
                      return field;
                  });
                  break;
              case 'database':
                  formFields = formFields.map(field => {
                      if (field.name === 'image') field.defaultValue = 'postgres:13';
                      if (field.name === 'containerPort') field.defaultValue = 5432;
                      if (field.name === 'volume') field.defaultValue = '10GB';
                      field.required = true; // Сделать эти поля обязательными для БД, если нужно
                      return field;
                  });
                  break;
              case 'redis':
                  formFields = formFields.map(field => {
                      if (field.name === 'image') field.defaultValue = 'redis:latest';
                      if (field.name === 'containerPort') field.defaultValue = 6379;
                      return field;
                  });
                  break;
              case 'authentication':
                  formFields = formFields.map(field => {
                      if (field.name === 'image') field.placeholder = 'my-auth-service:latest';
                      if (field.name === 'path') field.defaultValue = 'auth-service';
                      if (field.name === 'containerPort') field.defaultValue = 8080;
                      return field;
                  });
                  break;
              case 'nginx':
                  formFields = formFields.map(field => {
                      if (field.name === 'image') field.defaultValue = 'nginx:latest';
                      if (field.name === 'containerPort') field.defaultValue = 80;
                      return field;
                  });
                  break;
              case 'message-queue':
                  formFields = formFields.map(field => {
                      if (field.name === 'image') field.defaultValue = 'rabbitmq:management';
                      if (field.name === 'containerPort') field.defaultValue = 5672; // RabbitMQ default
                      return field;
                  });
                  break;
              default:
                  // Для неизвестных типов сервисов оставим общие поля
                  break;
          }
      
          setShowMessageBox({
              isOpen: true,
              type: 'form',
              title: `Создать ${serviceType} сервис`,
              message: `Введите параметры для нового ${serviceType} сервиса:`,
              fields: formFields,
              onConfirm: async (formData) => {
                  setShowMessageBox(null); // Закрываем MessageBox
      
                  // Валидация обязательных полей на клиенте
                  const trimmedDeploymentName = formData.deploymentName.trim();
                  const trimmedImage = formData.image.trim();
                  const trimmedNamespace = formData.namespace.trim();
                  const parsedContainerPort = Number(formData.containerPort);
                  const parsedReplicas = Number(formData.replicas);
      
                  if (!trimmedDeploymentName || !trimmedImage || !trimmedNamespace || isNaN(parsedContainerPort) || parsedContainerPort <= 0 || isNaN(parsedReplicas) || parsedReplicas <= 0) {
                      setShowMessageBox({
                          isOpen: true,
                          type: 'alert',
                          title: 'Ошибка ввода',
                          message: 'Имя деплоя, образ Docker, Namespace, Порт контейнера и Количество реплик являются обязательными полями и должны быть корректными.',
                          onClose: () => setShowMessageBox(null)
                      });
                      return;
                  }
      
                  try {
                      // Создаем payload для API запроса
                      const payload = {
                          projectId: currentProjectId,
                          serviceType: serviceType, // Используем serviceType, переданный в функцию
                          deploymentName: trimmedDeploymentName,
                          image: trimmedImage,
                          namespace: trimmedNamespace,
                          containerPort: parsedContainerPort,
                          replicas: parsedReplicas,
                          position: position, // Используем позицию из контекстного меню
                          volume: formData.volume.trim() || undefined, // undefined, если пусто
                          version: formData.version.trim() || undefined,
                          path: formData.path.trim() || undefined,
                      };
      
                      // Вызываем новую функцию для создания Deployment и Service
                      const result = await createDeploymentAndService(currentProjectId, payload);
      
                      setShowMessageBox({
                          isOpen: true,
                          type: 'alert',
                          title: 'Сервис задеплоен',
                          message: `Сервис "${result.deploymentName}" успешно задеплоен! ID: ${result.serviceId}, K8s Service: ${result.serviceK8sName}, NodePort: ${result.nodePort || 'N/A'}.`,
                          onClose: () => setShowMessageBox(null)
                      });
                      console.log('API Response:', result);
      
                      // Создаем новый узел React Flow для отображения задеплоенного сервиса
                      const newNode = createReactFlowServiceNode(
                          result.serviceId, // Используем serviceId из ответа API
                          serviceType,
                          position,
                          result.deploymentName, // Используем deploymentName из ответа как label
                          currentProjectId,
                          'Running', // Предполагаем, что сервис успешно запущен
                          formData.volume.trim() || undefined,
                          formData.version.trim() || undefined,
                          formData.path.trim() || undefined
                      );
                      setNodes((ns) => [...ns, newNode]); // Добавляем новый узел к существующим
      
                  } catch (error) {
                      console.error('❌ Ошибка при развертывании сервиса:', error.message);
                      setShowMessageBox({
                          isOpen: true,
                          type: 'alert',
                          title: 'Ошибка деплоя',
                          message: 'Ошибка при развертывании сервиса: ' + error.message,
                          onClose: () => setShowMessageBox(null)
                      });
                  }
              },
              onCancel: () => setShowMessageBox(null), // Закрываем MessageBox при отмене
          });
      }, [currentProjectId, contextMenu, setNodes]);
        
      
      
      
      
      
      
      
      


    return (
        <Page>

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
                            onPaneContextMenu={onPaneContextMenu}
                            nodeTypes={nodeTypes}
                            fitView
                            attributionPosition="bottom-left"
                        >
                            <MiniMap />
                            <Controls />
                            <Background variant="dots" gap={12} size={1} />
                            <Panel position="top-right">
                                {currentRepoUrl && <div>Current Repo: <strong>{currentRepoUrl.split('/').pop()}</strong></div>}
                                {currentProjectId && <div>Project ID: <strong>{currentProjectId}</strong></div>}
                            </Panel>
                        </ReactFlow>

                        {contextMenu && (
                            <ContextMenu
                                x={contextMenu.x}
                                y={contextMenu.y}
                                onCreateService={handleCreateService}
                                onClose={() => setContextMenu(null)}
                            />
                        )}
                    </GraphWrapper>
                )}
            </Content>

            <RepoOrServiceDetailsSidebar
                isOpen={isSidebarOpen}
                content={sidebarContent}
                onClose={() => setIsSidebarOpen(false)}
                onDeleteNode={handleDeleteNode}
            />
            {showMessageBox && (
                <MessageBox
                  isOpen={showMessageBox.isOpen}
                  type={showMessageBox.type}
                  title={showMessageBox.title}
                  message={showMessageBox.message}
                  placeholder={showMessageBox.placeholder}
                  fields={showMessageBox.fields}
                  onConfirm={showMessageBox.onConfirm}
                  onCancel={showMessageBox.onCancel}
                  onClose={showMessageBox.onClose}
                />
            )}
        </Page>
    );
};

export default DashboardForMain;


// --- STYLES ---

const Page = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  background-color: #f5f7fa;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  z-index: 10;
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
  flex-grow: 1;
  /* !!! ИЗМЕНЕНИЕ: Content теперь Flex контейнер для GraphWrapper и SidebarWrapper */
  display: flex;
  position: relative; /* Важно для позиционирования SidebarWrapper */
  overflow: hidden; /* Чтобы сайдбар не выходил за границы */
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #ddd;
  border-top-color: #3070f0;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  position: absolute;
  z-index: 5;

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
  flex-grow: 1; /* !!! ИЗМЕНЕНИЕ: Позволяет GraphWrapper занимать оставшееся место */
  height: 100%;
  position: relative;
  background: #fafafa;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
`;
const DeleteButton = styled.button`
    background-color: #ef4444; /* Красный цвет */
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9em;
    font-weight: bold;
    margin-top: 20px;
    width: 100%;
    transition: background-color 0.2s ease-in-out;

    &:hover {
        background-color: #dc2626; /* Темнее красный при наведении */
    }

    &:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
    }
`;

const StatusText = styled.div`
  margin-top: 6px;
  font-size: 0.8em;
  color: #666;
`;