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
import { createService, updateNodePosition, getRepoTree, createAuthService, getProjectServices, deleteService, createDeploymentAndService, runProjectTask } from '../functions/api/api';
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
          // 0) Проверка projectId
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
        
          // 1) Получаем позицию и закрываем контекстное меню
          const position = { x: contextMenu.x, y: contextMenu.y };
          setContextMenu(null);
        
          // 2) Ветка для frontend
          if (serviceType === 'frontend') {
            // 2.1) Форма для сбора параметров сборки
            setShowMessageBox({
              isOpen: true,
              type: 'form',
              title: 'Параметры сборки Frontend',
              message: 'Введите параметры для сборки Docker-образа фронтенда:',
              fields: [
                { name: 'repo_url',   label: 'URL репозитория:',       type: 'text',     defaultValue: currentRepoUrl || '', placeholder: 'https://github.com/user/repo', autoFocus: true },
                { name: 'branch',     label: 'Ветка:',                   type: 'text',     defaultValue: 'main', placeholder: 'main' },
                { name: 'path',       label: 'Путь сборки:',             type: 'text',     defaultValue: 'frontend', placeholder: 'frontend/src' },
                { name: 'image_name', label: 'Имя образа (Docker):',     type: 'text',     placeholder: 'my-frontend-app' },
                { name: 'tag',        label: 'Тег образа:',              type: 'text',     defaultValue: 'latest', placeholder: 'latest' },
              ],
              onConfirm: async buildFormData => {
                setShowMessageBox(null);
        
                const buildParams = {
                  repo_url:   buildFormData.repo_url.trim(),
                  branch:     buildFormData.branch.trim(),
                  path:       buildFormData.path.trim(),
                  image_name: buildFormData.image_name.trim(),
                  tag:        buildFormData.tag.trim(),
                };
        
                try {
                  console.log('📦 Отправка запроса сборки:', buildParams);
                  await runProjectTask({
                    project_id: currentProjectId,
                    task_type:  'build',
                    params:     buildParams,
                  });
                } catch (err) {
                  console.error('❌ Ошибка сборки:', err);
                  setShowMessageBox({
                    isOpen: true,
                    type: 'alert',
                    title: 'Ошибка сборки',
                    message: `Ошибка сборки: ${err.message}`,
                    onClose: () => setShowMessageBox(null)
                  });
                  return;
                }
        
                // 2.2) Форма для сбора параметров деплоя
                setShowMessageBox({
                  isOpen: true,
                  type: 'form',
                  title: 'Параметры деплоя Frontend',
                  message: 'Введите параметры для развертывания пода и сервиса:',
                  fields: [
                    { name: 'deploymentName', label: 'Deployment Name:',     type: 'text',   defaultValue: `my-${buildParams.image_name}-deploys`, autoFocus: true },
                    { name: 'image',          label: 'Image (полный путь):', type: 'text',   defaultValue: `mixail.ermin33.fvds.ru:31339/${buildParams.image_name}:${buildParams.tag}` },
                    { name: 'namespace',      label: 'Namespace:',           type: 'text',   defaultValue: `project-${currentProjectId}` },
                    { name: 'containerPort',  label: 'Container Port:',      type: 'number', defaultValue: 80 },
                    { name: 'replicas',       label: 'Replicas:',            type: 'number', defaultValue: 2 },
                    { name: 'volume',         label: 'Volume (путь):',       type: 'text',   defaultValue: '/var/data' },
                  ],
                  onConfirm: async deployFormData => {
                    setShowMessageBox(null);
        
                    const deploymentSpec = {
                      deploymentName: deployFormData.deploymentName.trim(),
                      image:          deployFormData.image.trim(),
                      namespace:      deployFormData.namespace.trim(),
                      containerPort:  Number(deployFormData.containerPort),
                      replicas:       Number(deployFormData.replicas),
                      volume:         deployFormData.volume.trim(),
                    };
        
                    try {
                      console.log('🚀 Деплой через createDeploymentAndService:', deploymentSpec);
                      const result = await createDeploymentAndService(currentProjectId, deploymentSpec);
        
                      setShowMessageBox({
                        isOpen: true,
                        type: 'alert',
                        title: 'Frontend задеплоен',
                        message: `Frontend "${deploymentSpec.deploymentName}" задеплоен. NodePort: ${result.nodePort}`,
                        onClose: () => setShowMessageBox(null)
                      });
        
                      // Добавляем узел в React Flow
                      const newNode = createReactFlowServiceNode(
                        deploymentSpec.deploymentName,
                        'frontend',
                        position,
                        deploymentSpec.deploymentName,
                        currentProjectId,
                        'running',
                        deploymentSpec.volume,
                        buildFormData.tag,
                        buildFormData.path
                      );
                      setNodes(ns => [...ns, newNode]);
                    } catch (err) {
                      console.error('❌ Ошибка деплоя:', err);
                      setShowMessageBox({
                        isOpen: true,
                        type: 'alert',
                        title: 'Ошибка деплоя',
                        message: `Не удалось задеплоить frontend: ${err.message}`,
                        onClose: () => setShowMessageBox(null)
                      });
                    }
                  },
                  onCancel: () => setShowMessageBox(null),
                });
              },
              onCancel: () => setShowMessageBox(null),
            });
        
          } else {
            // 3) Ветка для остальных типов сервисов
            setShowMessageBox({
              isOpen: true,
              type: 'form',
              title: `Создать ${serviceType} сервис`,
              message: `Введите параметры для нового ${serviceType} сервиса:`,
              fields: [
                { name: 'serviceName', label: 'Имя сервиса:',               type: 'text', placeholder: 'Название сервиса', defaultValue: '', autoFocus: true },
                { name: 'path',        label: 'Путь в репозитории:',        type: 'text', placeholder: 'backend/src', defaultValue: '' },
                { name: 'version',     label: 'Версия (e.g. 1.0.0):',        type: 'text', placeholder: '1.0.0', defaultValue: '1.0.0' },
                { name: 'volume',      label: 'Объем (e.g. 5GB):',           type: 'text', placeholder: '5GB', defaultValue: '' },
              ],
              onConfirm: async formData => {
                setShowMessageBox(null);
                const trimmedName = formData.serviceName.trim();
                const trimmedPath = formData.path.trim();
        
                if (serviceType === 'authentication' && !trimmedName) {
                  setShowMessageBox({
                    isOpen: true,
                    type: 'alert',
                    title: 'Ошибка ввода',
                    message: 'Имя службы аутентификации не может быть пустым.',
                    onClose: () => setShowMessageBox(null)
                  });
                  return;
                }
                if (!trimmedPath) {
                  setShowMessageBox({
                    isOpen: true,
                    type: 'alert',
                    title: 'Ошибка ввода',
                    message: 'Путь в репозитории не может быть пустым.',
                    onClose: () => setShowMessageBox(null)
                  });
                  return;
                }
        
                try {
                  let result, id, name;
                  if (serviceType === 'authentication') {
                    result = await createAuthService(currentProjectId, trimmedName);
                    id = result.authServiceId;
                    name = trimmedName;
                  } else {
                    result = await createService(
                      currentProjectId,
                      serviceType,
                      position,
                      trimmedName,
                      trimmedPath,
                      formData.version,
                      formData.volume
                    );
                    id = result.serviceId;
                    name = result.name;
                  }
        
                  setShowMessageBox({
                    isOpen: true,
                    type: 'alert',
                    title: 'Сервис создан',
                    message: `Сервис "${name}" создан с ID: ${id}.`,
                    onClose: () => setShowMessageBox(null)
                  });
        
                  const newNode = createReactFlowServiceNode(
                    id,
                    serviceType,
                    position,
                    name,
                    currentProjectId,
                    'pending',
                    formData.volume,
                    formData.version,
                    trimmedPath
                  );
                  setNodes(prev => [...prev, newNode]);
                } catch (err) {
                  console.error('Не удалось создать сервис:', err);
                  setShowMessageBox({
                    isOpen: true,
                    type: 'alert',
                    title: 'Ошибка создания',
                    message: `Не удалось создать сервис: ${err.message}`,
                    onClose: () => setShowMessageBox(null)
                  });
                }
              },
              onCancel: () => setShowMessageBox(null),
            });
          }
        }, [
          currentProjectId,
          contextMenu,
          currentRepoUrl,
          setShowMessageBox,
          setContextMenu,
          setNodes,
        ]);
         // Зависимости useCallback
        
      
      
      
      
      
      
      
      


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