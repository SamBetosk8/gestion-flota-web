import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, where, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { LOGO_BASE64 } from '../constants';

export default function DashboardAdmin() {
  const [pestanaActiva, setPestanaActiva] = useState('reportes');
  const [busqueda, setBusqueda] = useState('');
  
  const [reportes, setReportes] = useState<any[]>([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false);
  
  const [formVehiculo, setFormVehiculo] = useState({
    patente: '',
    vencimientoRevision: '',
    vencimientoCirculacion: '',
    vencimientoCertificado: ''
  });

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
          console.error(error);
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
          console.error(error);
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
          console.error(error);
        }
      };
      cargarQrs();
    }
  }, [pestanaActiva]);

  const registrarOActualizarVehiculo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGuardandoVehiculo(true);
    const patenteMayuscula = formVehiculo.patente.toUpperCase();

    try {
      const q = query(collection(db, 'vehiculos'), where('patente', '==', patenteMayuscula));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const confirmar = window.confirm("Este vehiculo ya esta registrado. ¿Deseas actualizar sus fechas de vencimiento?");
        if (confirmar) {
          const idVehiculoExistente = querySnapshot.docs[0].id;
          await updateDoc(doc(db, 'vehiculos', idVehiculoExistente), {
            vencimientoRevision: formVehiculo.vencimientoRevision,
            vencimientoCirculacion: formVehiculo.vencimientoCirculacion,
            vencimientoCertificado: formVehiculo.vencimientoCertificado
          });
          alert("Fechas actualizadas correctamente.");
        } else {
          setGuardandoVehiculo(false);
          return;
        }
      } else {
        await addDoc(collection(db, 'vehiculos'), {
          patente: patenteMayuscula,
          vencimientoRevision: formVehiculo.vencimientoRevision,
          vencimientoCirculacion: formVehiculo.vencimientoCirculacion,
          vencimientoCertificado: formVehiculo.vencimientoCertificado,
          fechaRegistro: serverTimestamp()
        });
        alert("Vehiculo registrado correctamente.");
      }

      setFormVehiculo({ patente: '', vencimientoRevision: '', vencimientoCirculacion: '', vencimientoCertificado: '' });
      const nuevaLista = await getDocs(collection(db, 'vehiculos'));
      setVehiculos(nuevaLista.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
      alert("Error al procesar el vehiculo");
    } finally {
      setGuardandoVehiculo(false);
    }
  };

  const editarVehiculoEnFormulario = (vehiculo: any) => {
    setFormVehiculo({
      patente: vehiculo.patente,
      vencimientoRevision: vehiculo.vencimientoRevision,
      vencimientoCirculacion: vehiculo.vencimientoCirculacion,
      vencimientoCertificado: vehiculo.vencimientoCertificado || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarVehiculo = async (id: string) => {
    const confirmar = window.confirm("¿Estas seguro de que deseas eliminar este vehiculo del sistema?");
    if (confirmar) {
      try {
        await deleteDoc(doc(db, 'vehiculos', id));
        setVehiculos(prev => prev.filter(v => v.id !== id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const eliminarQR = async (id: string) => {
    const confirmar = window.confirm("¿Estas seguro de que deseas eliminar este QR guardado?");
    if (confirmar) {
      try {
        await deleteDoc(doc(db, 'qrs_guardados', id));
        setQrsGuardados(prev => prev.filter(qr => qr.id !== id));
      } catch (error) {
        console.error(error);
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
          backgroundColor: '#ffffff',
          cacheBust: true
        });
        
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
        pdf.addImage(imgData, 'PNG', 0, 0, 100, 150);
        
        const nombreArchivo = `QR_${patente}.pdf`;
        const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        const pdfBlob = pdf.output('blob');
        const file = new File([pdfBlob], nombreArchivo, { type: 'application/pdf' });

        if (esCelular && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
          } catch (e) {
            console.log("Compartir cancelado, forzando descarga.");
            pdf.save(nombreArchivo);
          }
        } else {
          pdf.save(nombreArchivo);
        }
      } catch (error) {
        console.error(error);
        alert("Ocurrio un problema al generar el documento PDF.");
      }
    }
    setGenerandoPdf(null);
  };

  const reportesFiltrados = reportes.filter(r => r.vehiculoId?.toLowerCase().includes(busqueda.toLowerCase()));
  const vehiculosFiltrados = vehiculos.filter(v => v.patente?.toLowerCase().includes(busqueda.toLowerCase()));
  const qrsFiltrados = qrsGuardados.filter(q => q.patente?.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 p-8 z-10 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800">Panel de Control</h1>
          </div>
          
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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100 xl:col-span-1 h-fit">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Añadir / Actualizar Vehiculo</h2>
              <form onSubmit={registrarOActualizarVehiculo} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Patente</label>
                  <input type="text" value={formVehiculo.patente} onChange={(e) => setFormVehiculo({...formVehiculo, patente: e.target.value})} required placeholder="Ej: AB1234" className="w-full p-3 border border-slate-300 rounded-xl uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Vencimiento Rev. Tecnica</label>
                  <input type="date" value={formVehiculo.vencimientoRevision} onChange={(e) => setFormVehiculo({...formVehiculo, vencimientoRevision: e.target.value})} required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Vencimiento Permiso Circulacion</label>
                  <input type="date" value={formVehiculo.vencimientoCirculacion} onChange={(e) => setFormVehiculo({...formVehiculo, vencimientoCirculacion: e.target.value})} required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Vencimiento Certificado</label>
                  <input type="date" value={formVehiculo.vencimientoCertificado} onChange={(e) => setFormVehiculo({...formVehiculo, vencimientoCertificado: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700" />
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" disabled={guardandoVehiculo} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-all">
                    {guardandoVehiculo ? 'Guardando...' : 'Guardar Datos'}
                  </button>
                  <button type="button" onClick={() => setFormVehiculo({ patente: '', vencimientoRevision: '', vencimientoCirculacion: '', vencimientoCertificado: '' })} className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">
                    Limpiar
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100 xl:col-span-2">
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
                      <th className="p-4 font-bold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vehiculosFiltrados.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400">No se encontraron vehiculos.</td></tr>
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
                          <td className="p-4 flex gap-2 justify-center">
                            <button onClick={() => editarVehiculoEnFormulario(vehiculo)} className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">Editar</button>
                            <button onClick={() => eliminarVehiculo(vehiculo.id)} className="text-xs font-bold px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Eliminar</button>
                          </td>
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
                  <div key={qr.id} className="flex flex-col gap-2 relative">
                    
                    <div className="bg-white p-6 rounded-3xl shadow-lg flex flex-col items-center border border-slate-100">
                      <img src={LOGO_BASE64} alt="Logo" className="h-12 object-contain mx-auto mb-4" />
                      <h3 className="text-3xl font-black text-slate-800 tracking-widest">{qr.patente}</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase mb-4">Control de Flota</p>
                      <div className="bg-white p-2 rounded-xl border-4 border-slate-800 mb-4 shadow-sm">
                        <QRCodeSVG value={qr.url} size={130} level="H" includeMargin={false} />
                      </div>
                    </div>

                    {/* Contenedor desplazado fuera de la pantalla */}
                    <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                      <div 
                        id={`tarjeta-pdf-${qr.patente}`} 
                        className="bg-white p-8 flex flex-col items-center justify-center"
                        style={{ width: '400px', height: '600px', backgroundColor: 'white' }} 
                      >
                        <img src={LOGO_BASE64} alt="Logo Empresa" style={{ height: '90px', objectFit: 'contain', marginBottom: '30px' }} />
                        <h2 className="text-5xl font-black text-slate-800 mb-2 tracking-widest">{qr.patente}</h2>
                        <p className="text-lg text-slate-500 font-bold uppercase tracking-widest mb-10">Control de Flota</p>
                        <div className="bg-white p-4 rounded-3xl border-8 border-slate-800 mb-8 shadow-xl">
                          <QRCodeSVG value={qr.url} size={220} level="H" includeMargin={false} />
                        </div>
                        <p className="text-slate-500 font-bold text-center">Escanee este codigo para iniciar<br/>el checklist de este vehiculo.</p>
                      </div>
                    </div>

                    <button onClick={() => descargarPDF(qr.patente)} disabled={generandoPdf === qr.patente} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-colors shadow-lg mt-2 relative z-10">
                      {generandoPdf === qr.patente ? 'Generando...' : 'Descargar en PDF'}
                    </button>
                    
                    <button onClick={() => eliminarQR(qr.id)} className="w-full bg-red-50 text-red-600 font-bold py-2 rounded-xl hover:bg-red-100 transition-colors relative z-10">
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