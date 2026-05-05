import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

const preguntasPorTipo = {
  'Tracto camión': [
    { id: 'presiones_tablero', texto: '¿Los indicadores de presion (aceite, aire/vacio) marcan niveles normales?' },
    { id: 'frenos_servicio', texto: '¿El freno de pie y el de emergencia funcionan bien y sin fugas de aire?' },
    { id: 'volante_direccion', texto: '¿El volante y la direccion operan correctamente sin juego excesivo?' },
    { id: 'parabrisas_limpiadores', texto: '¿El parabrisas esta sin fisuras graves y los limpiaparabrisas funcionan?' },
    { id: 'espejos_retrovisores', texto: '¿Los espejos retrovisores estan en buen estado y bien ajustados?' },
    { id: 'luces_frontales', texto: '¿Faros principales, direccionales y luces de galibo frontales encienden?' },
    { id: 'luces_traseras', texto: '¿Luces de freno, reversa y direccionales traseras operan sin problemas?' },
    { id: 'neumaticos_tracto', texto: '¿Las llantas tienen buena huella, presion correcta y los birlos estan completos?' },
    { id: 'suspension_chasis', texto: '¿La suspension (muelles) y el chasis se encuentran sin fisuras o roturas?' },
    { id: 'tanque_combustible', texto: '¿El tanque de combustible y su tapon estan bien asegurados y sin fugas?' },
    { id: 'quinta_rueda', texto: '¿La quinta rueda y sus conexiones de aire/electricas estan en buen estado?' },
    { id: 'equipo_emergencia', texto: '¿Lleva extintor cargado, botiquin, triangulos, gato hidraulico y llave de rueda?' }
  ],
  'Semirremolque': [
    { id: 'estado_carroceria', texto: '¿La carroceria se encuentra sin abolladuras, corrosion ni elementos sueltos?' },
    { id: 'luces_remolque', texto: '¿Las luces de posicion, intermitentes, freno y galibo estan operativas?' },
    { id: 'huincha_reflectante', texto: '¿La huincha reflectante en el chasis esta visible y en buen estado?' },
    { id: 'neumaticos_remolque', texto: '¿Los neumaticos (incluido el de repuesto) estan sin danos y con presion correcta?' },
    { id: 'patines_apoyo', texto: '¿Los patines de apoyo (patas) suben, bajan y se aseguran correctamente?' },
    { id: 'conexiones_tracto', texto: '¿Las lineas electricas y conexiones de frenos de aire hacia el tracto estan sin fugas?' },
    { id: 'extintores_pqs', texto: '¿Cuenta con 2 extintores de 6 kilos con mantencion vigente?' },
    { id: 'cunas_seguridad', texto: '¿Lleva al menos 2 cunas en buen estado y conos de seguridad?' },
    { id: 'rotulacion_carga', texto: '¿Los letreros de riesgo (Ej. ONU, Rombo) estan visibles en los 4 lados?' },
    { id: 'valvulas_acoples', texto: '¿Las valvulas, acoples y piolas de accionamiento de emergencia estan operativas?' }
  ],
  'Camioneta': [
    { id: 'luces_altas_bajas', texto: '¿Las luces altas, bajas y de estacionamiento encienden correctamente?' },
    { id: 'luces_freno_interm', texto: '¿Las luces de freno, retroceso e intermitentes estan operativas?' },
    { id: 'alarmas_bocina', texto: '¿La alarma de retroceso y la bocina suenan de forma clara?' },
    { id: 'parabrisas_visibilidad', texto: '¿El parabrisas esta limpio, sin trizaduras y los limpiaparabrisas limpian bien?' },
    { id: 'espejos_camioneta', texto: '¿Los espejos laterales y el retrovisor interior estan ajustados y sin danos?' },
    { id: 'cinturones_seguridad', texto: '¿Todos los cinturones de seguridad enganchan y retraen correctamente?' },
    { id: 'neumaticos_camioneta', texto: '¿Los neumaticos (delanteros, traseros y repuesto) tienen buena huella y presion?' },
    { id: 'frenos_camioneta', texto: '¿El pedal de freno y el freno de mano retienen el vehiculo adecuadamente?' },
    { id: 'kit_emergencia_cam', texto: '¿Cuenta con extintor vigente, botiquin y triangulos reflectantes?' },
    { id: 'herramientas_cam', texto: '¿Lleva gata hidraulica, llave de rueda y cunas de seguridad?' },
    { id: 'carroceria_puertas', texto: '¿Las puertas cierran bien y la carroceria (con barra antivuelco si aplica) es segura?' }
  ]
};

export default function VistaConductor() {
  const { id } = useParams();
  const [encuestaCompletada, setEncuestaCompletada] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [kilometrajeActual, setKilometrajeActual] = useState<number | null>(null);
  
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  
  const [vehiculo, setVehiculo] = useState<any>(null);
  const [vehiculoIdDoc, setVehiculoIdDoc] = useState<string | null>(null);
  const [cargandoVehiculo, setCargandoVehiculo] = useState(true);

  useEffect(() => {
    const cargarVehiculo = async () => {
      if (!id) return;
      try {
        const patenteFiltro = id.toUpperCase();
        const q = query(collection(db, 'vehiculos'), where('patente', '==', patenteFiltro));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setVehiculo(querySnapshot.docs[0].data());
          setVehiculoIdDoc(querySnapshot.docs[0].id);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setCargandoVehiculo(false);
      }
    };
    cargarVehiculo();
  }, [id]);

  useEffect(() => {
    if (encuestaCompletada || bloqueado) {
      const timer = setTimeout(() => {
        setMostrarResumen(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [encuestaCompletada, bloqueado]);

  const forzarDescarga = async (url: string, nombreArchivo: string) => {
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);

    if (esIOS) {
      window.open(url, '_blank');
      return;
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const urlBlob = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = urlBlob;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(urlBlob);
    } catch (error) {
      console.error("Error al descargar, abriendo en nueva pestana:", error);
      window.open(url, '_blank');
    }
  };

  let tipoActual = vehiculo?.tipo || 'Camioneta';
  if (tipoActual === 'Semi remolque') tipoActual = 'Semirremolque';
  const preguntasDinamicas = preguntasPorTipo[tipoActual as keyof typeof preguntasPorTipo] || preguntasPorTipo['Camioneta'];

  const capturarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoFile(file);
      
      const reader = new FileReader();
      reader.onload = (event) => setFotoPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const manejarEnvio = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const kilometrajeEscrito = formData.get('kilometraje') as string;
    
    if (!fotoFile && !kilometrajeEscrito) {
      alert("Es obligatorio ingresar el kilometraje escrito o subir una foto del tablero.");
      return;
    }

    // Validacion para que el kilometraje nuevo no sea menor que el anterior
    if (kilometrajeEscrito) {
      const kmNuevo = Number(kilometrajeEscrito);
      const kmAnterior = Number(vehiculo?.kilometrajeActual) || 0;
      
      if (kmNuevo < kmAnterior) {
        alert(`Error: El kilometraje ingresado (${kmNuevo} km) no puede ser menor al ultimo registrado (${kmAnterior} km). Por favor, verifica el dato.`);
        return;
      }
      setKilometrajeActual(kmNuevo);
    }

    setSubiendo(true);
    let tieneFallaCritica = false;
    const respuestas: Record<string, string> = {};

    preguntasDinamicas.forEach(p => {
      const respuesta = formData.get(p.id) as string;
      respuestas[p.id] = respuesta;
      if (respuesta === 'no') tieneFallaCritica = true;
    });

    try {
      let fotoUrl = null;
      let fotoPath = null;
      
      if (fotoFile) {
        fotoPath = `kilometrajes/${id}-${Date.now()}-${fotoFile.name}`;
        const storageRef = ref(storage, fotoPath);
        await uploadBytes(storageRef, fotoFile);
        fotoUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'reportes'), {
        vehiculoId: id,
        tipoVehiculo: tipoActual,
        kilometraje: kilometrajeEscrito || "No ingresado",
        fotoUrl: fotoUrl,
        fotoPath: fotoPath,
        fallaCritica: tieneFallaCritica,
        respuestas: respuestas,
        fecha: serverTimestamp()
      });

      if (kilometrajeEscrito && vehiculoIdDoc) {
        await updateDoc(doc(db, 'vehiculos', vehiculoIdDoc), {
          kilometrajeActual: kilometrajeEscrito
        });
      }

      if (tieneFallaCritica) setBloqueado(true);
      else setEncuestaCompletada(true);

    } catch (error) {
      console.error(error);
      alert("Hubo un error al enviar el reporte. Verifica tu conexion a internet.");
    } finally {
      setSubiendo(false);
    }
  };

  const calcularEstadoVencimiento = (fechaString: string) => {
    if (!fechaString) return { texto: 'No registrado', clase: 'bg-slate-100 text-slate-500 border-slate-200' };
    
    const [year, month, day] = fechaString.split('-').map(Number);
    const fechaVencimiento = new Date(year, month - 1, day);
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const diferenciaTiempo = fechaVencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.round(diferenciaTiempo / (1000 * 3600 * 24));

    if (diasRestantes < 0) return { texto: `Venció hace ${Math.abs(diasRestantes)}d`, clase: 'bg-red-100 text-red-700 border-red-300' };
    if (diasRestantes === 0) return { texto: 'Vence hoy', clase: 'bg-red-100 text-red-700 border-red-300' };
    if (diasRestantes <= 15) return { texto: `Vence en ${diasRestantes}d`, clase: 'bg-orange-100 text-orange-700 border-orange-300' };
    return { texto: `Al día (${diasRestantes}d)`, clase: 'bg-green-100 text-green-700 border-green-300' };
  };

  if (mostrarResumen) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100 animate-fade-in">
          
          <div className={`p-6 text-white text-center ${bloqueado ? 'bg-red-600' : 'bg-blue-600'}`}>
            <h1 className="text-2xl font-black">Resumen de Jornada</h1>
            <p className="text-blue-100 font-mono text-lg mt-1 tracking-widest">{id}</p>
            <p className={`text-xs font-black uppercase mt-2 inline-block px-3 py-1 rounded-full ${bloqueado ? 'bg-red-700 text-white' : 'bg-blue-700 text-white'}`}>
              {bloqueado ? 'VEHICULO BLOQUEADO' : 'VEHICULO APROBADO'}
            </p>
          </div>

          <div className="p-6">
            
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 shadow-sm">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Registro de Kilometraje</h2>
              <div className="flex justify-between items-stretch px-2">
                <div className="text-center flex-1 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 font-bold mb-1">Actual</p>
                  <p className="text-xl font-black text-slate-800">
                    {kilometrajeActual ? `${kilometrajeActual.toLocaleString()} km` : 'Por foto'}
                  </p>
                </div>
                
                <div className="w-px bg-slate-300 mx-2"></div>
                
                <Link to={`/agendar/${id}`} className="text-center flex-1 block hover:bg-blue-50 p-2 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-blue-200 group">
                  <p className="text-xs text-blue-500 font-bold mb-1">Proximo Taller</p>
                  <p className="text-xl font-black text-blue-700">
                    {vehiculo?.kilometrajeTaller ? `${Number(vehiculo.kilometrajeTaller).toLocaleString()} km` : 'Pendiente'}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-500 group-hover:text-blue-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Agendar Hora
                  </div>
                </Link>
              </div>
            </div>

            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Descarga de Documentos</h2>
            {vehiculo ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className={`p-2 rounded-2xl border-2 flex flex-col justify-between items-center shadow-sm ${calcularEstadoVencimiento(vehiculo.vencimientoRevision).clase}`}>
                  <div className="flex flex-col items-center w-full">
                    <span className="text-[10px] uppercase font-black opacity-70 mb-1">Rev. Tecnica</span>
                    <span className="text-xs font-bold leading-tight mt-1">{calcularEstadoVencimiento(vehiculo.vencimientoRevision).texto}</span>
                  </div>
                  {vehiculo.urlRevision && (
                    <button 
                      type="button"
                      onClick={() => forzarDescarga(vehiculo.urlRevision, `Revision_${id}.pdf`)} 
                      className="mt-3 w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold py-2 px-1 rounded-xl shadow-md transition-all active:transform active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Descargar
                    </button>
                  )}
                </div>
                
                <div className={`p-2 rounded-2xl border-2 flex flex-col justify-between items-center shadow-sm ${calcularEstadoVencimiento(vehiculo.vencimientoCirculacion).clase}`}>
                  <div className="flex flex-col items-center w-full">
                    <span className="text-[10px] uppercase font-black opacity-70 mb-1">Permiso Circ.</span>
                    <span className="text-xs font-bold leading-tight mt-1">{calcularEstadoVencimiento(vehiculo.vencimientoCirculacion).texto}</span>
                  </div>
                  {vehiculo.urlCirculacion && (
                    <button 
                      type="button"
                      onClick={() => forzarDescarga(vehiculo.urlCirculacion, `Circulacion_${id}.pdf`)} 
                      className="mt-3 w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold py-2 px-1 rounded-xl shadow-md transition-all active:transform active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Descargar
                    </button>
                  )}
                </div>
                
                <div className={`p-2 rounded-2xl border-2 flex flex-col justify-between items-center shadow-sm ${calcularEstadoVencimiento(vehiculo.vencimientoCertificado).clase}`}>
                  <div className="flex flex-col items-center w-full">
                    <span className="text-[10px] uppercase font-black opacity-70 mb-1">Certificado</span>
                    <span className="text-xs font-bold leading-tight mt-1">{calcularEstadoVencimiento(vehiculo.vencimientoCertificado).texto}</span>
                  </div>
                  {vehiculo.urlCertificado && (
                    <button 
                      type="button"
                      onClick={() => forzarDescarga(vehiculo.urlCertificado, `Certificado_${id}.pdf`)} 
                      className="mt-3 w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold py-2 px-1 rounded-xl shadow-md transition-all active:transform active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Descargar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-500">Documentos no disponibles.</p>
            )}

            <button onClick={() => window.location.reload()} className="mt-8 w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">
              Finalizar y Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (bloqueado) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border-2 border-red-500 animate-fade-in">
          <h1 className="text-2xl font-black text-red-700">VEHICULO BLOQUEADO</h1>
          <p className="mt-4 text-slate-600">Falla critica detectada. Avise a administracion inmediatamente.</p>
          <p className="mt-6 text-xs font-bold text-slate-400">Redirigiendo al resumen...</p>
        </div>
      </div>
    );
  }

  if (encuestaCompletada) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border-2 border-green-500 animate-fade-in">
          <h1 className="text-2xl font-black text-green-700">Reporte Enviado</h1>
          <p className="mt-2 text-slate-600">Puede iniciar su jornada de manera segura.</p>
          <p className="mt-6 text-xs font-bold text-slate-400">Redirigiendo al resumen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100">
        <div className="bg-blue-600 p-6 text-white text-center">
          <h1 className="text-xl font-bold">Checklist Diario</h1>
          <p className="text-blue-100 font-mono text-lg mt-1 tracking-widest">{id}</p>
          {!cargandoVehiculo && vehiculo?.tipo && (
            <p className="text-white text-xs font-black uppercase mt-2 bg-blue-700 inline-block px-3 py-1 rounded-full">{vehiculo.tipo}</p>
          )}
        </div>

        <form onSubmit={manejarEnvio} className="p-6 space-y-6">
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <h2 className="font-bold text-slate-800 border-b border-slate-200 pb-2">Registro de Kilometraje</h2>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Escribir Kilometraje
                {vehiculo?.kilometrajeActual && (
                  <span className="text-blue-600 font-bold ml-2">(Anterior: {vehiculo.kilometrajeActual} km)</span>
                )}
              </label>
              <input 
                type="number" 
                name="kilometraje" 
                min={vehiculo?.kilometrajeActual || 0}
                placeholder={vehiculo?.kilometrajeActual ? `Mayor a ${vehiculo.kilometrajeActual}` : "Ej: 150000"} 
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>
            <div className="text-center text-slate-400 text-sm font-bold">O</div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Foto del Tablero</label>
              <label className="block w-full cursor-pointer">
                {/* CAMBIO CLAVE: Se agrego capture="environment" para forzar la camara trasera */}
                <input type="file" accept="image/*" capture="environment" onChange={capturarFoto} className="hidden" />
                <div className="border-2 border-dashed border-slate-300 bg-white rounded-xl p-4 text-center hover:bg-slate-100 transition-all">
                  {fotoPreview ? <img src={fotoPreview} className="mx-auto h-24 rounded-lg shadow-sm" alt="Vista previa" /> : <span className="text-slate-500 text-sm font-bold text-blue-600">Tomar foto con la cámara</span>}
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h2 className="font-bold text-slate-800 mb-4">Inspeccion Visual</h2>
            {preguntasDinamicas.map((p) => (
              <div key={p.id} className="space-y-2 mb-4">
                <p className="text-slate-700 font-medium text-sm">{p.texto}</p>
                <div className="flex gap-4">
                  <label className="flex-1">
                    <input type="radio" name={p.id} value="si" required className="hidden peer" />
                    <div className="text-center py-2 rounded-xl border-2 border-slate-200 peer-checked:border-blue-600 peer-checked:bg-blue-50 cursor-pointer font-bold text-slate-400 peer-checked:text-blue-600 transition-colors">SI</div>
                  </label>
                  <label className="flex-1">
                    <input type="radio" name={p.id} value="no" required className="hidden peer" />
                    <div className="text-center py-2 rounded-xl border-2 border-slate-200 peer-checked:border-red-600 peer-checked:bg-red-50 cursor-pointer font-bold text-slate-400 peer-checked:text-red-600 transition-colors">NO</div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button type="submit" disabled={subiendo} className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg transition-all ${subiendo ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {subiendo ? 'Enviando reporte...' : 'Finalizar Reporte'}
          </button>
        </form>
      </div>
    </div>
  );
}