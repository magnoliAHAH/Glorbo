import React, { useState, useEffect } from 'react'
import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { buildGraphFromTree } from '../functions/generateGraph'

const Graph = ({ structure }) => {
  const [elements, setElements] = useState({ nodes: [], edges: [] })

  useEffect(() => {
    if (structure) {
      const { nodes, edges } = buildGraphFromTree(structure)
      setElements({ nodes, edges })
    }
  }, [structure])

  return (
    <div style={{ width: '100%', height: '80vh' }}>
      <ReactFlow nodes={elements.nodes} edges={elements.edges}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

export default Graph
