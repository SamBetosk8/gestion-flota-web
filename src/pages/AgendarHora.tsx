import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import fondoTaller from '../assets/taller.jpg'; // IMAGEN DE FONDO

const HORAS_DISPONIBLES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

const ETIQUETA_PROYECTO = 'flota_app'; 

export default function AgendarHora() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fecha, setFecha] = useState('');
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  // NUEVO ESTADO: Controla la pantalla final de éxito
  const [reservaExitosa, setReservaExitosa] = useState(false);

  const [talleres, setTalleres] = useState<any[]>([]);
  const [tallerSeleccionado, setTallerSeleccionado] = useState('');
  
  const [fallaEspecifica, setFallaEspecifica] = useState<string | null>(null);
  const [categoriaTaller, setCategoriaTaller] = useState('mecanico');

  const hoy = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const cargarTalleres = async () => {
      try {
        const q = query(collection(db, 'usuarios'), where('rol', '==', 'taller'));
        const snapshot = await getDocs(q);
        
        const lista = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((t: any) => t.proyecto === ETIQUETA_PROYECTO);

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
    const direccionTallerDestino = tallerDestino ? (tallerDestino.ciudadTaller ? `${tallerDestino.direccionTaller}, ${tallerDestino.ciudadTaller}` : tallerDestino.ubicacionTaller) : '';

    setGuardando(true);
    try {
      await addDoc(collection(db, 'citas_taller'), {
        vehiculoId: id,
        patente: id.toUpperCase(),
        fecha: fecha,
        hora: horaSeleccionada,
        estado: 'pendiente',
        motivo: fallaEspecifica || 'Mantenimiento preventivo',
        tipoTaller: tallerDestino?.nombreTaller || 'Externo Asociado',
        direccionCompletaTaller: direccionTallerDestino,
        tallerId: tallerSeleccionado,
        esquemaPago: '80% Taller / 20% Ecopanta',
        fechaRegistro: serverTimestamp()
      });
      setReservaExitosa(true);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al enviar la solicitud.');
    } finally {
      setGuardando(false);
    }
  };

  const tallerActual = talleres.find(t => t.id === tallerSeleccionado);
  const direccionParaMapa = tallerActual ? (tallerActual.ciudadTaller ? `${tallerActual.direccionTaller}, ${tallerActual.ciudadTaller}` : tallerActual.ubicacionTaller || tallerActual.direccionTaller) : '';

  if (reservaExitosa) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 text-center relative"
        style={{ backgroundImage: `url(${fondoTaller})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
      >
        <div className="absolute inset-0 bg-slate-900/70 z-0"></div>
        
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md relative z-10 animate-fade-in border-t-8 border-green-500 w-full">
          <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-4">¡Hora Agendada con Éxito!</h1>
          <p className="text-slate-500 text-base leading-relaxed mb-8 font-medium">
            Tu solicitud de taller para el vehículo <span className="font-bold text-slate-700">{id}</span> ha sido enviada a la administración. ¡Muchas gracias por tu compromiso y que tengas un viaje muy seguro!
          </p>
          
          <button onClick={() => window.location.href = `/v/${id}`} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
            Volver a escanear QR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center p-4 md:p-6 relative"
      style={{ backgroundImage: `url(${fondoTaller})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="absolute inset-0 bg-slate-900/60 z-0"></div>

      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full relative z-10 my-auto animate-fade-in border border-slate-100">
        
        <div className="text-center mb-6 border-b border-slate-100 pb-6">
          <h2 className="text-2xl font-black text-slate-800">Solicitar Taller</h2>
          <p className="text-blue-600 font-mono text-xl mt-2 tracking-widest bg-blue-50 inline-block px-4 py-1 rounded-xl shadow-sm">{id}</p>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">
            1. Seleccionar Taller y Agendar
          </label>
          <p className="text-xs text-slate-500 mb-4">
            Selecciona el taller de la lista y la fecha para tu ingreso.
          </p>

          {fallaEspecifica && (
            <div className="mb-4 bg-orange-50 p-3 rounded-xl border border-orange-100 animate-fade-in shadow-sm">
              <span className="text-xs font-bold text-orange-800">Problema Derivado: </span>
              <span className="text-sm font-black text-orange-600">{fallaEspecifica}</span>
            </div>
          )}

          {talleres.length > 0 ? (
            <select 
              value={tallerSeleccionado} 
              onChange={(e) => setTallerSeleccionado(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-all mb-4 shadow-sm"
            >
              {talleres.map(t => (
                <option key={t.id} value={t.id}>{t.nombreTaller}</option>
              ))}
            </select>
          ) : (
            <div className="p-4 bg-yellow-50 text-yellow-700 rounded-2xl mb-4 text-sm font-bold border border-yellow-200">
              No hay talleres asociados registrados en el sistema. Contacta a administración.
            </div>
          )}

          {tallerActual && (
            <div className="mb-6 bg-white p-4 rounded-2xl border-2 border-blue-100 shadow-sm flex flex-col animate-fade-in">
              <div className="mb-3">
                <h4 className="font-black text-lg text-slate-800">{tallerActual.nombreTaller}</h4>
                <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-black uppercase px-2 py-1 rounded-md mt-1">
                  {tallerActual.especialidadTaller || 'Mecánica General'}
                </span>
              </div>
              
              <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 mb-3 bg-slate-100">
                <iframe 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  style={{ border: 0 }} 
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(direccionParaMapa)}&t=&z=15&ie=UTF8&iwloc=&output=embed`} 
                  allowFullScreen
                  title="Ubicación del Taller"
                ></iframe>
              </div>

              <div className="flex items-center gap-2 text-sm font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="leading-tight">{direccionParaMapa}</span>
              </div>
            </div>
          )}

          <input 
            type="date" 
            min={hoy}
            value={fecha} 
            onChange={(e) => setFecha(e.target.value)} 
            disabled={talleres.length === 0}
            className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-700 focus:border-blue-500 focus:outline-none transition-all mb-4 shadow-sm" 
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
            className={`w-full font-black text-lg py-4 rounded-2xl transition-all shadow-xl ${
              !fecha || !horaSeleccionada || guardando || talleres.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-800 text-white hover:bg-slate-900 hover:-translate-y-1'
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

        <div className="mt-6 text-center border-t border-slate-100 pt-6">
          <button onClick={() => navigate(`/v/${id}`)} className="text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors">
            Cancelar y volver al resumen
          </button>
        </div>

      </div>
    </div>
  );
}