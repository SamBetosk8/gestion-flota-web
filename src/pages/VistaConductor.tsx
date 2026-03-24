import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

// Banco de preguntas dinámico según el tipo de vehículo
const preguntasPorTipo = {
  'Camion': [
    { id: 'frenos_aire', texto: '¿La presión de los frenos de aire es correcta?' },
    { id: 'acoplado', texto: '¿El acoplado o rampa está asegurado correctamente?' },
    { id: 'neumaticos_camion', texto: '¿Los neumáticos (incluyendo repuesto) están en buen estado?' }
  ],
  'Tractor': [
    { id: 'hidraulico', texto: '¿El sistema hidráulico no presenta fugas?' },
    { id: 'implementos', texto: '¿Los implementos agrícolas están bien enganchados?' },
    { id: 'luces_faena', texto: '¿Las luces de faena y baliza están operativas?' }
  ],
  'Camioneta': [
    { id: 'frenos', texto: '¿Los frenos funcionan correctamente?' },
    { id: 'luces', texto: '¿Las luces e intermitentes encienden?' },
    { id: 'neumaticos', texto: '¿Neumáticos en buen estado?' }
  ]
};

export default function VistaConductor() {
  const { id } = useParams();
  const [encuestaCompletada, setEncuestaCompletada] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  
  const [vehiculo, setVehiculo] = useState<any>(null);
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
        }
      } catch (error) {
        console.error(error);
      } finally {
        setCargandoVehiculo(false);
      }
    };
    cargarVehiculo();
  }, [id]);

  const forzarDescarga = async (url: string, nombreArchivo: string) => {
    // Detectar si el dispositivo es iOS (iPhone, iPad, iPod) o Safari en Mac
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);

    if (esIOS) {
      // En dispositivos Apple, abrimos el PDF en una nueva pestaña.
      // Safari lo renderiza nativamente y permite guardarlo desde el botón de compartir.
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
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlBlob);
      }, 100);
    } catch (error) {
      console.error("Error al descargar, abriendo en nueva pestaña:", error);
      window.open(url, '_blank');
    }
  };

  // Determinar qué preguntas usar. Si no tiene tipo, usa Camioneta por defecto.
  const tipoActual = vehiculo?.tipo || 'Camioneta';
  const preguntasDinamicas = preguntasPorTipo[tipoActual as keyof typeof preguntasPorTipo] || preguntasPorTipo['Camioneta'];

  const capturarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => setFoto(event.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const manejarEnvio = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const kilometrajeEscrito = formData.get('kilometraje') as string;
    
    if (!foto && !kilometrajeEscrito) {
      alert("Es obligatorio ingresar el kilometraje escrito o subir una foto del tablero.");
      return;
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
      
      if (foto) {
        fotoPath = `kilometrajes/${id}-${Date.now()}.jpg`;
        const storageRef = ref(storage, fotoPath);
        await uploadString(storageRef, foto, 'data_url');
        fotoUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'reportes'), {
        vehiculoId: id,
        tipoVehiculo: tipoActual, // Guardamos el tipo para el filtro del dashboard
        kilometraje: kilometrajeEscrito || "No ingresado",
        fotoUrl: fotoUrl,
        fotoPath: fotoPath,
        fallaCritica: tieneFallaCritica,
        respuestas: respuestas,
        fecha: serverTimestamp()
      });

      if (tieneFallaCritica) setBloqueado(true);
      else setEncuestaCompletada(true);

    } catch (error) {
      console.error(error);
      alert("Hubo un error al enviar el reporte.");
    } finally {
      setSubiendo(false);
    }
  };

  const calcularEstadoVencimiento = (fechaString: string) => {
    if (!fechaString) return { texto: 'No registrado', clase: 'text-slate-500 bg-slate-100 border-slate-200' };
    const fechaVencimiento = new Date(fechaString);
    const hoy = new Date();
    const diferenciaTiempo = fechaVencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24));

    if (diasRestantes < 0) return { texto: 'Vencido', clase: 'bg-red-100 text-red-700 border-red-200' };
    if (diasRestantes <= 10) return { texto: 'Por vencer', clase: 'bg-orange-100 text-orange-700 border-orange-200' };
    return { texto: 'Al día', clase: 'bg-green-100 text-green-700 border-green-200' };
  };

  if (bloqueado) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border-2 border-red-500">
          <h1 className="text-2xl font-black text-red-700">VEHÍCULO BLOQUEADO</h1>
          <p className="mt-4 text-gray-600">Falla crítica detectada. Avise al taller inmediatamente.</p>
        </div>
      </div>
    );
  }

  if (encuestaCompletada) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border-2 border-green-500">
          <h1 className="text-2xl font-black text-green-700">Reporte Enviado</h1>
          <p className="mt-2 text-gray-600">Puede iniciar su jornada.</p>
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

        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Estado de Documentos</h2>
          
          {cargandoVehiculo ? (
            <p className="text-center text-xs text-slate-500">Verificando en base de datos...</p>
          ) : vehiculo ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className={`p-3 rounded-2xl border flex flex-col justify-between items-center bg-white shadow-sm ${calcularEstadoVencimiento(vehiculo.vencimientoRevision).clase}`}>
                <div className="flex flex-col items-center w-full">
                  <span className="text-[10px] uppercase font-black opacity-70 mb-1">Rev. Técnica</span>
                  <span className="text-sm font-bold">{calcularEstadoVencimiento(vehiculo.vencimientoRevision).texto}</span>
                </div>
                {vehiculo.urlRevision && (
                  <button 
                    type="button"
                    onClick={() => forzarDescarga(vehiculo.urlRevision, `Revision_${id}.pdf`)} 
                    className="mt-3 w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-2 rounded-xl shadow-md transition-all active:transform active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Descargar
                  </button>
                )}
              </div>
              <div className={`p-3 rounded-2xl border flex flex-col justify-between items-center bg-white shadow-sm ${calcularEstadoVencimiento(vehiculo.vencimientoCirculacion).clase}`}>
                <div className="flex flex-col items-center w-full">
                  <span className="text-[10px] uppercase font-black opacity-70 mb-1">Permiso Circ.</span>
                  <span className="text-sm font-bold">{calcularEstadoVencimiento(vehiculo.vencimientoCirculacion).texto}</span>
                </div>
                {vehiculo.urlCirculacion && (
                  <button 
                    type="button"
                    onClick={() => forzarDescarga(vehiculo.urlCirculacion, `Circulacion_${id}.pdf`)} 
                    className="mt-3 w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-2 rounded-xl shadow-md transition-all active:transform active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Descargar
                  </button>
                )}
              </div>
              <div className={`p-3 rounded-2xl border flex flex-col justify-between items-center bg-white shadow-sm ${calcularEstadoVencimiento(vehiculo.vencimientoCertificado).clase}`}>
                <div className="flex flex-col items-center w-full">
                  <span className="text-[10px] uppercase font-black opacity-70 mb-1">Certificado</span>
                  <span className="text-sm font-bold">{calcularEstadoVencimiento(vehiculo.vencimientoCertificado).texto}</span>
                </div>
                {vehiculo.urlCertificado && (
                  <button 
                    type="button"
                    onClick={() => forzarDescarga(vehiculo.urlCertificado, `Certificado_${id}.pdf`)} 
                    className="mt-3 w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-2 rounded-xl shadow-md transition-all active:transform active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Descargar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-xs text-red-600 font-bold">Vehículo no registrado en la gestión de flota.</p>
            </div>
          )}
        </div>

        <form onSubmit={manejarEnvio} className="p-6 space-y-6">
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <h2 className="font-bold text-slate-800 border-b border-slate-200 pb-2">Registro de Kilometraje</h2>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Escribir Kilometraje</label>
              <input type="number" name="kilometraje" placeholder="Ej: 150000" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div className="text-center text-slate-400 text-sm font-bold">O</div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Foto del Tablero</label>
              <label className="block w-full cursor-pointer">
                <input type="file" accept="image/*" capture="environment" onChange={capturarFoto} className="hidden" />
                <div className="border-2 border-dashed border-slate-300 bg-white rounded-xl p-4 text-center hover:bg-slate-100 transition-all">
                  {foto ? <img src={foto} className="mx-auto h-24 rounded-lg shadow-sm" alt="Vista previa" /> : <span className="text-slate-500 text-sm">Presiona para usar la cámara</span>}
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h2 className="font-bold text-slate-800 mb-4">Inspección Visual</h2>
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