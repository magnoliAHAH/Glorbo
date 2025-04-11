import React, { useEffect, useState } from 'react'
import StartButton from '../components/ConsoleButton'
import Graph from '../components/Graph'


const Dashboard = () => {
  const [structure, setStructure] = useState(null)
  useEffect(() => {
    fetch('https://supreme-roulette.work.gd/api/structure?repo=https://github.com/magnoliAHAH/roulette')
      .then(res => res.json())
      .then(data => setStructure(data))
  }, [])

  return (
    <div style={{ height: '80vh', width: '100%' }}>
      Dashboard
      <StartButton/>
      {structure && <Graph structure={structure} />}
    </div>
  )
}

export default Dashboard
