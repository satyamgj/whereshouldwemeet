import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CreateRoom from './components/CreateRoom';
import MeetingPlanner from './components/MeetingPlanner';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CreateRoom />} />
        <Route path="/room/:roomCode" element={<MeetingPlanner />} />
      </Routes>
    </Router>
  );
}

export default App; 