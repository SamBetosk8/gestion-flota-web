import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, deleteDoc, doc, where } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './lib/firebase';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

// 1. Vista Conductor (Checklist)
function VistaConductor() {
  const { id } = useParams();
  const [encuestaCompletada, setEncuestaCompletada] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

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
          <p className="text-blue-100">Vehiculo: {id}</p>
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
                  {foto ? <img src={foto} className="mx-auto h-24 rounded-lg shadow-sm" alt="Vista previa" /> : <span className="text-slate-500 text-sm">Presiona para usar la camara</span>}
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

// 2. Dashboard Administrador
function DashboardAdmin() {
  const [pestanaActiva, setPestanaActiva] = useState('reportes');
  const [busqueda, setBusqueda] = useState(''); // Estado para el filtro
  
  const [reportes, setReportes] = useState<any[]>([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false);
  const [qrsGuardados, setQrsGuardados] = useState<any[]>([]);
  const [generandoPdf, setGenerandoPdf] = useState<string | null>(null);

  useEffect(() => {
    if (pestanaActiva === 'reportes') {
      const cargarReportes = async () => {
        try {
          const q = query(collection(db, 'reportes'), orderBy('fecha', 'desc'));
          const querySnapshot = await getDocs(q);
          setReportes(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error("Error al obtener reportes:", error);
        } finally {
          setCargandoReportes(false);
        }
      };
      cargarReportes();
    }
  }, [pestanaActiva]);

  useEffect(() => {
    if (pestanaActiva === 'vehiculos') {
      const cargarVehiculos = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'vehiculos'));
          setVehiculos(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error("Error al obtener vehiculos:", error);
        }
      };
      cargarVehiculos();
    }
  }, [pestanaActiva]);

  useEffect(() => {
    if (pestanaActiva === 'qrs') {
      const cargarQrs = async () => {
        try {
          const q = query(collection(db, 'qrs_guardados'), orderBy('fechaRegistro', 'desc'));
          const querySnapshot = await getDocs(q);
          setQrsGuardados(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error("Error al obtener QRs:", error);
        }
      };
      cargarQrs();
    }
  }, [pestanaActiva]);

  const registrarVehiculo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget; 
    setGuardandoVehiculo(true);
    const formData = new FormData(form);
    
    const nuevoVehiculo = {
      patente: (formData.get('patente') as string).toUpperCase(),
      vencimientoRevision: formData.get('vencimientoRevision'),
      vencimientoCirculacion: formData.get('vencimientoCirculacion'),
      vencimientoCertificado: formData.get('vencimientoCertificado'),
      fechaRegistro: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'vehiculos'), nuevoVehiculo);
      alert("Vehiculo registrado correctamente");
      form.reset(); 
      const querySnapshot = await getDocs(collection(db, 'vehiculos'));
      setVehiculos(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error detallado:", error);
      alert("Error al guardar vehiculo");
    } finally {
      setGuardandoVehiculo(false);
    }
  };

  const eliminarQR = async (id: string) => {
    const confirmar = window.confirm("¿Estas seguro de que deseas eliminar este QR guardado?");
    if (confirmar) {
      try {
        await deleteDoc(doc(db, 'qrs_guardados', id));
        setQrsGuardados(prev => prev.filter(qr => qr.id !== id));
      } catch (error) {
        console.error("Error al eliminar QR:", error);
        alert("Hubo un error al eliminar el QR.");
      }
    }
  };

  const calcularEstadoVencimiento = (fechaString: string) => {
    if (!fechaString) return { texto: 'No registrado', clase: 'text-slate-500' };
    const fechaVencimiento = new Date(fechaString);
    const hoy = new Date();
    const diferenciaTiempo = fechaVencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24));

    if (diasRestantes < 0) return { texto: `Vencido (${Math.abs(diasRestantes)}d)`, clase: 'bg-red-100 text-red-700 font-bold border-red-200' };
    if (diasRestantes <= 10) return { texto: `Vence en ${diasRestantes}d`, clase: 'bg-orange-100 text-orange-700 font-bold border-orange-200' };
    return { texto: `OK`, clase: 'bg-green-100 text-green-700 font-bold border-green-200' };
  };

  const descargarPDF = async (patente: string) => {
    setGenerandoPdf(patente);
    const elemento = document.getElementById(`tarjeta-pdf-${patente}`);
    if (elemento) {
      try {
        const imgData = await toPng(elemento, { 
          quality: 1, 
          pixelRatio: 3,
          backgroundColor: '#ffffff'
        });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
        pdf.addImage(imgData, 'PNG', 0, 0, 100, 150);
        pdf.save(`QR_Vehiculo_${patente}.pdf`);
      } catch (error) {
        console.error("Error generando PDF", error);
        alert("Ocurrio un problema al generar el documento PDF.");
      }
    }
    setGenerandoPdf(null);
  };

  // Filtrado de datos basado en el buscador
  const reportesFiltrados = reportes.filter(r => r.vehiculoId?.toLowerCase().includes(busqueda.toLowerCase()));
  const vehiculosFiltrados = vehiculos.filter(v => v.patente?.toLowerCase().includes(busqueda.toLowerCase()));
  const qrsFiltrados = qrsGuardados.filter(q => q.patente?.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800">Panel de Control</h1>
          </div>
          
          {/* Barra de busqueda global */}
          <div className="w-full md:w-auto flex-1 max-w-md mx-auto md:mx-4">
            <input 
              type="text" 
              placeholder="Buscar patente... Ej: AB12" 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white shadow-sm"
            />
          </div>

          <Link to="/" className="bg-white text-blue-600 border-2 border-blue-600 font-bold py-3 px-6 rounded-xl hover:bg-blue-50 transition-all text-center w-full md:w-auto">
            Generar Nuevo QR
          </Link>
        </div>

        <div className="flex space-x-4 mb-8 overflow-x-auto pb-2">
          <button onClick={() => setPestanaActiva('reportes')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'reportes' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Historial de Reportes</button>
          <button onClick={() => setPestanaActiva('vehiculos')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'vehiculos' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Gestion de Vehiculos</button>
          <button onClick={() => setPestanaActiva('qrs')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'qrs' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Codigos QR Guardados</button>
        </div>

        {pestanaActiva === 'reportes' && (
          <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
                    <th className="p-4 font-bold">Fecha</th>
                    <th className="p-4 font-bold">Patente</th>
                    <th className="p-4 font-bold">Kilometraje</th>
                    <th className="p-4 font-bold">Estado</th>
                    <th className="p-4 font-bold text-center">Evidencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cargandoReportes ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Cargando reportes...</td></tr>
                  ) : reportesFiltrados.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No se encontraron reportes.</td></tr>
                  ) : reportesFiltrados.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-600 text-sm">{rep.fecha ? rep.fecha.toDate().toLocaleString() : 'Reciente'}</td>
                      <td className="p-4 font-bold text-slate-800">{rep.vehiculoId}</td>
                      <td className="p-4 text-slate-600 font-mono">{rep.kilometraje}</td>
                      <td className="p-4">
                        {rep.fallaCritica ? <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">BLOQUEADO</span> : <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">APROBADO</span>}
                      </td>
                      <td className="p-4 text-center">
                        {rep.fotoUrl ? <a href={rep.fotoUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm font-medium">Ver Foto</a> : <span className="text-slate-400 text-sm">Sin foto</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pestanaActiva === 'vehiculos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100 lg:col-span-1 h-fit">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Añadir Vehiculo</h2>
              <form onSubmit={registrarVehiculo} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Patente</label><input type="text" name="patente" required placeholder="Ej: AB1234" className="w-full p-3 border border-slate-300 rounded-xl uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Vencimiento Rev. Tecnica</label><input type="date" name="vencimientoRevision" required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700" /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Vencimiento Permiso Circulacion</label><input type="date" name="vencimientoCirculacion" required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700" /></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Vencimiento Certificado</label><input type="date" name="vencimientoCertificado" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700" /></div>
                <button type="submit" disabled={guardandoVehiculo} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-all mt-4">{guardandoVehiculo ? 'Guardando...' : 'Registrar Vehiculo'}</button>
              </form>
            </div>

            <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100 lg:col-span-2">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Estado de Documentos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4 font-bold">Patente</th>
                      <th className="p-4 font-bold">Rev. Tecnica</th>
                      <th className="p-4 font-bold">Permiso Circ.</th>
                      <th className="p-4 font-bold">Certificado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vehiculosFiltrados.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400">No se encontraron vehiculos.</td></tr>
                    ) : vehiculosFiltrados.map((vehiculo) => {
                      const revInfo = calcularEstadoVencimiento(vehiculo.vencimientoRevision);
                      const circInfo = calcularEstadoVencimiento(vehiculo.vencimientoCirculacion);
                      const certInfo = calcularEstadoVencimiento(vehiculo.vencimientoCertificado);
                      return (
                        <tr key={vehiculo.id} className="hover:bg-slate-50">
                          <td className="p-4 font-black text-slate-800 text-lg">{vehiculo.patente}</td>
                          <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs border ${revInfo.clase}`}>{revInfo.texto}</span></td>
                          <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs border ${circInfo.clase}`}>{circInfo.texto}</span></td>
                          <td className="p-4"><span className={`px-3 py-1 rounded-full text-xs border ${certInfo.clase}`}>{certInfo.texto}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {pestanaActiva === 'qrs' && (
          <div>
            {qrsFiltrados.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl shadow-lg text-center border border-slate-100">
                <p className="text-slate-500 text-lg">No se encontraron codigos QR guardados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {qrsFiltrados.map((qr) => (
                  <div key={qr.id} className="flex flex-col gap-2">
                    
                    {/* Vista Previa Responsiva */}
                    <div className="bg-white p-6 rounded-3xl shadow-lg flex flex-col items-center border border-slate-100">
                      <img src="/logo.webp" alt="Logo" className="h-12 object-contain mx-auto mb-4" />
                      <h3 className="text-3xl font-black text-slate-800 tracking-widest">{qr.patente}</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-4">Control de Flota</p>
                      <div className="bg-white p-2 rounded-xl border-4 border-slate-800 mb-4 shadow-sm">
                        <QRCodeSVG value={qr.url} size={130} level="H" includeMargin={false} />
                      </div>
                    </div>

                    {/* Tarjeta Oculta EXACTA para el PDF */}
                    <div style={{ position: 'fixed', top: '200vh', left: '-9999px' }}>
                      <div 
                        id={`tarjeta-pdf-${qr.patente}`} 
                        className="bg-white p-8 flex flex-col items-center justify-center"
                        style={{ width: '400px', height: '600px', backgroundColor: 'white' }} 
                      >
                        <img src="/logo.webp" alt="Logo Empresa" className="h-24 object-contain mx-auto mb-8" />
                        <h2 className="text-5xl font-black text-slate-800 mb-2 tracking-widest">{qr.patente}</h2>
                        <p className="text-lg text-slate-500 font-bold uppercase tracking-widest mb-10">Control de Flota</p>
                        <div className="bg-white p-4 rounded-3xl border-8 border-slate-800 mb-8 shadow-xl">
                          <QRCodeSVG value={qr.url} size={220} level="H" includeMargin={false} />
                        </div>
                        <p className="text-slate-500 font-bold text-center">Escanee este codigo para iniciar<br/>el checklist de este vehiculo.</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => descargarPDF(qr.patente)}
                      disabled={generandoPdf === qr.patente}
                      className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-colors shadow-lg mt-2"
                    >
                      {generandoPdf === qr.patente ? 'Generando...' : 'Descargar en PDF'}
                    </button>
                    
                    <button 
                      onClick={() => eliminarQR(qr.id)}
                      className="w-full bg-red-50 text-red-600 font-bold py-2 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      Eliminar QR
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// 3. Generador QR
function GeneradorQR() {
  const [patente, setPatente] = useState('HBL123');
  const [procesando, setProcesando] = useState(false);
  const urlVehiculo = `${window.location.origin}/v/${patente}`;

  const guardarYDescargar = async () => {
    if (!patente) return;
    setProcesando(true);
    
    try {
      const patenteMayuscula = patente.toUpperCase();
      
      // 1. Verificar si la patente ya existe en Firebase
      const q = query(collection(db, 'qrs_guardados'), where('patente', '==', patenteMayuscula));
      const querySnapshot = await getDocs(q);

      // Solo lo guardamos si la busqueda nos dio "vacio" (no existe)
      if (querySnapshot.empty) {
        await addDoc(collection(db, 'qrs_guardados'), {
          patente: patenteMayuscula,
          url: urlVehiculo,
          fechaRegistro: serverTimestamp()
        });
      }

      // 2. Generar el PDF siempre (aunque ya existiera en Firebase)
      const elemento = document.getElementById('tarjeta-pdf-generador');
      if (elemento) {
        const imgData = await toPng(elemento, { 
          quality: 1, 
          pixelRatio: 3,
          backgroundColor: '#ffffff'
        });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
        pdf.addImage(imgData, 'PNG', 0, 0, 100, 150);
        pdf.save(`QR_Vehiculo_${patente}.pdf`);
      }

    } catch (error) {
      console.error("Error al procesar:", error);
      alert("Hubo un error al procesar el QR.");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Contenedor Oculto EXACTO para Generar el PDF */}
      <div style={{ position: 'fixed', top: '200vh', left: '-9999px' }}>
        <div id="tarjeta-pdf-generador" className="bg-white p-8 flex flex-col items-center justify-center" style={{ width: '400px', height: '600px', backgroundColor: 'white' }}>
          <img src="/logo.webp" alt="Logo Empresa" className="h-24 object-contain mx-auto mb-8" />
          <h2 className="text-5xl font-black text-slate-800 mb-2 tracking-widest">{patente.toUpperCase() || 'PATENTE'}</h2>
          <p className="text-lg text-slate-500 font-bold uppercase tracking-widest mb-10">Control de Flota</p>
          <div className="bg-white p-4 rounded-3xl border-8 border-slate-800 mb-8 shadow-xl">
            <QRCodeSVG value={urlVehiculo} size={220} level="H" includeMargin={false} />
          </div>
          <p className="text-slate-500 font-bold text-center">Escanee este codigo para iniciar<br/>el checklist de este vehiculo.</p>
        </div>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-slate-100 z-10 relative">
        <h2 className="text-2xl font-black text-slate-800 mb-2">Generador QR</h2>
        <p className="text-slate-500 mb-8 text-sm">Identificadores de Vehiculos</p>
        
        <div className="mb-8 text-left">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Patente / ID</label>
          <input type="text" value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all font-mono text-lg text-center" placeholder="EJ: ABCD12" />
        </div>

        <div className="flex justify-center bg-white p-6 border-4 border-slate-50 rounded-3xl mb-8 shadow-inner">
          <QRCodeSVG value={urlVehiculo} size={180} level="H" includeMargin={false} />
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={guardarYDescargar} 
            disabled={procesando} 
            className={`w-full font-bold py-4 rounded-xl transition-all shadow-md ${procesando ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {procesando ? 'Procesando...' : 'Guardar y Descargar PDF'}
          </button>
          
          <Link to="/admin" className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors mt-2">
            Ver Panel Admin
          </Link>
        </div>
      </div>
    </div>
  );
}

// 4. Router
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/v/:id" element={<VistaConductor />} />
        <Route path="/admin" element={<DashboardAdmin />} />
        <Route path="/" element={<GeneradorQR />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;