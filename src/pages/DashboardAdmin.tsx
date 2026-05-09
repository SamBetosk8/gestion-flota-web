import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, where, updateDoc, addDoc, serverTimestamp, setDoc, limit } from 'firebase/firestore';
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
  const [otSeleccionada, setOtSeleccionada] = useState<any | null>(null);
  
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  
  const [formVehiculo, setFormVehiculo] = useState({
    patente: '', tipo: 'Camioneta', vencimientoRevision: '', vencimientoCirculacion: '', vencimientoCertificado: '', kilometrajeActual: '', kilometrajeTaller: '', urlRevision: '', urlCirculacion: '', urlCertificado: ''
  });

  const [pdfRevision, setPdfRevision] = useState<File | null>(null);
  const [pdfCirculacion, setPdfCirculacion] = useState<File | null>(null);
  const [pdfCertificado, setPdfCertificado] = useState<File | null>(null);
  const [qrsGuardados, setQrsGuardados] = useState<any[]>([]);
  const [generandoPdf, setGenerandoPdf] = useState<string | null>(null);
  const [vehiculoEstadistica, setVehiculoEstadistica] = useState<string>('');
  
  const [usuariosRegistrados, setUsuariosRegistrados] = useState<any[]>([]);
  const [editandoUsuarioId, setEditandoUsuarioId] = useState<string | null>(null);
  const [formUsuario, setFormUsuario] = useState({ 
    email: '', password: '', rol: 'admin', nombreTaller: '', direccionTaller: '', ciudadTaller: '', especialidadTaller: 'Mecánica Integrada', limiteQR: 10,
    razonSocial: '', telefono: '', direccion: ''
  });
  const [creandoUsuario, setCreandoUsuario] = useState(false);

  const [historialAcciones, setHistorialAcciones] = useState<any[]>([]);

  const logAccion = async (accion: string, detalles: string) => {
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'historial_acciones'), {
        usuario: user?.email || 'Desconocido',
        accion,
        detalles,
        fecha: serverTimestamp()
      });
    } catch (e) {
      console.error("Error al guardar en el historial", e);
    }
  };

  const cargarHistorial = async () => {
    try {
      const q = query(collection(db, 'historial_acciones'), orderBy('fecha', 'desc'), limit(100));
      const snap = await getDocs(q);
      setHistorialAcciones(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error al cargar historial:", error);
    }
  };

  const manejarCerrarSesion = async () => {
    await logAccion('CIERRE_SESION', 'El administrador cerró su sesión');
    await signOut(auth);
    navigate('/login');
  };

  const cargarUsuarios = async () => {
    try {
      // AQUÍ SE APLICA EL FILTRO PARA SEPARAR BASES DE DATOS
      const q = query(collection(db, 'usuarios'), where('proyecto', '==', 'gestion_flota'));
      const snap = await getDocs(q);
      const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsuariosRegistrados(users);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    }
  };

  const limpiarFormUsuario = () => {
    setFormUsuario({ email: '', password: '', rol: 'admin', nombreTaller: '', direccionTaller: '', ciudadTaller: '', especialidadTaller: 'Mecánica Integrada', limiteQR: 10, razonSocial: '', telefono: '', direccion: '' });
    setEditandoUsuarioId(null);
  };

  const guardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoUsuario(true);

    try {
      const datosUsuario: any = { 
        rol: formUsuario.rol, 
        proyecto: 'gestion_flota',
        razonSocial: formUsuario.razonSocial,
        telefono: formUsuario.telefono,
        direccion: formUsuario.direccion
      };

      if (formUsuario.rol === 'taller') {
        datosUsuario.nombreTaller = formUsuario.nombreTaller;
        datosUsuario.direccionTaller = formUsuario.direccionTaller;
        datosUsuario.ciudadTaller = formUsuario.ciudadTaller;
        datosUsuario.especialidadTaller = formUsuario.especialidadTaller;
      } else if (formUsuario.rol === 'generador_qr') {
        datosUsuario.limiteQR = Number(formUsuario.limiteQR);
      }

      if (editandoUsuarioId) {
        await updateDoc(doc(db, 'usuarios', editandoUsuarioId), datosUsuario);
        await logAccion('EDITAR_USUARIO', `Se actualizó el perfil de: ${formUsuario.email} (Rol: ${formUsuario.rol})`);
        alert("Usuario actualizado correctamente.");
      } else {
        if (formUsuario.password.length < 6) {
          alert("La contraseña debe tener al menos 6 caracteres.");
          setCreandoUsuario(false);
          return;
        }
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formUsuario.email, formUsuario.password);
        
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          email: formUsuario.email,
          ...datosUsuario,
          ...(formUsuario.rol === 'generador_qr' && { qrsCreados: 0 }),
          fechaCreacion: serverTimestamp()
        });

        await deleteApp(secondaryApp);
        await logAccion('CREAR_USUARIO', `Se creó el usuario: ${formUsuario.email} (Rol: ${formUsuario.rol})`);
        alert("Usuario creado exitosamente.");
      }
      limpiarFormUsuario();
      cargarUsuarios();
    } catch (error: any) {
      console.error(error);
      alert(`Error al guardar el usuario.`);
    } finally {
      setCreandoUsuario(false);
    }
  };

  const editarUsuario = (user: any) => {
    const rolActual = user.rol === 'taller' ? 'taller' : user.rol === 'generador_qr' ? 'generador_qr' : 'admin';
    setFormUsuario({
      email: user.email,
      password: '',
      rol: rolActual,
      nombreTaller: user.nombreTaller || '',
      direccionTaller: user.direccionTaller || user.ubicacionTaller || '',
      ciudadTaller: user.ciudadTaller || '',
      especialidadTaller: user.especialidadTaller || 'Mecánica Integrada',
      limiteQR: user.limiteQR || 10,
      razonSocial: user.razonSocial || user.nombreTaller || '',
      telefono: user.telefono || '',
      direccion: user.direccion || user.direccionTaller || user.ubicacionTaller || ''
    });
    setEditandoUsuarioId(user.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarUsuario = async (id: string, email: string) => {
    const confirmar = window.confirm("¿Eliminar el perfil de este usuario de la base de datos?");
    if (!confirmar) return;
    try {
      await deleteDoc(doc(db, 'usuarios', id));
      await logAccion('ELIMINAR_USUARIO', `Se eliminó el usuario con correo: ${email}`);
      cargarUsuarios();
    } catch (error) {
      console.error(error);
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

  const actualizarEstadoCita = async (idCita: string, nuevoEstado: string, patente: string) => {
    try {
      await updateDoc(doc(db, 'citas_taller', idCita), { estado: nuevoEstado });
      await logAccion('ACTUALIZAR_CITA', `Se cambió a '${nuevoEstado}' la cita del vehículo: ${patente}`);
      cargarCitas();
    } catch (error) {
      console.error("Error actualizando cita:", error);
    }
  };

  const eliminarCita = async (idCita: string, patente: string) => {
    const confirmar = window.confirm("¿Seguro que deseas eliminar esta cita permanentemente?");
    if (!confirmar) return;
    try {
      await deleteDoc(doc(db, 'citas_taller', idCita));
      await logAccion('ELIMINAR_CITA', `Se eliminó la cita médica del vehículo: ${patente}`);
      cargarCitas();
    } catch (error) {
      console.error("Error borrando cita:", error);
    }
  };

  const verOrdenTrabajo = async (idCita: string) => {
    try {
      const q = query(collection(db, 'ordenes_trabajo'), where('idCita', '==', idCita));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setOtSeleccionada(snap.docs[0].data());
      } else {
        alert("No se encontró ninguna Orden de Trabajo asociada a esta cita.");
      }
    } catch (error) {
      console.error(error);
      alert("Error al obtener la Orden de Trabajo.");
    }
  };

  useEffect(() => {
    setLimiteReportes(10);
    setLimiteVehiculos(10);
    setLimiteQRs(12);
  }, [pestanaActiva, busqueda, filtroEstado, filtroTipoVehiculo]);

  useEffect(() => {
    if (pestanaActiva === 'auditoria') {
      cargarHistorial();
    }
  }, [pestanaActiva]);

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

  useEffect(() => {
    if (pestanaActiva === 'usuarios') cargarUsuarios();
  }, [pestanaActiva]);

  const eliminarReporteIndividual = async (id: string, fotoPath: string | null, patente: string) => {
    const confirmar = window.confirm("Estas seguro de que deseas eliminar este registro de forma permanente?");
    if (!confirmar) return;

    try {
      if (fotoPath) {
        const fotoRef = ref(storage, fotoPath);
        await deleteObject(fotoRef).catch(e => console.log("Error o foto ya borrada:", e));
      }
      await deleteDoc(doc(db, 'reportes', id));
      await logAccion('ELIMINAR_REPORTE', `Se eliminó el reporte diario del vehículo: ${patente}`);
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
      await logAccion('ELIMINAR_TODOS_REPORTES', `Se vació completamente la base de datos de reportes`);
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
        await logAccion('ACTUALIZAR_VEHICULO', `Se actualizaron los datos/documentos del vehículo: ${patenteMayuscula}`);
        alert("Datos y documentos actualizados correctamente.");
      } else {
        await addDoc(collection(db, 'vehiculos'), {
          ...datosVehiculo,
          patente: patenteMayuscula,
          fechaRegistro: serverTimestamp()
        });
        await logAccion('REGISTRAR_VEHICULO', `Se ingresó un nuevo vehículo al sistema: ${patenteMayuscula}`);
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

  const eliminarVehiculo = async (id: string, patente: string) => {
    const confirmar = window.confirm("Estas seguro de que deseas eliminar este vehiculo del sistema?");
    if (confirmar) {
      try {
        await deleteDoc(doc(db, 'vehiculos', id));
        await logAccion('ELIMINAR_VEHICULO', `Se borró el vehículo de la base de datos: ${patente}`);
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

  // AGRUPAMOS ESTRICTAMENTE LOS ELEMENTOS PAGINADOS PARA QUE VERCEL NO FALLE
  const qrsAgrupadosPorUsuario = qrsPaginados.reduce((acc: any, qr: any) => {
    const grupo = qr.creadoPorNombre || 'Administrador General';
    if (!acc[grupo]) {
      acc[grupo] = { detalles: qr.creadoPorDetalles || 'Generado desde el Panel Admin', qrs: [] };
    }
    acc[grupo].qrs.push(qr);
    return acc;
  }, {});

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
          <button onClick={() => setPestanaActiva('auditoria')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${pestanaActiva === 'auditoria' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>Auditoria</button>
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
                          <button onClick={() => eliminarReporteIndividual(rep.id, rep.fotoPath, rep.vehiculoId)} className="text-xs font-bold px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-100">Eliminar</button>
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
                            <button onClick={() => eliminarVehiculo(vehiculo.id, vehiculo.patente)} className="text-xs font-bold px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">Eliminar</button>
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

        {/* CONTENIDO QRS (AGRUPADOS POR USUARIO) */}
        {pestanaActiva === 'qrs' && (
          <div className="space-y-12">
            {Object.keys(qrsAgrupadosPorUsuario).length === 0 ? (
              <div className="bg-white p-12 rounded-3xl shadow-lg text-center border border-slate-100">
                <p className="text-slate-500 text-lg">No se encontraron codigos QR guardados.</p>
              </div>
            ) : (
              Object.entries(qrsAgrupadosPorUsuario).map(([grupo, dataGrupo]: any) => (
                <div key={grupo} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="border-b border-slate-100 pb-4 mb-6">
                    <h2 className="text-xl font-black text-slate-800">{grupo}</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">{dataGrupo.detalles}</p>
                    <div className="inline-block bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-lg mt-2">
                      Total Creados: {dataGrupo.qrs.length}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dataGrupo.qrs.map((qr: any) => {
                      const urlCorregida = qr.url?.replace(/http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g, 'https://gestion-flota-web.vercel.app') || '';
                      return (
                        <div key={qr.id} className="flex flex-col gap-2 relative bg-slate-50 p-4 rounded-2xl border border-slate-200">
                          <div className="flex flex-col items-center">
                            <h3 className="text-2xl font-black text-slate-800 tracking-widest">{qr.patente}</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">{qr.tipo || 'Control de Flota'}</p>
                            <div className="bg-white p-2 rounded-xl border-2 border-slate-200 mb-4 shadow-sm">
                              <QRCodeSVG value={urlCorregida} size={100} level="H" includeMargin={false} />
                            </div>
                          </div>

                          <div style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -50 }}>
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
                            <button onClick={() => descargarPDF(qr.patente)} disabled={generandoPdf === qr.patente} className="flex-1 bg-slate-800 text-white font-bold py-2 rounded-xl hover:bg-slate-900 transition-colors shadow-sm text-xs">
                              {generandoPdf === qr.patente ? '...' : 'Descargar'}
                            </button>
                            <a href={urlCorregida} target="_blank" rel="noreferrer" className="flex-1 text-center bg-blue-50 text-blue-600 font-bold py-2 rounded-xl hover:bg-blue-100 transition-colors text-xs flex items-center justify-center">Probar</a>
                          </div>
                          
                          <button onClick={() => eliminarQR(qr.id)} className="w-full bg-red-50 text-red-600 font-bold py-2 rounded-xl hover:bg-red-100 transition-colors relative z-10 text-xs">Eliminar QR</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
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
              <h2 className="text-xl font-bold text-slate-800">Citas Agendadas y OTs</h2>
              <p className="text-sm text-slate-500 mt-1">Administra las horas reservadas y revisa las Órdenes de Trabajo.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-slate-600 text-sm uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4 font-bold">Fecha / Hora</th>
                    <th className="p-4 font-bold">Vehiculo</th>
                    <th className="p-4 font-bold">Taller Destino</th>
                    <th className="p-4 font-bold text-center">Estado</th>
                    <th className="p-4 font-bold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {citas.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay citas agendadas.</td></tr>
                  ) : (
                    citas.map((cita) => (
                      <tr key={cita.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <span className="font-bold text-slate-800 block">{cita.fecha}</span>
                          <span className="text-sm font-medium text-slate-500">{cita.hora}</span>
                        </td>
                        <td className="p-4 font-black text-blue-600 text-lg">{cita.patente}</td>
                        <td className="p-4">
                          <div className="text-sm font-bold text-slate-700">{cita.nombreTallerDestino || cita.tipoTaller || 'Taller Externo'}</div>
                          {cita.direccionCompletaTaller && (
                            <a 
                              href={`https://www.google.com/maps/search/taller+${encodeURIComponent(cita.direccionCompletaTaller)}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[10px] text-blue-500 font-bold hover:text-blue-700 hover:underline flex items-center gap-1 mt-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                              Ubicar en Mapa
                            </a>
                          )}
                        </td>
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
                            {cita.estado === 'completada' && (
                              <button onClick={() => verOrdenTrabajo(cita.id)} className="text-xs font-bold px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 border border-indigo-200">Ver OT</button>
                            )}
                            {cita.estado === 'pendiente' && (
                              <>
                                <button onClick={() => actualizarEstadoCita(cita.id, 'completada', cita.patente)} className="text-xs font-bold px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 border border-green-200">Completar</button>
                                <button onClick={() => actualizarEstadoCita(cita.id, 'cancelada', cita.patente)} className="text-xs font-bold px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 border border-slate-200">Cancelar</button>
                              </>
                            )}
                            <button onClick={() => eliminarCita(cita.id, cita.patente)} className="text-xs font-bold px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200">Eliminar</button>
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

        {/* VENTANA MODAL PARA VER ORDEN DE TRABAJO COMO ADMIN */}
        {otSeleccionada && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-2xl font-black text-slate-800">Orden de Trabajo Guardada</h3>
                <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full">SOLO LECTURA</span>
              </div>
              <p className="text-sm text-slate-500 mb-6">Vehiculo: <span className="font-black text-blue-600 text-lg">{otSeleccionada.patente}</span></p>

              {otSeleccionada.tipoVehiculo === 'Camioneta' ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-sm font-bold text-slate-700">Tipo: <span className="font-normal">{otSeleccionada.datos.tipoMantenimiento}</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['cambioAceiteGeneral', 'cambioAceiteMotor', 'cambioAceiteTransmision', 'cambioFiltro', 'suspension', 'frenos', 'embrague', 'cajaCambios'].map((item) => {
                      if (!otSeleccionada.datos[item]) return null;
                      return (
                        <div key={item} className="text-xs bg-blue-50 text-blue-700 font-bold p-2 rounded-lg border border-blue-100 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          {item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Descripción</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{otSeleccionada.datos.descripcionTrabajo || 'Sin descripción'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Observaciones</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{otSeleccionada.datos.observaciones || 'Sin observaciones'}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-sm font-bold text-slate-700">Taller/Técnico: <span className="font-normal">{otSeleccionada.datos.empresaTecnico}</span></p>
                    <p className="text-sm font-bold text-slate-700">Horas Parada: <span className="font-normal">{otSeleccionada.datos.horasParada}</span></p>
                  </div>
                  
                  {otSeleccionada.datos.tareas && otSeleccionada.datos.tareas.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Tareas Realizadas</h4>
                      <table className="w-full text-left border-collapse text-xs border border-slate-200">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr><th className="p-2 border border-slate-200">Descripción</th><th className="p-2 border border-slate-200 text-center">Horas</th><th className="p-2 border border-slate-200 text-center">Inicio</th><th className="p-2 border border-slate-200 text-center">Fin</th></tr>
                        </thead>
                        <tbody>
                          {otSeleccionada.datos.tareas.map((t: any, i: number) => (
                            <tr key={i}><td className="p-2 border border-slate-200">{t.descripcion}</td><td className="p-2 border border-slate-200 text-center">{t.horas}</td><td className="p-2 border border-slate-200 text-center">{t.fInicio}</td><td className="p-2 border border-slate-200 text-center">{t.fFin}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {otSeleccionada.datos.repuestos && otSeleccionada.datos.repuestos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Repuestos</h4>
                      <table className="w-full text-left border-collapse text-xs border border-slate-200">
                        <thead className="bg-slate-100 text-slate-600">
                          <tr><th className="p-2 border border-slate-200 text-center">Cant.</th><th className="p-2 border border-slate-200 text-center">Unidad</th><th className="p-2 border border-slate-200">Descripción</th></tr>
                        </thead>
                        <tbody>
                          {otSeleccionada.datos.repuestos.map((r: any, i: number) => (
                            <tr key={i}><td className="p-2 border border-slate-200 text-center">{r.cant}</td><td className="p-2 border border-slate-200 text-center">{r.unidad}</td><td className="p-2 border border-slate-200">{r.descripcion}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Observaciones</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{otSeleccionada.datos.observaciones || 'Sin observaciones'}</p>
                  </div>
                </div>
              )}

              <button onClick={() => setOtSeleccionada(null)} className="mt-8 w-full bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-colors shadow-lg">Cerrar</button>
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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100 xl:col-span-1 h-fit">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800">{editandoUsuarioId ? 'Editar Perfil' : 'Crear Usuario'}</h2>
                <p className="text-sm text-slate-500 mt-1">Gestiona los accesos al sistema.</p>
              </div>
              <form onSubmit={guardarUsuario} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Correo Electronico</label>
                  <input type="email" required disabled={!!editandoUsuarioId} value={formUsuario.email} onChange={(e) => setFormUsuario({...formUsuario, email: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500" placeholder="usuario@empresa.com" />
                </div>
                {!editandoUsuarioId && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Contrasena (Minimo 6 caracteres)</label>
                    <input type="password" required minLength={6} value={formUsuario.password} onChange={(e) => setFormUsuario({...formUsuario, password: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="••••••••" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Rol</label>
                  <select value={formUsuario.rol} onChange={(e) => setFormUsuario({...formUsuario, rol: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="admin">Administrador General</option>
                    <option value="taller">Taller Externo Asociado</option>
                    <option value="generador_qr">Generador de QRs (Restringido)</option>
                  </select>
                </div>
                
                {formUsuario.rol === 'taller' && (
                  <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">Nombre del Taller</label>
                      <input type="text" required value={formUsuario.nombreTaller} onChange={(e) => setFormUsuario({...formUsuario, nombreTaller: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ej: LubriLoa" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">Especialidad</label>
                      <input type="text" required value={formUsuario.especialidadTaller} onChange={(e) => setFormUsuario({...formUsuario, especialidadTaller: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ej: Mecánica Integrada, Pintura" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">Dirección Exacta</label>
                      <input type="text" required value={formUsuario.direccionTaller} onChange={(e) => setFormUsuario({...formUsuario, direccionTaller: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ej: Vicuña Mackenna 2945" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">Ciudad</label>
                      <input type="text" required value={formUsuario.ciudadTaller} onChange={(e) => setFormUsuario({...formUsuario, ciudadTaller: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Ej: Calama" />
                    </div>
                  </div>
                )}

                {formUsuario.rol === 'generador_qr' && (
                  <div className="space-y-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">Razón Social / Empresa</label>
                      <input type="text" required value={formUsuario.razonSocial} onChange={(e) => setFormUsuario({...formUsuario, razonSocial: e.target.value})} className="w-full p-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white" placeholder="Ej: Transportes XYZ" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">Teléfono de Contacto</label>
                      <input type="text" required value={formUsuario.telefono} onChange={(e) => setFormUsuario({...formUsuario, telefono: e.target.value})} className="w-full p-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white" placeholder="Ej: +569 1234 5678" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">Dirección / Sede</label>
                      <input type="text" required value={formUsuario.direccion} onChange={(e) => setFormUsuario({...formUsuario, direccion: e.target.value})} className="w-full p-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white" placeholder="Ej: Parque Industrial, Sitio 4" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">Plan contratado (Límite de QRs)</label>
                      <select value={formUsuario.limiteQR} onChange={(e) => setFormUsuario({...formUsuario, limiteQR: Number(e.target.value)})} className="w-full p-3 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white">
                        <option value={1}>Plan Básico (1 QR máximo)</option>
                        <option value={10}>Plan Intermedio (10 QRs máximo)</option>
                        <option value={20}>Plan Avanzado (20 QRs máximo)</option>
                        <option value={50}>Plan Corporativo (50 QRs máximo)</option>
                      </select>
                      {editandoUsuarioId && (
                        <p className="text-xs text-purple-600 mt-2 italic">* Al actualizar el plan no se reiniciará la cantidad de QRs ya creados por el usuario.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button type="submit" disabled={creandoUsuario} className={`flex-1 font-bold py-3 rounded-xl transition-all shadow-md ${creandoUsuario ? 'bg-slate-400 text-white' : 'bg-slate-800 text-white hover:bg-slate-900'}`}>
                    {creandoUsuario ? 'Guardando...' : (editandoUsuarioId ? 'Guardar Cambios' : 'Crear Usuario')}
                  </button>
                  {editandoUsuarioId && (
                    <button type="button" onClick={limpiarFormUsuario} className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">Cancelar</button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100 xl:col-span-2">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl font-bold text-slate-800">Cuentas Registradas</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4 font-bold">Correo (Auth)</th>
                      <th className="p-4 font-bold">Detalle Perfil</th>
                      <th className="p-4 font-bold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usuariosRegistrados.length === 0 ? (<tr><td colSpan={3} className="p-8 text-center text-slate-400">Cargando usuarios...</td></tr>) 
                    : usuariosRegistrados.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <span className="font-bold text-slate-800">{user.email}</span>
                          <span className={`text-[10px] block mt-1 uppercase font-bold px-2 py-0.5 rounded inline-block ${
                            user.rol === 'admin' ? 'bg-indigo-100 text-indigo-700' : 
                            user.rol === 'taller' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {user.rol}
                          </span>
                        </td>
                        <td className="p-4">
                          {user.rol === 'taller' ? (
                            <div className="text-sm">
                              <p className="font-black text-blue-700">{user.nombreTaller || 'Sin nombre'}</p>
                              <p className="text-slate-500 font-medium text-xs">{user.especialidadTaller}</p>
                              <p className="text-slate-500 text-xs">{user.ciudadTaller ? `${user.direccionTaller}, ${user.ciudadTaller}` : user.ubicacionTaller}</p>
                            </div>
                          ) : user.rol === 'generador_qr' ? (
                            <div className="text-sm">
                              <p className="font-black text-purple-700">{user.razonSocial || 'Empresa No Definida'}</p>
                              <p className="text-slate-500 font-medium text-xs">Plan: {user.limiteQR} QRs | Dir: {user.direccion || 'N/A'}</p>
                              <p className="text-slate-500 font-medium text-xs">Tel: {user.telefono || 'N/A'}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Acceso Total</span>
                          )}
                        </td>
                        <td className="p-4 flex gap-2 justify-center mt-2">
                          <button onClick={() => editarUsuario(user)} className="text-xs font-bold px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">Editar</button>
                          <button onClick={() => eliminarUsuario(user.id, user.email)} className="text-xs font-bold px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">Borrar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO AUDITORIA (HISTORIAL INBORRABLE) */}
        {pestanaActiva === 'auditoria' && (
          <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-slate-100">
            <div className="p-6 bg-slate-50 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Historial de Auditoría</h2>
              <p className="text-sm text-slate-500 mt-1">Registro inmutable de todas las acciones importantes realizadas en la plataforma.</p>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider sticky top-0 shadow-sm">
                    <th className="p-4 font-bold">Fecha / Hora</th>
                    <th className="p-4 font-bold">Usuario</th>
                    <th className="p-4 font-bold">Acción</th>
                    <th className="p-4 font-bold">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historialAcciones.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">No hay registros de auditoría.</td></tr>
                  ) : (
                    historialAcciones.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                          {log.fecha ? log.fecha.toDate().toLocaleString() : 'Reciente'}
                        </td>
                        <td className="p-4 font-bold text-slate-700 text-sm">{log.usuario}</td>
                        <td className="p-4">
                          <span className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase px-2 py-1 rounded">
                            {log.accion.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-600">{log.detalles}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}