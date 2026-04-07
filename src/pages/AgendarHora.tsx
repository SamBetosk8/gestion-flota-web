import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const HORAS_DISPONIBLES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

export default function AgendarHora() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fecha, setFecha] = useState('');
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const hoy = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!fecha) return;
    const cargarHorasOcupadas = async () => {
      setCargando(true);
      try {
        const q = query(collection(db, 'citas_taller'), where('fecha', '==', fecha));
        const snapshot = await getDocs(q);
        const ocupadas = snapshot.docs.map(doc => doc.data().hora);
        setHorasOcupadas(ocupadas);
        setHoraSeleccionada('');
      } catch (error) {
        console.error(error);
      } finally {
        setCargando(false);
      }
    };
    cargarHorasOcupadas();
  }, [fecha]);

  const confirmarReserva = async () => {
    if (!fecha || !horaSeleccionada || !id) return;
    
    const confirmar = window.confirm(`¿Confirmar reserva para el vehiculo ${id} el día ${fecha} a las ${horaSeleccionada}?`);
    if (!confirmar) return;

    setGuardando(true);
    try {
      await addDoc(collection(db, 'citas_taller'), {
        vehiculoId: id,
        patente: id.toUpperCase(),
        fecha: fecha,
        hora: horaSeleccionada,
        estado: 'pendiente',
        fechaRegistro: serverTimestamp()
      });
      alert('Reserva confirmada exitosamente. Te esperamos en el taller.');
      navigate(`/v/${id}`);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al guardar la reserva.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100">
        
        <div className="text-center mb-8 border-b border-slate-100 pb-6">
          <h2 className="text-2xl font-black text-slate-800">Agendar Taller</h2>
          <p className="text-blue-600 font-mono text-xl mt-2 tracking-widest bg-blue-50 inline-block px-4 py-1 rounded-xl">{id}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">Selecciona el Día</label>
          <input 
            type="date" 
            min={hoy}
            value={fecha} 
            onChange={(e) => setFecha(e.target.value)} 
            className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-all" 
          />
        </div>

        {fecha && (
          <div className="mb-8 animate-fade-in">
            <label className="block text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">Selecciona la Hora</label>
            {cargando ? (
              <p className="text-center text-sm text-slate-400 py-4">Verificando disponibilidad...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {HORAS_DISPONIBLES.map(h => {
                  const ocupada = horasOcupadas.includes(h);
                  const seleccionada = horaSeleccionada === h;
                  return (
                    <button
                      key={h}
                      disabled={ocupada}
                      onClick={() => setHoraSeleccionada(h)}
                      className={`py-3 rounded-xl font-bold transition-all border-2 ${
                        ocupada 
                          ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed' 
                          : seleccionada 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                            : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {h} {ocupada && '(Ocupado)'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button 
            onClick={confirmarReserva} 
            disabled={!fecha || !horaSeleccionada || guardando} 
            className={`w-full font-bold py-4 rounded-xl transition-all shadow-md ${
              !fecha || !horaSeleccionada || guardando 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-800 text-white hover:bg-slate-900'
            }`}
          >
            {guardando ? 'Guardando reserva...' : 'Confirmar Reserva'}
          </button>
          <Link to={`/v/${id}`} className="text-center text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors py-2">
            Cancelar y volver al resumen
          </Link>
        </div>

      </div>
    </div>
  );
}