import React from 'react'
import { Handle, Position } from '@xyflow/react'

const FolderNode = ({ data }) => {
  return (
    <div style={{
      border: '2px solid #4A90E2',
      borderRadius: '10px',
      padding: '10px',
      backgroundColor: '#f0f8ff',
      minWidth: '200px'
    }}>
      <strong style={{ color: '#1a237e' }}>📁 {data.label}</strong>
      <div style={{ marginTop: '8px' }}>
        {data.children?.map((file, index) => (
          <div key={index} style={{
            padding: '5px 8px',
            margin: '3px 0',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px',
            fontSize: '13px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis'
          }}>
            📄 {file.name}
          </div>
        ))}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default FolderNode
