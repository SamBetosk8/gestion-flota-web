import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, where, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { initializeApp, deleteApp } from 'firebase/app';
import { db, auth, storage, firebaseConfig } from '../lib/firebase';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { LOGO_BASE64 } from '../constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [pestanaActiva, setPestanaActiva] = useState('reportes');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); 
  const [filtroTipoVehiculo, setFiltroTipoVehiculo] = useState('todos');
  
  const [limiteReportes, setLimiteReportes] = useState(10);
  const [limiteVehiculos, setLimiteVehiculos] = useState(10);
  const [limiteQRs, setLimiteQRs] = useState(12);
  
  const [reportes, setReportes] = useState<any[]>([]);
  const [citas, setCitas] = useState<any[]>([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [reporteSeleccionado, setReporteSeleccionado] = useState<any | null>(null);
  
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  
  const [formVehiculo, setFormVehiculo] = useState({
    patente: '',
    tipo: 'Camioneta',
    vencimientoRevision: '',
    vencimientoCirculacion: '',
    vencimientoCertificado: '',
    kilometrajeActual: '',
    kilometrajeTaller: '',
    urlRevision: '',
    urlCirculacion: '',
    urlCertificado: ''
  });

  const [pdfRevision, setPdfRevision] = useState<File | null>(null);
  const [pdfCirculacion, setPdfCirculacion] = useState<File | null>(null);
  const [pdfCertificado, setPdfCertificado] = useState<File | null>(null);

  const [qrsGuardados, setQrsGuardados] = useState<any[]>([]);
  const [generandoPdf, setGenerandoPdf] = useState<string | null>(null);

  const [vehiculoEstadistica, setVehiculoEstadistica] = useState<string>('');
  const [formUsuario, setFormUsuario] = useState({ email: '', password: '' });
  const [creandoUsuario, setCreandoUsuario] = useState(false);

  const manejarCerrarSesion = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const crearNuevoUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formUsuario.password.length < 6) {
      alert("La contrasena debe tener al menos 6 caracteres.");
      return;
    }
    setCreandoUsuario(true);

    try {
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      await createUserWithEmailAndPassword(secondaryAuth, formUsuario.email, formUsuario.password);
      await deleteApp(secondaryApp);
      alert("Usuario administrador creado exitosamente.");
      setFormUsuario({ email: '', password: '' });
    } catch (error: any) {
      console.error(error);
      alert(`Error al crear usuario.`);
    } finally {
      setCreandoUsuario(false);
    }
  };

  const cargarVehiculos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'vehiculos'));
      setVehiculos(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    }
  };

  const cargarCitas = async () => {
    try {
      const q = query(collection(db, 'citas_taller'), orderBy('fecha', 'desc'));
      const querySnapshot = await getDocs(q);
      setCitas(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    }
  };

  const actualizarEstadoCita = async (idCita: string, nuevoEstado: string) => {
    try {
      await updateDoc(doc(db, 'citas_taller', idCita), { estado: nuevoEstado });
      cargarCitas();
    } catch (error) {
      console.error("Error actualizando cita:", error);
    }
  };

  const eliminarCita = async (idCita: string) => {
    const confirmar = window.confirm("¿Seguro que deseas eliminar esta cita permanentemente?");
    if (!confirmar) return;
    try {
      await deleteDoc(doc(db, 'citas_taller', idCita));
      cargarCitas();
    } catch (error) {
      console.error("Error borrando cita:", error);
    }
  };

  useEffect(() => {
    setLimiteReportes(10);
    setLimiteVehiculos(10);
    setLimiteQRs(12);
  }, [pestanaActiva, busqueda, filtroEstado, filtroTipoVehiculo]);

  useEffect(() => {
    if (pestanaActiva === 'reportes' || pestanaActiva === 'estadisticas') {
      const cargarReportesYLimpiar = async () => {
        try {
          const q = query(collection(db, 'reportes'), orderBy('fecha', 'asc'));
          const querySnapshot = await getDocs(q);
          const reportesData: any[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          const limiteDias = new Date();
          limiteDias.setDate(limiteDias.getDate() - 15);
          
          const reportesValidos = [];

          for (const rep of reportesData) {
            if (rep.fecha && typeof rep.fecha.toDate === 'function') {
              if (rep.fecha.toDate().getTime() < limiteDias.getTime()) {
                try {
                  if (rep.fotoPath && typeof rep.fotoPath === 'string' && !rep.fotoEliminada) {
                    const fotoRef = ref(storage, rep.fotoPath);
                    await deleteObject(fotoRef).catch(e => console.log("Foto ya no existe", e));
                  }
                  await deleteDoc(doc(db, 'reportes', rep.id));
                  console.log(`Reporte eliminado por antiguedad (+15 dias): ${rep.id}`);
                } catch (e) {
                  console.error("Error al borrar reporte antiguo:", e);
                }
              } else {
                if (rep.tipoVehiculo === 'Semi remolque') rep.tipoVehiculo = 'Semirremolque';
                reportesValidos.push(rep);
              }
            } else {
              if (rep.tipoVehiculo === 'Semi remolque') rep.tipoVehiculo = 'Semirremolque';
              reportesValidos.push(rep); 
            }
          }

          setReportes(reportesValidos.reverse());
        } catch (error) {
          console.error(error);
        } finally {
          setCargandoReportes(false);
        }
      };
      cargarReportesYLimpiar();
    }
  }, [pestanaActiva]);

  useEffect(() => {
    if (pestanaActiva === 'vehiculos') cargarVehiculos();
  }, [pestanaActiva]);

  useEffect(() => {
    if (pestanaActiva === 'qrs') {
      const cargarQrs = async () => {
        try {
          const q = query(collection(db, 'qrs_guardados'), orderBy('fechaRegistro', 'desc'));
          const querySnapshot = await getDocs(q);
          setQrsGuardados(querySnapshot.docs.map(doc => {
            const data = doc.data();
            if (data.tipo === 'Semi remolque') data.tipo = 'Semirremolque';
            return { id: doc.id, ...data };
          }));
        } catch (error) {
          console.error(error);
        }
      };
      cargarQrs();
    }
  }, [pestanaActiva]);

  useEffect(() => {
    if (pestanaActiva === 'agenda') cargarCitas();
  }, [pestanaActiva]);

  const eliminarReporteIndividual = async (id: string, fotoPath: string | null) => {
    const confirmar = window.confirm("Estas seguro de que deseas eliminar este registro de forma permanente?");
    if (!confirmar) return;

    try {
      if (fotoPath) {
        const fotoRef = ref(storage, fotoPath);
        await deleteObject(fotoRef).catch(e => console.log("Error o foto ya borrada:", e));
      }
      await deleteDoc(doc(db, 'reportes', id));
      setReportes(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error(error);
      alert("Hubo un error al eliminar el registro.");
    }
  };

  const eliminarTodosLosReportes = async () => {
    const confirmar = window.confirm("ADVERTENCIA: Vas a eliminar TODOS los registros diarios almacenados en la base de datos. Esto no se puede deshacer. Continuar?");
    if (!confirmar) return;

    try {
      for (const rep of reportes) {
        if (rep.fotoPath && !rep.fotoEliminada) {
          const fotoRef = ref(storage, rep.fotoPath);
          await deleteObject(fotoRef).catch(e => console.log(e));
        }
        await deleteDoc(doc(db, 'reportes', rep.id));
      }
      setReportes([]);
      alert("Todos los registros han sido eliminados correctamente.");
    } catch (error) {
      console.error(error);
      alert("Hubo un error durante la eliminacion masiva.");
    }
  };

  const registrarOActualizarVehiculo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGuardandoVehiculo(true);
    const patenteMayuscula = formVehiculo.patente.toUpperCase();

    try {
      let urlRev = formVehiculo.urlRevision;
      if (pdfRevision) {
        const revRef = ref(storage, `documentos/${patenteMayuscula}/revision.pdf`);
        await uploadBytes(revRef, pdfRevision);
        urlRev = await getDownloadURL(revRef);
      }

      let urlCirc = formVehiculo.urlCirculacion;
      if (pdfCirculacion) {
        const circRef = ref(storage, `documentos/${patenteMayuscula}/circulacion.pdf`);
        await uploadBytes(circRef, pdfCirculacion);
        urlCirc = await getDownloadURL(circRef);
      }

      let urlCert = formVehiculo.urlCertificado;
      if (pdfCertificado) {
        const certRef = ref(storage, `documentos/${patenteMayuscula}/certificado.pdf`);
        await uploadBytes(certRef, pdfCertificado);
        urlCert = await getDownloadURL(certRef);
      }

      const q = query(collection(db, 'vehiculos'), where('patente', '==', patenteMayuscula));
      const querySnapshot = await getDocs(q);

      const datosVehiculo = {
        tipo: formVehiculo.tipo,
        vencimientoRevision: formVehiculo.vencimientoRevision,
        vencimientoCirculacion: formVehiculo.vencimientoCirculacion,
        vencimientoCertificado: formVehiculo.vencimientoCertificado,
        kilometrajeActual: formVehiculo.kilometrajeActual,
        kilometrajeTaller: formVehiculo.kilometrajeTaller,
        urlRevision: urlRev,
        urlCirculacion: urlCirc,
        urlCertificado: urlCert
      };

      if (!querySnapshot.empty) {
        const idVehiculoExistente = querySnapshot.docs[0].id;
        await updateDoc(doc(db, 'vehiculos', idVehiculoExistente), datosVehiculo);
        alert("Datos y documentos actualizados correctamente.");
      } else {
        await addDoc(collection(db, 'vehiculos'), {
          ...datosVehiculo,
          patente: patenteMayuscula,
          fechaRegistro: serverTimestamp()
        });
        alert("Vehiculo registrado correctamente.");
      }

      setFormVehiculo({ patente: '', tipo: 'Camioneta', vencimientoRevision: '', vencimientoCirculacion: '', vencimientoCertificado: '', kilometrajeActual: '', kilometrajeTaller: '', urlRevision: '', urlCirculacion: '', urlCertificado: '' });
      setPdfRevision(null);
      setPdfCirculacion(null);
      setPdfCertificado(null);
      
      const fileRev = document.getElementById('file-rev') as HTMLInputElement;
      if (fileRev) fileRev.value = "";
      const fileCirc = document.getElementById('file-circ') as HTMLInputElement;
      if (fileCirc) fileCirc.value = "";
      const fileCert = document.getElementById('file-cert') as HTMLInputElement;
      if (fileCert) fileCert.value = "";

      cargarVehiculos();
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
      tipo: vehiculo.tipo === 'Semi remolque' ? 'Semirremolque' : (vehiculo.tipo || 'Camioneta'),
      vencimientoRevision: vehiculo.vencimientoRevision || '',
      vencimientoCirculacion: vehiculo.vencimientoCirculacion || '',
      vencimientoCertificado: vehiculo.vencimientoCertificado || '',
      kilometrajeActual: vehiculo.kilometrajeActual || '',
      kilometrajeTaller: vehiculo.kilometrajeTaller || '',
      urlRevision: vehiculo.urlRevision || '',
      urlCirculacion: vehiculo.urlCirculacion || '',
      urlCertificado: vehiculo.urlCertificado || ''
    });
    setPdfRevision(null);
    setPdfCirculacion(null);
    setPdfCertificado(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarVehiculo = async (id: string) => {
    const confirmar = window.confirm("Estas seguro de que deseas eliminar este vehiculo del sistema?");
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
    const confirmar = window.confirm("Estas seguro de que deseas eliminar este QR guardado?");
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

  const sincronizarQRsAntiguos = async () => {
    const confirmar = window.confirm("Quieres buscar QRs antiguos que no esten en tu lista de vehiculos y agregarlos automaticamente?");
    if (!confirmar) return;

    setSincronizando(true);
    try {
      const qrsSnap = await getDocs(collection(db, 'qrs_guardados'));
      const vehsSnap = await getDocs(collection(db, 'vehiculos'));
      
      const patentesVehiculos = new Set(vehsSnap.docs.map(doc => doc.data().patente));
      let agregados = 0;

      for (const docQr of qrsSnap.docs) {
        const dataQr = docQr.data();
        const patenteQR = dataQr.patente;
        if (!patentesVehiculos.has(patenteQR)) {
          const tipoCorregido = dataQr.tipo === 'Semi remolque' ? 'Semirremolque' : (dataQr.tipo || 'Camioneta');
          await addDoc(collection(db, 'vehiculos'), {
            patente: patenteQR,
            tipo: tipoCorregido,
            vencimientoRevision: '',
            vencimientoCirculacion: '',
            vencimientoCertificado: '',
            kilometrajeActual: '',
            kilometrajeTaller: '',
            urlRevision: '',
            urlCirculacion: '',
            urlCertificado: '',
            fechaRegistro: serverTimestamp()
          });
          patentesVehiculos.add(patenteQR);
          agregados++;
        }
      }

      if (agregados > 0) {
        alert(`Sincronizacion exitosa. Se agregaron ${agregados} vehiculos nuevos desde los QRs.`);
        cargarVehiculos();
      } else {
        alert("Todo esta al dia. No hay QRs antiguos que falten en la lista de vehiculos.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSincronizando(false);
    }
  };

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
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(urlBlob);
      }, 100);
    } catch (error) {
      console.error("Error al descargar, abriendo en nueva pestana:", error);
      window.open(url, '_blank');
    }
  };

  const calcularEstadoVencimiento = (fechaString: string) => {
    if (!fechaString) return { texto: 'No registrado', clase: 'text-slate-500 bg-slate-100 border-slate-200' };
    
    const [year, month, day] = fechaString.split('-').map(Number);
    const fechaVencimiento = new Date(year, month - 1, day);
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const diferenciaTiempo = fechaVencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.round(diferenciaTiempo / (1000 * 3600 * 24));

    if (diasRestantes < 0) return { texto: `Venció hace ${Math.abs(diasRestantes)}d`, clase: 'bg-red-100 text-red-700 font-bold border-red-200' };
    if (diasRestantes === 0) return { texto: 'Vence hoy', clase: 'bg-red-100 text-red-700 border-red-200' };
    if (diasRestantes <= 15) return { texto: `Vence en ${diasRestantes}d`, clase: 'bg-orange-100 text-orange-700 font-bold border-orange-200' };
    return { texto: `Al día (${diasRestantes}d)`, clase: 'bg-green-100 text-green-700 font-bold border-green-200' };
  };

  const descargarPDF = async (patente: string) => {
    setGenerandoPdf(patente);
    const elemento = document.getElementById(`tarjeta-pdf-${patente}`);
    if (elemento) {
      try {
        await toPng(elemento, { cacheBust: true });

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
            pdf.save(nombreArchivo);
          }
        } else {
          pdf.save(nombreArchivo);
        }
      } catch (error) {
        console.error(error);
      }
    }
    setGenerandoPdf(null);
  };

  const reportesFiltrados = reportes.filter(r => {
    const coincidePatente = r.vehiculoId?.toLowerCase().includes(busqueda.toLowerCase());
    let coincideEstado = true;
    if (filtroEstado === 'aprobados') coincideEstado = !r.fallaCritica;
    if (filtroEstado === 'bloqueados') coincideEstado = r.fallaCritica;
    const coincideTipo = filtroTipoVehiculo === 'todos' || r.tipoVehiculo === filtroTipoVehiculo;
    return coincidePatente && coincideEstado && coincideTipo;
  });

  const vehiculosFiltrados = vehiculos.filter(v => {
    const coincidePatente = v.patente?.toLowerCase().includes(busqueda.toLowerCase());
    const tipoNorm = v.tipo === 'Semi remolque' ? 'Semirremolque' : v.tipo;
    const coincideTipo = filtroTipoVehiculo === 'todos' || tipoNorm === filtroTipoVehiculo;
    return coincidePatente && coincideTipo;
  });

  const qrsFiltrados = qrsGuardados.filter(q => {
    const coincidePatente = q.patente?.toLowerCase().includes(busqueda.toLowerCase());
    const tipoNorm = q.tipo === 'Semi remolque' ? 'Semirremolque' : q.tipo;
    const coincideTipo = filtroTipoVehiculo === 'todos' || tipoNorm === filtroTipoVehiculo;
    return coincidePatente && coincideTipo;
  });

  const reportesPaginados = reportesFiltrados.slice(0, limiteReportes);
  const vehiculosPaginados = vehiculosFiltrados.slice(0, limiteVehiculos);
  const qrsPaginados = qrsFiltrados.slice(0, limiteQRs);

  const estadisticas = useMemo(() => {
    if (!vehiculoEstadistica) return { datos: [], kpis: null };

    const reportesVehiculo = [...reportes]
      .filter(r => r.vehiculoId === vehiculoEstadistica && r.kilometraje !== "No ingresado")
      .sort((a, b) => {
        const fechaA = a.fecha?.toMillis() || 0;
        const fechaB = b.fecha?.toMillis() || 0;
        return fechaA - fechaB;
      });

    if (reportesVehiculo.length < 2) return { datos: [], kpis: null };

    const registroPorDia: Record<string, { maxKm: number, timestamp: number }> = {};
    
    reportesVehiculo.forEach(rep => {
      const fechaObj = rep.fecha?.toDate();
      if (!fechaObj) return;
      
      const fechaStr = `${fechaObj.getDate()}/${fechaObj.getMonth() + 1}`;
      const kms = Number(rep.kilometraje);

      if (!isNaN(kms)) {
        if (!registroPorDia[fechaStr] || kms > registroPorDia[fechaStr].maxKm) {
          registroPorDia[fechaStr] = { maxKm: kms, timestamp: fechaObj.getTime() };
        }
      }
    });

    const diasOrdenados = Object.keys(registroPorDia)
      .map(fecha => ({
        fecha,
        maxKm: registroPorDia[fecha].maxKm,
        timestamp: registroPorDia[fecha].timestamp
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const datos = [];
    let totalKms = 0;
    let maxDia = { fecha: '-', kms: 0 };

    for (let i = 1; i < diasOrdenados.length; i++) {
      let diferencia = diasOrdenados[i].maxKm - diasOrdenados[i - 1].maxKm;
      if (diferencia < 0) diferencia = 0; 

      datos.push({
        fecha: diasOrdenados[i].fecha,
        kmsRecorridos: diferencia,
        kilometrajeTotal: diasOrdenados[i].maxKm
      });
    }

    const ultimos15 = datos.slice(-15);

    ultimos15.forEach(d => {
      totalKms += d.kmsRecorridos;
      if (d.kmsRecorridos > maxDia.kms) {
        maxDia = { fecha: d.fecha, kms: d.kmsRecorridos };
      }
    });

    const promedio = ultimos15.length > 0 ? Math.round(totalKms / ultimos15.length) : 0;

    return {
      datos: ultimos15,
      kpis: {
        total: totalKms,
        promedio: promedio,
        maximo: maxDia
      }
    };
  }, [reportes, vehiculoEstadistica]);

  const vehiculosConReportes = Array.from(new Set(reportes.filter(r => r.vehiculoId).map(r => r.vehiculoId)));

  useEffect(() => {
    if (pestanaActiva === 'estadisticas' && vehiculosConReportes.length > 0 && !vehiculoEstadistica) {
      setVehiculoEstadistica(vehiculosConReportes[0]);
    }
  }, [pestanaActiva, vehiculosConReportes]);

  return (
    <div className="min-h-screen bg-slate-50 p-8 z-10 relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-200 pb-6">
          <div><h1 className="text-3xl font-black text-slate-800">Panel de Control</h1></div>
          
          <div className="w-full md:w-auto flex-1 max-w-2xl mx-auto md:mx-4 flex gap-2">
            <input type="text" placeholder="Buscar patente... Ej: AB12" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white shadow-sm" />
            <select 
              value={filtroTipoVehiculo} 
              onChange={(e) => setFiltroTipoVehiculo(e.target.value)} 
              className="p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none bg-white shadow-sm font-bold text-slate-600 min-w-[150px]"
            >
              <option value="todos">Todos los Tipos</option>
              <option value="Tracto camión">Tracto camión</option>
              <option value="Semirremolque">Semirremolque</option>
              <option value="Camioneta">Camioneta</option>
            </select>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <Link to="/generador" className="flex-1 bg-white text-blue-600 border-2 border-blue-600 font-bold py-3 px-6 rounded-xl hover:bg-blue-50 transition-all text-center">Generar QR</Link>
            <button onClick={manejarCerrarSesion} className="flex-1 bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-slate-300 transition-all text-center">Salir</button>
          </div>
        </div>

        <div className="flex space-x-4 mb-8 overflow-x-auto pb-2">
          <button onClick={() => setPestanaActiva('reportes')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'reportes' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Historial</button>
          <button onClick={() => setPestanaActiva('vehiculos')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'vehiculos' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Flota</button>
          <button onClick={() => setPestanaActiva('qrs')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'qrs' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Codigos QR</button>
          <button onClick={() => setPestanaActiva('agenda')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'agenda' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Agenda Taller</button>
          <button onClick={() => setPestanaActiva('estadisticas')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'estadisticas' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Estadisticas</button>
          <button onClick={() => setPestanaActiva('usuarios')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'usuarios' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Usuarios</button>
        </div>

        {/* CONTENIDO REPORTES */}
        {pestanaActiva === 'reportes' && (
          <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <h2 className="text-xl font-bold text-slate-800">Registros Diarios {filtroTipoVehiculo !== 'todos' && <span className="text-sm font-normal text-slate-500">({filtroTipoVehiculo}s)</span>}</h2>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  <button onClick={() => setFiltroEstado('todos')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filtroEstado === 'todos' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Todos</button>
                  <button onClick={() => setFiltroEstado('aprobados')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filtroEstado === 'aprobados' ? 'bg-green-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Aprobados</button>
                  <button onClick={() => setFiltroEstado('bloqueados')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filtroEstado === 'bloqueados' ? 'bg-red-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Bloqueados</button>
                </div>
                {reportes.length > 0 && (
                  <button onClick={eliminarTodosLosReportes} className="px-4 py-2 rounded-lg text-sm font-bold transition-all bg-red-600 text-white hover:bg-red-700 shadow-sm flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Borrar Todos
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-slate-600 text-sm uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4 font-bold">Fecha</th>
                    <th className="p-4 font-bold">Patente</th>
                    <th className="p-4 font-bold">Kilometraje</th>
                    <th className="p-4 font-bold text-center">Estado</th>
                    <th className="p-4 font-bold text-center">Evidencia</th>
                    <th className="p-4 font-bold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cargandoReportes ? (<tr><td colSpan={6} className="p-8 text-center text-slate-400">Cargando reportes...</td></tr>) 
                  : reportesPaginados.length === 0 ? (<tr><td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron reportes.</td></tr>) 
                  : reportesPaginados.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50">
                      <td className="p-4 text-slate-600 text-sm">{rep.fecha ? rep.fecha.toDate().toLocaleString() : 'Reciente'}</td>
                      <td className="p-4">
                        <span className="font-bold text-slate-800 block">{rep.vehiculoId}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{rep.tipoVehiculo || 'Desconocido'}</span>
                      </td>
                      <td className="p-4 text-slate-600 font-mono">{rep.kilometraje}</td>
                      <td className="p-4 text-center">{rep.fallaCritica ? <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">BLOQUEADO</span> : <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">APROBADO</span>}</td>
                      <td className="p-4 text-center">
                        {rep.fotoUrl ? (
                          <a href={rep.fotoUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm font-medium">Ver Foto</a>
                        ) : rep.fotoEliminada ? (
                          <span className="text-slate-400 text-xs italic">Eliminada</span>
                        ) : (
                          <span className="text-slate-400 text-sm">Sin foto</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => setReporteSeleccionado(rep)} className="text-xs font-bold px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100">Ver Detalles</button>
                          <button onClick={() => eliminarReporteIndividual(rep.id, rep.fotoPath)} className="text-xs font-bold px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-100">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportesFiltrados.length > limiteReportes && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                  <button onClick={() => setLimiteReportes(prev => prev + 10)} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition-colors">Mostrar mas registros</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VENTANA MODAL PARA DETALLES DEL CHECKLIST */}
        {reporteSeleccionado && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fade-in">
              <h3 className="text-2xl font-black text-slate-800 mb-1 border-b border-slate-100 pb-4">Detalles del Checklist</h3>
              <p className="text-sm text-slate-500 mb-6 mt-2">Vehiculo: <span className="font-bold text-slate-800 text-lg">{reporteSeleccionado.vehiculoId}</span></p>
              
              <div className="max-h-80 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {reporteSeleccionado.respuestas ? (
                  Object.entries(reporteSeleccionado.respuestas).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <span className="capitalize text-slate-700 font-medium text-sm">{k.replace(/_/g, ' ')}</span>
                      <span className={`font-black text-xs px-3 py-1 rounded-lg border ${String(v).toLowerCase() === 'no' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                        {String(v).toUpperCase()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No hay respuestas registradas.</p>
                )}
              </div>
              <button onClick={() => setReporteSeleccionado(null)} className="mt-8 w-full bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-colors shadow-lg">Cerrar Detalles</button>
            </div>
          </div>
        )}

        {/* CONTENIDO VEHICULOS */}
        {pestanaActiva === 'vehiculos' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100 xl:col-span-1 h-fit">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">Anadir Vehiculo</h2>
                <button 
                  type="button" 
                  onClick={sincronizarQRsAntiguos} 
                  disabled={sincronizando} 
                  className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
                >
                  {sincronizando ? 'Sincronizando...' : 'Sincronizar QRs'}
                </button>
              </div>
              <form onSubmit={registrarOActualizarVehiculo} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Patente</label>
                    <input type="text" value={formVehiculo.patente} onChange={(e) => setFormVehiculo({...formVehiculo, patente: e.target.value})} required placeholder="Ej: AB1234" className="w-full p-3 border border-slate-300 rounded-xl uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Tipo</label>
                    <select value={formVehiculo.tipo} onChange={(e) => setFormVehiculo({...formVehiculo, tipo: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                      <option value="Camioneta">Camioneta</option>
                      <option value="Tracto camión">Tracto camión</option>
                      <option value="Semirremolque">Semirremolque</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Km Actual</label>
                    <input type="number" value={formVehiculo.kilometrajeActual} onChange={(e) => setFormVehiculo({...formVehiculo, kilometrajeActual: e.target.value})} placeholder="Ej: 15000" className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Prox. Taller</label>
                    <input type="number" value={formVehiculo.kilometrajeTaller} onChange={(e) => setFormVehiculo({...formVehiculo, kilometrajeTaller: e.target.value})} placeholder="Ej: 25000" className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                </div>
                
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Rev. Tecnica</label>
                  <input type="date" value={formVehiculo.vencimientoRevision} onChange={(e) => setFormVehiculo({...formVehiculo, vencimientoRevision: e.target.value})} required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 mb-2" />
                  
                  <div className="flex flex-col gap-2">
                    {!pdfRevision ? (
                      <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold border border-blue-200 hover:bg-blue-100 transition-colors text-center">
                        Seleccionar PDF
                        <input type="file" id="file-rev" accept="application/pdf" onChange={(e) => setPdfRevision(e.target.files ? e.target.files[0] : null)} className="hidden" />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-600 truncate max-w-[150px] font-medium">{pdfRevision.name}</span>
                        <button type="button" onClick={() => { setPdfRevision(null); const el = document.getElementById('file-rev') as HTMLInputElement; if (el) el.value = ''; }} className="text-xs text-red-500 font-bold hover:underline bg-red-50 px-2 py-1 rounded">Quitar</button>
                      </div>
                    )}
                    {formVehiculo.urlRevision && !pdfRevision && (
                      <div className="flex flex-col gap-2 bg-green-50 p-2 rounded-xl border border-green-200">
                        <span className="text-xs text-green-700 font-bold text-center">PDF Actual Guardado</span>
                        <button type="button" onClick={() => forzarDescarga(formVehiculo.urlRevision, `Revision_${formVehiculo.patente}.pdf`)} className="w-full text-xs bg-white text-green-700 px-3 py-2 rounded-lg shadow-sm font-bold hover:bg-green-100 border border-green-200 flex items-center justify-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Descargar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 mt-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Permiso Circulacion</label>
                  <input type="date" value={formVehiculo.vencimientoCirculacion} onChange={(e) => setFormVehiculo({...formVehiculo, vencimientoCirculacion: e.target.value})} required className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 mb-2" />
                  
                  <div className="flex flex-col gap-2">
                    {!pdfCirculacion ? (
                      <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold border border-blue-200 hover:bg-blue-100 transition-colors text-center">
                        Seleccionar PDF
                        <input type="file" id="file-circ" accept="application/pdf" onChange={(e) => setPdfCirculacion(e.target.files ? e.target.files[0] : null)} className="hidden" />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-600 truncate max-w-[150px] font-medium">{pdfCirculacion.name}</span>
                        <button type="button" onClick={() => { setPdfCirculacion(null); const el = document.getElementById('file-circ') as HTMLInputElement; if (el) el.value = ''; }} className="text-xs text-red-500 font-bold hover:underline bg-red-50 px-2 py-1 rounded">Quitar</button>
                      </div>
                    )}
                    {formVehiculo.urlCirculacion && !pdfCirculacion && (
                      <div className="flex flex-col gap-2 bg-green-50 p-2 rounded-xl border border-green-200">
                        <span className="text-xs text-green-700 font-bold text-center">PDF Actual Guardado</span>
                        <button type="button" onClick={() => forzarDescarga(formVehiculo.urlCirculacion, `Circulacion_${formVehiculo.patente}.pdf`)} className="w-full text-xs bg-white text-green-700 px-3 py-2 rounded-lg shadow-sm font-bold hover:bg-green-100 border border-green-200 flex items-center justify-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Descargar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 mt-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1">Certificado</label>
                  <input type="date" value={formVehiculo.vencimientoCertificado} onChange={(e) => setFormVehiculo({...formVehiculo, vencimientoCertificado: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 mb-2" />
                  
                  <div className="flex flex-col gap-2">
                    {!pdfCertificado ? (
                      <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold border border-blue-200 hover:bg-blue-100 transition-colors text-center">
                        Seleccionar PDF
                        <input type="file" id="file-cert" accept="application/pdf" onChange={(e) => setPdfCertificado(e.target.files ? e.target.files[0] : null)} className="hidden" />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-100 p-2 rounded-xl border border-slate-200">
                        <span className="text-xs text-slate-600 truncate max-w-[150px] font-medium">{pdfCertificado.name}</span>
                        <button type="button" onClick={() => { setPdfCertificado(null); const el = document.getElementById('file-cert') as HTMLInputElement; if (el) el.value = ''; }} className="text-xs text-red-500 font-bold hover:underline bg-red-50 px-2 py-1 rounded">Quitar</button>
                      </div>
                    )}
                    {formVehiculo.urlCertificado && !pdfCertificado && (
                      <div className="flex flex-col gap-2 bg-green-50 p-2 rounded-xl border border-green-200">
                        <span className="text-xs text-green-700 font-bold text-center">PDF Actual Guardado</span>
                        <button type="button" onClick={() => forzarDescarga(formVehiculo.urlCertificado, `Certificado_${formVehiculo.patente}.pdf`)} className="w-full text-xs bg-white text-green-700 px-3 py-2 rounded-lg shadow-sm font-bold hover:bg-green-100 border border-green-200 flex items-center justify-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Descargar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-6 pt-4">
                  <button type="submit" disabled={guardandoVehiculo} className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-all">{guardandoVehiculo ? 'Guardando...' : 'Guardar Datos'}</button>
                  <button type="button" onClick={() => setFormVehiculo({ patente: '', tipo: 'Camioneta', vencimientoRevision: '', vencimientoCirculacion: '', vencimientoCertificado: '', kilometrajeActual: '', kilometrajeTaller: '', urlRevision: '', urlCirculacion: '', urlCertificado: '' })} className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">Limpiar</button>
                </div>
              </form>
            </div>
            
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100 xl:col-span-2">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold text-slate-800">Estado de Documentos</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4 font-bold">Vehiculo</th><th className="p-4 font-bold">Rev. Tecnica</th><th className="p-4 font-bold">Permiso Circ.</th><th className="p-4 font-bold">Certificado</th><th className="p-4 font-bold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vehiculosPaginados.length === 0 ? (<tr><td colSpan={5} className="p-8 text-center text-slate-400">No se encontraron vehiculos.</td></tr>) 
                    : vehiculosPaginados.map((vehiculo) => {
                      const revInfo = calcularEstadoVencimiento(vehiculo.vencimientoRevision);
                      const circInfo = calcularEstadoVencimiento(vehiculo.vencimientoCirculacion);
                      const certInfo = calcularEstadoVencimiento(vehiculo.vencimientoCertificado);
                      return (
                        <tr key={vehiculo.id} className="hover:bg-slate-50">
                          <td className="p-4">
                            <span className="font-black text-slate-800 text-lg block">{vehiculo.patente}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{vehiculo.tipo || 'Camioneta'}</span>
                            <div className="flex gap-2 text-[10px] bg-slate-100 px-2 py-1 rounded-md inline-flex border border-slate-200">
                              <span className="font-medium text-slate-600">KM: <span className="font-bold text-slate-800">{vehiculo.kilometrajeActual || '--'}</span></span>
                              <span className="text-slate-300">|</span>
                              <span className="font-medium text-blue-600">Taller: <span className="font-bold">{vehiculo.kilometrajeTaller || '--'}</span></span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col items-start gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs border ${revInfo.clase}`}>{revInfo.texto}</span>
                              {vehiculo.urlRevision && (
                                <button onClick={() => forzarDescarga(vehiculo.urlRevision, `Revision_${vehiculo.patente}.pdf`)} className="text-[10px] w-full font-bold bg-white text-slate-700 border border-slate-200 px-2 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 hover:text-blue-600 transition-all flex items-center justify-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  Descargar
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col items-start gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs border ${circInfo.clase}`}>{circInfo.texto}</span>
                              {vehiculo.urlCirculacion && (
                                <button onClick={() => forzarDescarga(vehiculo.urlCirculacion, `Circulacion_${vehiculo.patente}.pdf`)} className="text-[10px] w-full font-bold bg-white text-slate-700 border border-slate-200 px-2 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 hover:text-blue-600 transition-all flex items-center justify-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  Descargar
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col items-start gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs border ${certInfo.clase}`}>{certInfo.texto}</span>
                              {vehiculo.urlCertificado && (
                                <button onClick={() => forzarDescarga(vehiculo.urlCertificado, `Certificado_${vehiculo.patente}.pdf`)} className="text-[10px] w-full font-bold bg-white text-slate-700 border border-slate-200 px-2 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 hover:text-blue-600 transition-all flex items-center justify-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  Descargar
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4 flex gap-2 justify-center mt-2">
                            <button onClick={() => editarVehiculoEnFormulario(vehiculo)} className="text-xs font-bold px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">Editar</button>
                            <button onClick={() => eliminarVehiculo(vehiculo.id)} className="text-xs font-bold px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">Eliminar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {vehiculosFiltrados.length > limiteVehiculos && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <button onClick={() => setLimiteVehiculos(prev => prev + 10)} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition-colors">Mostrar mas vehiculos</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO QRS */}
        {pestanaActiva === 'qrs' && (
          <div>
            {qrsPaginados.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl shadow-lg text-center border border-slate-100">
                <p className="text-slate-500 text-lg">No se encontraron codigos QR guardados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {qrsPaginados.map((qr) => {
                  const urlCorregida = qr.url?.replace(/http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g, 'https://gestion-flota-web.vercel.app') || '';

                  return (
                    <div key={qr.id} className="flex flex-col gap-2 relative">
                      
                      <div className="bg-white p-6 rounded-3xl shadow-lg flex flex-col items-center border border-slate-100">
                        <img src={LOGO_BASE64} alt="Logo" className="h-12 object-contain mx-auto mb-4" />
                        <h3 className="text-3xl font-black text-slate-800 tracking-widest">{qr.patente}</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase mb-4">{qr.tipo || 'Control de Flota'}</p>
                        <div className="bg-white p-2 rounded-xl border-4 border-slate-800 mb-4 shadow-sm">
                          <QRCodeSVG value={urlCorregida} size={130} level="H" includeMargin={false} />
                        </div>
                      </div>

                      <div style={{ position: 'fixed', top: 0, left: 0, opacity: 0.01, pointerEvents: 'none', zIndex: -9999 }}>
                        <div id={`tarjeta-pdf-${qr.patente}`} className="bg-white p-8 flex flex-col items-center justify-center" style={{ width: '400px', height: '600px', backgroundColor: 'white' }}>
                          <img src={LOGO_BASE64} alt="Logo Empresa" style={{ height: '90px', objectFit: 'contain', marginBottom: '30px' }} />
                          <h2 className="text-5xl font-black text-slate-800 mb-2 tracking-widest">{qr.patente}</h2>
                          <p className="text-lg text-slate-500 font-bold uppercase tracking-widest mb-10">{qr.tipo || 'Control de Flota'}</p>
                          <div className="bg-white p-4 rounded-3xl border-8 border-slate-800 mb-8 shadow-xl">
                            <QRCodeSVG value={urlCorregida} size={220} level="H" includeMargin={false} />
                          </div>
                          <p className="text-slate-500 font-bold text-center">Escanee este codigo para iniciar el checklist.</p>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full mt-2 relative z-10">
                        <button onClick={() => descargarPDF(qr.patente)} disabled={generandoPdf === qr.patente} className="flex-1 bg-slate-800 text-white font-bold py-2 rounded-xl hover:bg-slate-900 transition-colors shadow-sm text-sm">
                          {generandoPdf === qr.patente ? '...' : 'Descargar'}
                        </button>
                        <a href={urlCorregida} target="_blank" rel="noreferrer" className="flex-1 text-center bg-blue-50 text-blue-600 font-bold py-2 rounded-xl hover:bg-blue-100 transition-colors text-sm">Probar</a>
                      </div>
                      
                      <button onClick={() => eliminarQR(qr.id)} className="w-full bg-red-50 text-red-600 font-bold py-2 rounded-xl hover:bg-red-100 transition-colors relative z-10 text-sm">Eliminar QR</button>
                    </div>
                  );
                })}
              </div>
            )}
            
            {qrsFiltrados.length > limiteQRs && (
              <div className="mt-8 text-center">
                <button onClick={() => setLimiteQRs(prev => prev + 12)} className="px-8 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition-colors">Mostrar mas QRs</button>
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO AGENDA TALLER */}
        {pestanaActiva === 'agenda' && (
          <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100">
            <div className="p-6 bg-slate-50 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Citas Agendadas</h2>
              <p className="text-sm text-slate-500 mt-1">Administra las horas que los conductores han reservado.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-slate-600 text-sm uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4 font-bold">Fecha / Hora</th>
                    <th className="p-4 font-bold">Vehiculo</th>
                    <th className="p-4 font-bold text-center">Estado</th>
                    <th className="p-4 font-bold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {citas.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">No hay citas agendadas.</td></tr>
                  ) : (
                    citas.map((cita) => (
                      <tr key={cita.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <span className="font-bold text-slate-800 block">{cita.fecha}</span>
                          <span className="text-sm font-medium text-slate-500">{cita.hora}</span>
                        </td>
                        <td className="p-4 font-black text-blue-600 text-lg">{cita.patente}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            cita.estado === 'pendiente' ? 'bg-orange-100 text-orange-700 border-orange-200' : 
                            cita.estado === 'completada' ? 'bg-green-100 text-green-700 border-green-200' : 
                            'bg-red-100 text-red-700 border-red-200'
                          }`}>
                            {cita.estado.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            {cita.estado === 'pendiente' && (
                              <>
                                <button onClick={() => actualizarEstadoCita(cita.id, 'completada')} className="text-xs font-bold px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 border border-green-200">Completar</button>
                                <button onClick={() => actualizarEstadoCita(cita.id, 'cancelada')} className="text-xs font-bold px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 border border-slate-200">Cancelar</button>
                              </>
                            )}
                            <button onClick={() => eliminarCita(cita.id)} className="text-xs font-bold px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTENIDO ESTADISTICAS */}
        {pestanaActiva === 'estadisticas' && (
          <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-slate-100 pb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Variacion de Kilometraje</h2>
                <p className="text-sm text-slate-500 mt-1">Ultimos 15 dias de registro</p>
              </div>
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Seleccionar Vehiculo</label>
                <select value={vehiculoEstadistica} onChange={(e) => setVehiculoEstadistica(e.target.value)} className="w-full sm:w-64 p-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none font-bold text-slate-700">
                  {vehiculosConReportes.length === 0 ? (<option value="">Sin registros</option>) : (vehiculosConReportes.map(v => (<option key={v} value={v}>{v}</option>)))}
                </select>
              </div>
            </div>

            {estadisticas.datos.length === 0 ? (
              <div className="flex items-center justify-center h-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-medium">Necesitas reportes en al menos 2 dias distintos para generar la grafica.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                
                <div className="lg:col-span-3 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={estadisticas.datos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="fecha" tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill: '#94a3b8', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val} km`} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [`${value} km recorridos`, 'Variacion']} labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="monotone" dataKey="kmsRecorridos" name="Kms Recorridos por Dia" stroke="#2563eb" strokeWidth={4} dot={{ r: 6, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 8, fill: '#1d4ed8' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="lg:col-span-1 flex flex-col gap-4">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Periodo</p>
                    <p className="text-3xl font-black text-slate-800">{estadisticas.kpis?.total.toLocaleString()} <span className="text-base font-medium text-slate-500">km</span></p>
                  </div>
                  
                  <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Promedio Diario</p>
                    <p className="text-3xl font-black text-blue-700">{estadisticas.kpis?.promedio.toLocaleString()} <span className="text-base font-medium text-blue-500">km</span></p>
                  </div>
                  
                  <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100">
                    <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Pico Maximo</p>
                    <p className="text-3xl font-black text-orange-700">{estadisticas.kpis?.maximo.kms.toLocaleString()} <span className="text-base font-medium text-orange-500">km</span></p>
                    <p className="text-sm font-medium text-orange-600 mt-2">Registrado el {estadisticas.kpis?.maximo.fecha}</p>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* CONTENIDO USUARIOS */}
        {pestanaActiva === 'usuarios' && (
          <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100 max-w-md mx-auto">
            <div className="mb-6 border-b border-slate-100 pb-4 text-center">
              <h2 className="text-xl font-bold text-slate-800">Crear Administrador</h2>
              <p className="text-sm text-slate-500 mt-1">Registra nuevos accesos al panel.</p>
            </div>
            <form onSubmit={crearNuevoUsuario} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Correo Electronico</label>
                <input type="email" required value={formUsuario.email} onChange={(e) => setFormUsuario({...formUsuario, email: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="nuevo@empresa.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Contrasena (Minimo 6 caracteres)</label>
                <input type="password" required minLength={6} value={formUsuario.password} onChange={(e) => setFormUsuario({...formUsuario, password: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="••••••••" />
              </div>
              <button type="submit" disabled={creandoUsuario} className={`w-full font-bold py-4 rounded-xl mt-4 transition-all shadow-md ${creandoUsuario ? 'bg-slate-400 text-white' : 'bg-slate-800 text-white hover:bg-slate-900'}`}>
                {creandoUsuario ? 'Creando cuenta...' : 'Registrar Administrador'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}