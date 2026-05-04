import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, serverTimestamp, orderBy, limit } from 'firebase/firestore';
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

  // Estados para la recomendación de taller
  const [categoriaTaller, setCategoriaTaller] = useState('mecanico');
  const [fallaEspecifica, setFallaEspecifica] = useState<string | null>(null);

  const hoy = new Date().toISOString().split('T')[0];

  // 1. Analizar el último reporte para detectar el tipo de falla
  useEffect(() => {
    const analizarUltimoReporte = async () => {
      if (!id) return;
      try {
        const q = query(
          collection(db, 'reportes'),
          where('vehiculoId', '==', id.toUpperCase()),
          orderBy('fecha', 'desc'),
          limit(1)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const reporte = snapshot.docs[0].data();
          if (reporte.fallaCritica && reporte.respuestas) {
            const resp = reporte.respuestas;
            
            // Lógica de clasificación basada en los IDs del checklist
            if (resp['luces_frontales'] === 'no' || resp['luces_traseras'] === 'no' || resp['luces_remolque'] === 'no' || resp['luces_altas_bajas'] === 'no' || resp['luces_freno_interm'] === 'no') {
              setCategoriaTaller('electrico automotriz');
              setFallaEspecifica('Falla eléctrica (Luces)');
            } else if (resp['frenos_servicio'] === 'no' || resp['frenos_camioneta'] === 'no') {
              setCategoriaTaller('especialista en frenos');
              setFallaEspecifica('Falla en sistema de frenos');
            } else if (resp['neumaticos_tracto'] === 'no' || resp['neumaticos_remolque'] === 'no' || resp['neumaticos_camioneta'] === 'no') {
              setCategoriaTaller('vulcanizacion');
              setFallaEspecifica('Falla en neumáticos');
            } else if (resp['suspension_chasis'] === 'no') {
              setCategoriaTaller('de suspension');
              setFallaEspecifica('Falla en suspensión/chasis');
            } else {
              setCategoriaTaller('mecanico');
              setFallaEspecifica('Falla mecánica general');
            }
          }
        }
      } catch (error) {
        console.error("Error analizando reporte", error);
      }
    };
    analizarUltimoReporte();
  }, [id]);

  // 2. Cargar horas ocupadas
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
    
    const confirmar = window.confirm(`¿Confirmar reserva para el vehiculo ${id} el dia ${fecha} a las ${horaSeleccionada}?`);
    if (!confirmar) return;

    setGuardando(true);
    try {
      await addDoc(collection(db, 'citas_taller'), {
        vehiculoId: id,
        patente: id.toUpperCase(),
        fecha: fecha,
        hora: horaSeleccionada,
        estado: 'pendiente',
        motivo: fallaEspecifica || 'Mantenimiento preventivo',
        fechaRegistro: serverTimestamp()
      });
      alert('Reserva confirmada exitosamente. Tu solicitud ha sido registrada.');
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
        
        <div className="text-center mb-6 border-b border-slate-100 pb-6">
          <h2 className="text-2xl font-black text-slate-800">Agendar Taller</h2>
          <p className="text-blue-600 font-mono text-xl mt-2 tracking-widest bg-blue-50 inline-block px-4 py-1 rounded-xl">{id}</p>
        </div>

        {/* SECCIÓN NUEVA: Sugerencia de Taller Externo */}
        <div className="mb-8 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
          <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">Búsqueda de Taller Cercano</h3>
          {fallaEspecifica ? (
            <p className="text-sm text-indigo-800 font-bold mb-3">Se detectó: <span className="text-red-600">{fallaEspecifica}</span></p>
          ) : (
            <p className="text-sm text-indigo-800 font-medium mb-3">Busca un taller en el mapa si estás en ruta y necesitas asistencia inmediata.</p>
          )}
          <a 
            href={`https://www.google.com/maps/search/taller+${categoriaTaller}+cerca+de+mi`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors text-sm shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Buscar en Google Maps
          </a>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">Registro de Cita Interna</label>
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