import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

export default function VistaConductor() {
  const { id } = useParams();
  const [encuestaCompletada, setEncuestaCompletada] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  
  // Estados para la carga de datos del vehiculo
  const [vehiculo, setVehiculo] = useState<any>(null);
  const [cargandoVehiculo, setCargandoVehiculo] = useState(true);

  // Buscar informacion del vehiculo para ver estado de documentos
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
        console.error("Error al cargar vehiculo:", error);
      } finally {
        setCargandoVehiculo(false);
      }
    };
    cargarVehiculo();
  }, [id]);

  const preguntas = [
    { id: 'frenos', texto: '¿Los frenos funcionan correctamente?' },
    { id: 'luces', texto: '¿Las luces encienden?' },
    { id: 'neumaticos', texto: '¿Neumaticos en buen estado?' }
  ];

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

    preguntas.forEach(p => {
      const respuesta = formData.get(p.id) as string;
      respuestas[p.id] = respuesta;
      if (respuesta === 'no') tieneFallaCritica = true;
    });

    try {
      let fotoUrl = null;
      if (foto) {
        const nombreFoto = `kilometrajes/${id}-${Date.now()}.jpg`;
        const storageRef = ref(storage, nombreFoto);
        await uploadString(storageRef, foto, 'data_url');
        fotoUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'reportes'), {
        vehiculoId: id,
        kilometraje: kilometrajeEscrito || "No ingresado",
        fotoUrl: fotoUrl,
        fallaCritica: tieneFallaCritica,
        respuestas: respuestas,
        fecha: serverTimestamp()
      });

      if (tieneFallaCritica) setBloqueado(true);
      else setEncuestaCompletada(true);

    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      alert("Hubo un error al enviar el reporte.");
    } finally {
      setSubiendo(false);
    }
  };

  // Funcion para evaluar colores segun fecha
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
          <h1 className="text-2xl font-black text-red-700">VEHICULO BLOQUEADO</h1>
          <p className="mt-4 text-gray-600">Falla critica detectada. Avise al taller inmediatamente.</p>
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
        </div>

        {/* SECCION ESTADO DE DOCUMENTOS */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Estado de Documentos</h2>
          
          {cargandoVehiculo ? (
            <p className="text-center text-xs text-slate-500">Verificando en base de datos...</p>
          ) : vehiculo ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`p-2 rounded-xl border flex flex-col justify-center items-center ${calcularEstadoVencimiento(vehiculo.vencimientoRevision).clase}`}>
                <span className="text-[10px] uppercase font-black opacity-70 mb-1">Rev. Tecnica</span>
                <span className="text-xs font-bold">{calcularEstadoVencimiento(vehiculo.vencimientoRevision).texto}</span>
              </div>
              <div className={`p-2 rounded-xl border flex flex-col justify-center items-center ${calcularEstadoVencimiento(vehiculo.vencimientoCirculacion).clase}`}>
                <span className="text-[10px] uppercase font-black opacity-70 mb-1">Permiso Circ.</span>
                <span className="text-xs font-bold">{calcularEstadoVencimiento(vehiculo.vencimientoCirculacion).texto}</span>
              </div>
              <div className={`p-2 rounded-xl border flex flex-col justify-center items-center ${calcularEstadoVencimiento(vehiculo.vencimientoCertificado).clase}`}>
                <span className="text-[10px] uppercase font-black opacity-70 mb-1">Certificado</span>
                <span className="text-xs font-bold">{calcularEstadoVencimiento(vehiculo.vencimientoCertificado).texto}</span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-xs text-red-600 font-bold">⚠️ Vehículo no registrado en la gestión de flota.</p>
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
            <h2 className="font-bold text-slate-800 mb-4">Inspeccion Visual</h2>
            {preguntas.map((p) => (
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