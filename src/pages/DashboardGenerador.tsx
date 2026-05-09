import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, where, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { LOGO_BASE64 } from '../constants';

export default function DashboardGenerador() {
  const navigate = useNavigate();
  const [patente, setPatente] = useState('HBL123');
  const [tipoVehiculo, setTipoVehiculo] = useState('Camioneta');
  const [procesando, setProcesando] = useState(false);
  const [misQRs, setMisQRs] = useState<any[]>([]);
  const [perfil, setPerfil] = useState<any>(null);

  const urlVehiculo = `https://gestion-flota-web.vercel.app/v/${patente.toUpperCase()}`;

  const cargarDatos = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const docRef = await getDoc(doc(db, 'usuarios', user.uid));
      if (docRef.exists()) {
        setPerfil({ id: user.uid, ...docRef.data() });
      }

      const q = query(collection(db, 'qrs_guardados'), where('creadoPor', '==', user.uid), orderBy('fechaRegistro', 'desc'));
      const snap = await getDocs(q);
      setMisQRs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const manejarCerrarSesion = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const limiteAlcanzado = perfil && misQRs.length >= (perfil.limiteQR || 1);

  const guardarYDescargar = async () => {
    if (!patente) return;
    
    if (limiteAlcanzado) {
      alert(`Has alcanzado tu límite de ${perfil.limiteQR} QRs. Borra uno antiguo o contacta a soporte.`);
      return;
    }

    setProcesando(true);
    
    try {
      const patenteMayuscula = patente.toUpperCase();
      const qQR = query(collection(db, 'qrs_guardados'), where('patente', '==', patenteMayuscula));
      const qrSnapshot = await getDocs(qQR);

      if (qrSnapshot.empty) {
        await addDoc(collection(db, 'qrs_guardados'), {
          patente: patenteMayuscula,
          tipo: tipoVehiculo,
          url: urlVehiculo,
          creadoPor: perfil?.id,
          creadoPorNombre: perfil?.razonSocial || perfil?.email,
          creadoPorDetalles: `Tel: ${perfil?.telefono || 'N/A'} - Dir: ${perfil?.direccion || 'N/A'}`,
          fechaRegistro: serverTimestamp()
        });
      }

      const qVehiculo = query(collection(db, 'vehiculos'), where('patente', '==', patenteMayuscula));
      const vehiculoSnapshot = await getDocs(qVehiculo);

      if (vehiculoSnapshot.empty) {
        await addDoc(collection(db, 'vehiculos'), {
          patente: patenteMayuscula,
          tipo: tipoVehiculo,
          vencimientoRevision: '',
          vencimientoCirculacion: '',
          vencimientoCertificado: '',
          fechaRegistro: serverTimestamp()
        });
      }

      const elemento = document.getElementById('tarjeta-pdf-generador');
      if (elemento) {
        await toPng(elemento, { cacheBust: true });
        const imgData = await toPng(elemento, { quality: 1, pixelRatio: 3, backgroundColor: '#ffffff', cacheBust: true });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
        pdf.addImage(imgData, 'PNG', 0, 0, 100, 150);
        
        const nombreArchivo = `QR_${patenteMayuscula}.pdf`;
        const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const pdfBlob = pdf.output('blob');
        const file = new File([pdfBlob], nombreArchivo, { type: 'application/pdf' });

        if (esCelular && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file] }); } catch (e) { pdf.save(nombreArchivo); }
        } else {
          pdf.save(nombreArchivo);
        }
      }

      cargarDatos();
      setPatente('');
    } catch (error) {
      console.error(error);
      alert("Error al generar el PDF.");
    } finally {
      setProcesando(false);
    }
  };

  const eliminarQR = async (id: string) => {
    const confirmar = window.confirm("¿Seguro que deseas eliminar este QR? Esto liberará espacio en tu plan.");
    if (confirmar) {
      try {
        await deleteDoc(doc(db, 'qrs_guardados', id));
        cargarDatos();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const descargarPDFExistente = async (patenteGuardada: string, tipoGuardado: string) => {
    setPatente(patenteGuardada);
    setTipoVehiculo(tipoGuardado);
    setTimeout(async () => {
      const elemento = document.getElementById('tarjeta-pdf-generador');
      if (elemento) {
        try {
          await toPng(elemento, { cacheBust: true });
          const imgData = await toPng(elemento, { quality: 1, pixelRatio: 3, backgroundColor: '#ffffff', cacheBust: true });
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
          pdf.addImage(imgData, 'PNG', 0, 0, 100, 150);
          pdf.save(`QR_${patenteGuardada}.pdf`);
        } catch (error) {
          console.error(error);
        }
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 z-10 relative overflow-hidden">
      
      {/* Componente Oculto para Generar PDF */}
      <div style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -50 }}>
        <div id="tarjeta-pdf-generador" className="bg-white p-8 flex flex-col items-center justify-center" style={{ width: '400px', height: '600px' }}>
          <img src={LOGO_BASE64} alt="Logo Empresa" style={{ height: '90px', objectFit: 'contain', marginBottom: '30px' }} />
          <h2 className="text-5xl font-black text-slate-800 mb-2 tracking-widest">{patente.toUpperCase()}</h2>
          <p className="text-lg text-slate-500 font-bold uppercase mb-10">{tipoVehiculo}</p>
          <div className="bg-white p-4 rounded-3xl border-8 border-slate-800 mb-8 shadow-xl">
            <QRCodeSVG value={`https://gestion-flota-web.vercel.app/v/${patente.toUpperCase()}`} size={220} level="H" />
          </div>
          <p className="text-slate-500 font-bold text-center">Escanee para iniciar el checklist.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800">Panel de Generador</h1>
            <p className="text-slate-500 font-medium">{perfil?.razonSocial || perfil?.email}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-xl font-bold border border-purple-200">
              QRs Usados: {misQRs.length} / {perfil?.limiteQR || 1}
            </div>
            <button onClick={manejarCerrarSesion} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-xl hover:bg-slate-300 transition-all text-center">Salir</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* CREADOR DE QR */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 h-fit">
              <h2 className="text-xl font-black text-slate-800 mb-6">Nuevo Código QR</h2>
              
              <div className="mb-6">
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1">Patente / ID</label>
                <input type="text" disabled={limiteAlcanzado} value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-mono text-lg text-center focus:border-purple-500 focus:outline-none transition-all disabled:opacity-50" placeholder="EJ: ABCD12" />
              </div>

              <div className="mb-6">
                <label className="block text-xs font-black text-slate-400 uppercase mb-3 text-left ml-1">Tipo de Vehículo</label>
                <div className="flex flex-col gap-2">
                  {['Tracto camión', 'Semirremolque', 'Camioneta'].map((tipo) => (
                    <button 
                      key={tipo}
                      disabled={limiteAlcanzado}
                      onClick={() => setTipoVehiculo(tipo)}
                      className={`w-full py-3 rounded-xl text-xs font-bold transition-all border disabled:opacity-50 ${tipoVehiculo === tipo ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={guardarYDescargar} 
                disabled={procesando || limiteAlcanzado} 
                className={`w-full font-bold py-4 rounded-xl transition-all shadow-md ${limiteAlcanzado ? 'bg-red-100 text-red-500 border border-red-200 cursor-not-allowed' : procesando ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
              >
                {limiteAlcanzado ? 'Límite de Plan Alcanzado' : procesando ? 'Generando...' : 'Crear y Descargar'}
              </button>
            </div>
          </div>

          {/* LISTA DE MIS QRS */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100">
              <div className="p-6 bg-slate-50 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Mis Códigos Activos</h2>
                <p className="text-sm text-slate-500 mt-1">Si borras un código, recuperarás espacio en tu plan.</p>
              </div>

              <div className="p-6">
                {misQRs.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 font-medium">Aún no has generado ningún código QR.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {misQRs.map((qr) => (
                      <div key={qr.id} className="bg-white p-5 rounded-2xl border-2 border-slate-100 flex items-center justify-between shadow-sm hover:border-purple-200 transition-colors">
                        <div>
                          <h3 className="text-2xl font-black text-slate-800 tracking-wider">{qr.patente}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{qr.tipo}</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => descargarPDFExistente(qr.patente, qr.tipo)} className="text-[10px] font-bold bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors border border-purple-100">
                            Descargar PDF
                          </button>
                          <button onClick={() => eliminarQR(qr.id)} className="text-[10px] font-bold bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors border border-red-100">
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}