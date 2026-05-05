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

  // Estados para la seleccion de taller
  const [talleres, setTalleres] = useState<any[]>([]);
  const [tallerSeleccionado, setTallerSeleccionado] = useState('');
  
  const [categoriaTaller, setCategoriaTaller] = useState('mecanico');
  const [fallaEspecifica, setFallaEspecifica] = useState<string | null>(null);

  const hoy = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const cargarTalleres = async () => {
      try {
        const q = query(collection(db, 'usuarios'), where('rol', '==', 'taller'));
        const snapshot = await getDocs(q);
        const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTalleres(lista);
        if (lista.length > 0) {
          setTallerSeleccionado(lista[0].id);
        }
      } catch (error) {
        console.error("Error cargando talleres:", error);
      }
    };
    cargarTalleres();
  }, []);

  useEffect(() => {
    const analizarUltimoReporte = async () => {
      if (!id) return;
      try {
        const q = query(collection(db, 'reportes'), where('vehiculoId', '==', id.toUpperCase()));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const reportes = snapshot.docs.map(doc => doc.data());
          reportes.sort((a, b) => {
            const timeA = a.fecha?.toMillis ? a.fecha.toMillis() : 0;
            const timeB = b.fecha?.toMillis ? b.fecha.toMillis() : 0;
            return timeB - timeA;
          });
          
          const reporte = reportes[0];
          
          if (reporte.fallaCritica && reporte.respuestas) {
            const resp = reporte.respuestas;
            
            if (resp['luces_frontales'] === 'no' || resp['luces_traseras'] === 'no' || resp['luces_remolque'] === 'no' || resp['luces_altas_bajas'] === 'no' || resp['luces_freno_interm'] === 'no') {
              setCategoriaTaller('electrico automotriz');
              setFallaEspecifica('Falla eléctrica (Luces)');
            } else if (resp['frenos_servicio'] === 'no' || resp['frenos_camioneta'] === 'no' || resp['freno_estacionamiento'] === 'no') {
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

  useEffect(() => {
    if (!fecha || !tallerSeleccionado) return;
    const cargarHorasOcupadas = async () => {
      setCargando(true);
      try {
        const q = query(collection(db, 'citas_taller'), where('fecha', '==', fecha));
        const snapshot = await getDocs(q);
        const ocupadas = snapshot.docs
          .map(doc => doc.data())
          .filter(data => data.tallerId === tallerSeleccionado)
          .map(data => data.hora);
        setHorasOcupadas(ocupadas);
        setHoraSeleccionada('');
      } catch (error) {
        console.error(error);
      } finally {
        setCargando(false);
      }
    };
    cargarHorasOcupadas();
  }, [fecha, tallerSeleccionado]);

  const confirmarReserva = async () => {
    if (!fecha || !horaSeleccionada || !id || !tallerSeleccionado) return;
    
    const confirmar = window.confirm(`¿Confirmar solicitud de taller externo para el vehiculo ${id} el día ${fecha} a las ${horaSeleccionada}?`);
    if (!confirmar) return;

    const tallerDestino = talleres.find(t => t.id === tallerSeleccionado);
    const nombreTallerDestino = tallerDestino ? `${tallerDestino.nombreTaller} - ${tallerDestino.ubicacionTaller}` : 'Externo Asociado';

    setGuardando(true);
    try {
      await addDoc(collection(db, 'citas_taller'), {
        vehiculoId: id,
        patente: id.toUpperCase(),
        fecha: fecha,
        hora: horaSeleccionada,
        estado: 'pendiente',
        motivo: fallaEspecifica || 'Mantenimiento preventivo',
        tipoTaller: nombreTallerDestino,
        tallerId: tallerSeleccionado,
        esquemaPago: '80% Taller / 20% Ecopanta',
        fechaRegistro: serverTimestamp()
      });
      alert('Solicitud enviada exitosamente.');
      navigate(`/v/${id}`);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al enviar la solicitud.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100">
        
        <div className="text-center mb-6 border-b border-slate-100 pb-6">
          <h2 className="text-2xl font-black text-slate-800">Solicitar Taller</h2>
          <p className="text-blue-600 font-mono text-xl mt-2 tracking-widest bg-blue-50 inline-block px-4 py-1 rounded-xl">{id}</p>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">
            1. Seleccionar Taller y Agendar
          </label>
          <p className="text-xs text-slate-500 mb-4">
            Selecciona el taller de la lista y la fecha para tu ingreso.
          </p>

          {fallaEspecifica && (
            <div className="mb-4 bg-orange-50 p-3 rounded-xl border border-orange-100 animate-fade-in">
              <span className="text-xs font-bold text-orange-800">Problema Derivado: </span>
              <span className="text-sm font-black text-orange-600">{fallaEspecifica}</span>
            </div>
          )}

          {talleres.length > 0 ? (
            <select 
              value={tallerSeleccionado} 
              onChange={(e) => setTallerSeleccionado(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-all mb-4"
            >
              {talleres.map(t => (
                <option key={t.id} value={t.id}>{t.nombreTaller} ({t.ubicacionTaller})</option>
              ))}
            </select>
          ) : (
            <div className="p-4 bg-yellow-50 text-yellow-700 rounded-2xl mb-4 text-sm font-bold border border-yellow-200">
              No hay talleres asociados registrados en el sistema. Contacta a administración.
            </div>
          )}

          <input 
            type="date" 
            min={hoy}
            value={fecha} 
            onChange={(e) => setFecha(e.target.value)} 
            disabled={talleres.length === 0}
            className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-all mb-4" 
          />

          {fecha && talleres.length > 0 && (
            <div className="animate-fade-in">
              {cargando ? (
                <p className="text-center text-sm text-slate-400 py-4">Verificando disponibilidad en taller...</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 mb-6">
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

          <button 
            onClick={confirmarReserva} 
            disabled={!fecha || !horaSeleccionada || guardando || talleres.length === 0} 
            className={`w-full font-bold py-4 rounded-xl transition-all shadow-md ${
              !fecha || !horaSeleccionada || guardando || talleres.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-800 text-white hover:bg-slate-900'
            }`}
          >
            {guardando ? 'Enviando solicitud...' : 'Confirmar Solicitud'}
          </button>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">
            2. Urgencia en Ruta (Sin reserva)
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Usa esta opción solo si necesitas un taller por emergencia y no puedes esperar la coordinación.
          </p>
          <a 
            href={`https://www.google.com/maps/search/taller+${categoriaTaller}+cerca+de+mi`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 hover:bg-indigo-50 text-indigo-600 font-bold py-3 px-4 rounded-xl transition-colors text-sm shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Ver talleres cercanos en Maps
          </a>
        </div>

        <div className="mt-6 text-center">
          <Link to={`/v/${id}`} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors py-2">
            Cancelar y volver
          </Link>
        </div>

      </div>
    </div>
  );
}