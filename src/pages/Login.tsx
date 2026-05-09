import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { LOGO_BASE64 } from '../constants';

const ETIQUETA_PROYECTO = 'flota_app'; 

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    
    try {
      // 1. Verificamos con Firebase Auth puro
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        // 2. Buscamos si tiene un perfil en la base de datos
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          
          // Si tiene perfil, validamos que pertenezca a esta app
          if (data.proyecto && data.proyecto !== ETIQUETA_PROYECTO) {
            await signOut(auth);
            setError('Acceso denegado: Esta cuenta pertenece a otra plataforma.');
            setCargando(false);
            return;
          }

          // Redirigimos según su rol en la BD
          const rol = data.rol;
          if (rol === 'taller') {
            navigate('/taller');
          } else if (rol === 'generador_qr') {
            navigate('/panel-generador');
          } else {
            navigate('/admin');
          }
        } else {
          // 3. CAMBIO APLICADO: Si no tiene documento en Firestore, pero pasó el Auth, 
          // es la cuenta maestra (Admin). Lo dejamos pasar directo al panel de control.
          navigate('/admin');
        }
      } catch (firestoreErr) {
        console.error(firestoreErr);
        navigate('/admin');
      }
    } catch (err: any) {
      setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100">
        <div className="text-center mb-8">
          <img src={LOGO_BASE64} alt="Logo" className="h-16 object-contain mx-auto mb-6" />
          <h1 className="text-2xl font-black text-slate-800">Acceso Restringido</h1>
          <p className="text-slate-500 text-sm mt-2">Sistema de Gestión de Flota</p>
        </div>
        
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold mb-6 border border-red-100 text-center">{error}</div>}
        
        <form onSubmit={manejarLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Correo Institucional</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-medium" 
              placeholder="correo@empresa.com" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contraseña</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-medium" 
              placeholder="••••••••" 
            />
          </div>
          <button 
            type="submit" 
            disabled={cargando} 
            className={`w-full font-bold py-4 rounded-xl transition-all shadow-md mt-4 ${cargando ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {cargando ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}