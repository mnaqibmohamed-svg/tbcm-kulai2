import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import ScreenAdmin from './pages/ScreenAdmin';
import ScreenPPKP from './pages/ScreenPPKP';
import ScreenPR1 from './pages/ScreenPR1';

function App() {
  return (
    <Router>
      <Routes>
        {/* Halaman utama adalah Login */}
        <Route path="/" element={<Login />} />
        
        {/* Laluan untuk setiap peranan */}
        <Route path="/admin" element={<ScreenAdmin />} />
        <Route path="/ppkp" element={<ScreenPPKP />} />
        <Route path="/pr1" element={<ScreenPR1 />} />
      </Routes>
    </Router>
  );
}

export default App;