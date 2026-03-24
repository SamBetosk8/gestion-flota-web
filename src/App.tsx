import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';

import VistaConductor from './pages/VistaConductor';
import DashboardAdmin from './pages/DashboardAdmin';
import GeneradorQR from './pages/GeneradorQR';
import Login from './pages/Login';

function RutaPrivada({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCargando(false);
    });
    return () => unsubscribe();
  }, []);

  if (cargando) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Cargando sistema...</div>;
  if (!usuario) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirigir la raiz al login */}
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* Ruta Publica para el chofer */}
        <Route path="/v/:id" element={<VistaConductor />} />
        
        {/* Ruta de Login */}
        <Route path="/login" element={<Login />} />

        {/* Rutas Privadas de Administrador */}
        <Route path="/admin" element={
          <RutaPrivada>
            <DashboardAdmin />
          </RutaPrivada>
        } />
        <Route path="/generador" element={
          <RutaPrivada>
            <GeneradorQR />
          </RutaPrivada>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;