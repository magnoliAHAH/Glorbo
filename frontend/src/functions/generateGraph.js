let nodeId = 0

// Функция для создания узла
function createNode(id, label, type, x, y, children = []) {
  return {
    id,
    type: type === 'folder' ? 'folderNode' : 'default',
    position: { x, y },
    data: {
      label,
      ...(type === 'folder' && { children: children.filter(c => c.type === 'file') })
    },
    sourcePosition: 'right',
    targetPosition: 'left'
  }
}

// Функция для создания рёбер
function createEdge(from, to) {
  return {
    id: `${from}-${to}`,
    source: from,
    target: to,
    type: 'default'
  }
}

// Функция для вычисления позиций узлов
export function buildGraphFromTree(tree, startX = 0, startY = 0, parentId = null, nodes = [], edges = []) {
  const currentId = `node-${nodeId++}`
  const label = tree.name

  const files = (tree.children || []).filter(child => child.type === 'file')
  const folders = (tree.children || []).filter(child => child.type === 'folder')

  // Создаём текущий узел
  nodes.push(createNode(currentId, label, tree.type, startX, startY, tree.children))

  // Создаём рёбра, если есть родитель
  if (parentId) {
    edges.push(createEdge(parentId, currentId))
  }

  // Инициализируем общую высоту
  let totalHeight = files.length * 40 // Высота на каждый файл (например, 40px)
  
  // Если есть дочерние папки, обрабатываем их
  if (folders.length > 0) {
    let childY = startY + totalHeight + 50 // Начинаем ниже файлов, добавляем отступ
    let childX = startX + 250 // Расстояние между узлами по оси X для дочерних папок

    for (const child of folders) {
      const { height: subtreeHeight } = buildGraphFromTree(child, childX, childY, currentId, nodes, edges)
      
      childY += subtreeHeight + 50 // Отступ между папками
      totalHeight += subtreeHeight + 50
    }
  }

  // Если нет ни файлов, ни папок — задаём дефолтную высоту
  if (totalHeight === 0) totalHeight = 100

  return { nodes, edges, height: totalHeight }
}
