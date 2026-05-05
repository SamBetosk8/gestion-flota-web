import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp, where, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';

export default function DashboardTaller() {
  const navigate = useNavigate();
  const [citas, setCitas] = useState<any[]>([]);
  const [citaSeleccionada, setCitaSeleccionada] = useState<any | null>(null);
  const [checklist, setChecklist] = useState<any | null>(null);
  const [otExistente, setOtExistente] = useState<any | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [vehiculoData, setVehiculoData] = useState<any>(null);
  const [proxMantenimiento, setProxMantenimiento] = useState<string>('');

  const [formCamioneta, setFormCamioneta] = useState({
    tipoMantenimiento: 'Preventivo',
    cambioAceiteGeneral: false,
    cambioAceiteMotor: false,
    cambioAceiteTransmision: false,
    cambioFiltro: false,
    suspension: false,
    frenos: false,
    embrague: false,
    cajaCambios: false,
    observaciones: '',
    descripcionTrabajo: ''
  });

  const [formPesado, setFormPesado] = useState({
    tipoMtto: 'Preventivo',
    empresaTecnico: '',
    ruc: '',
    horasParada: '',
    tareas: [{ descripcion: '', horas: '', fInicio: '', fFin: '' }],
    repuestos: [{ cant: '', unidad: '', descripcion: '' }],
    observaciones: ''
  });

  const manejarCerrarSesion = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const cargarCitas = async () => {
    try {
      const q = query(collection(db, 'citas_taller'), orderBy('fecha', 'desc'));
      const querySnapshot = await getDocs(q);
      setCitas(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    cargarCitas();
  }, []);

  const seleccionarCita = async (cita: any) => {
    setCitaSeleccionada(cita);
    setChecklist(null);
    setOtExistente(null);
    setVehiculoData(null);
    setProxMantenimiento('');

    try {
      const qVehiculo = query(collection(db, 'vehiculos'), where('patente', '==', cita.patente));
      const snapVehiculo = await getDocs(qVehiculo);
      if (!snapVehiculo.empty) {
        const vDoc = snapVehiculo.docs[0];
        const vData = vDoc.data();
        setVehiculoData({ id: vDoc.id, ...vData });
        
        const kmActual = Number(vData.kilometrajeActual) || 0;
        setProxMantenimiento(String(kmActual + 10000));
      }

      const qOT = query(collection(db, 'ordenes_trabajo'), where('idCita', '==', cita.id));
      const snapOT = await getDocs(qOT);
      if (!snapOT.empty) {
        setOtExistente(snapOT.docs[0].data());
      }

      const qReporte = query(collection(db, 'reportes'), where('vehiculoId', '==', cita.patente), orderBy('fecha', 'desc'), limit(1));
      const snapReporte = await getDocs(qReporte);
      if (!snapReporte.empty) {
        setChecklist(snapReporte.docs[0].data());
      }
    } catch (error) {
      console.error(error);
    }
  };

  const agregarFilaTarea = () => setFormPesado(p => ({ ...p, tareas: [...p.tareas, { descripcion: '', horas: '', fInicio: '', fFin: '' }] }));
  const agregarFilaRepuesto = () => setFormPesado(p => ({ ...p, repuestos: [...p.repuestos, { cant: '', unidad: '', descripcion: '' }] }));

  const guardarOT = async () => {
    if (!citaSeleccionada || !vehiculoData) return;
    const confirmar = window.confirm("¿Confirmar y cerrar la Orden de Trabajo? Una vez guardada no podras modificarla.");
    if (!confirmar) return;

    setGuardando(true);
    const tipo = vehiculoData.tipo === 'Camioneta' ? 'camioneta' : 'pesado';
    const datosOT = tipo === 'camioneta' ? formCamioneta : formPesado;

    try {
      await addDoc(collection(db, 'ordenes_trabajo'), {
        idCita: citaSeleccionada.id,
        patente: citaSeleccionada.patente,
        tipoVehiculo: vehiculoData.tipo,
        datos: datosOT,
        fechaCreacion: serverTimestamp(),
        creadoPor: 'Taller Asociado'
      });

      await updateDoc(doc(db, 'citas_taller', citaSeleccionada.id), {
        estado: 'completada'
      });

      if (proxMantenimiento) {
        await updateDoc(doc(db, 'vehiculos', vehiculoData.id), {
          kilometrajeTaller: proxMantenimiento
        });
      }

      alert("Orden de Trabajo guardada y proximo mantenimiento actualizado.");
      seleccionarCita(citaSeleccionada);
      cargarCitas();
    } catch (error) {
      console.error(error);
      alert("Error al guardar OT");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800">Portal Taller Asociado</h1>
            <p className="text-slate-500">Gestión de Ordenes de Trabajo</p>
          </div>
          <button onClick={manejarCerrarSesion} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-xl hover:bg-slate-300">Salir</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden h-fit">
            <div className="p-4 bg-slate-800 text-white font-bold">Vehículos Asignados</div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {citas.map(cita => (
                <button 
                  key={cita.id} 
                  onClick={() => seleccionarCita(cita)}
                  className={`w-full text-left p-4 hover:bg-blue-50 transition-colors ${citaSeleccionada?.id === cita.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-black text-lg text-slate-800">{cita.patente}</span>
                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${cita.estado === 'pendiente' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {cita.estado}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 block mt-1">Ingreso: {cita.fecha} {cita.hora}</span>
                  <span className="text-xs text-slate-600 font-medium truncate block mt-1">Motivo: {cita.motivo}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {!citaSeleccionada ? (
              <div className="bg-white rounded-3xl shadow-lg p-12 text-center border border-slate-100 text-slate-400 font-medium">
                Selecciona un vehículo de la lista para ver su estado y crear la Orden de Trabajo.
              </div>
            ) : (
              <>
                <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                    <h2 className="text-lg font-black text-slate-800">Checklist Previo (Reporte Conductor)</h2>
                    {vehiculoData && (
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                        KM Actual: {vehiculoData.kilometrajeActual || 'No registrado'}
                      </span>
                    )}
                  </div>
                  {checklist ? (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {Object.entries(checklist.respuestas || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-xs text-slate-600 capitalize truncate w-3/4">{k.replace(/_/g, ' ')}</span>
                          <span className={`text-[10px] font-black px-2 py-1 rounded ${String(v).toLowerCase() === 'no' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {String(v).toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No hay checklist registrado para este ingreso.</p>
                  )}
                </div>

                <div className="bg-white rounded-3xl shadow-lg p-6 border border-slate-100">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-2">
                    <h2 className="text-xl font-black text-slate-800">Orden de Trabajo (OT)</h2>
                    {otExistente && <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full">SOLO LECTURA</span>}
                  </div>

                  {otExistente ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-600 text-sm">
                      La Orden de Trabajo ya fue completada y enviada a administración. No puede ser modificada.
                    </div>
                  ) : !vehiculoData ? (
                    <p className="text-sm text-slate-500">Cargando datos del vehículo...</p>
                  ) : (
                    <>
                      <div className="mb-6 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                        <label className="block text-xs font-black text-indigo-800 uppercase tracking-widest mb-2">Programar Próximo Mantenimiento (KM)</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="number" 
                            value={proxMantenimiento} 
                            onChange={(e) => setProxMantenimiento(e.target.value)} 
                            className="p-3 border border-indigo-200 rounded-xl font-bold text-indigo-900 focus:outline-none w-48"
                          />
                          <span className="text-sm text-indigo-600 font-medium">Calculado automáticamente a +10.000 km</span>
                        </div>
                      </div>

                      {vehiculoData.tipo === 'Camioneta' ? (
                        <div className="space-y-4">
                          <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2"><input type="radio" name="tipoM" checked={formCamioneta.tipoMantenimiento === 'Preventivo'} onChange={() => setFormCamioneta({...formCamioneta, tipoMantenimiento: 'Preventivo'})} /> Preventivo</label>
                            <label className="flex items-center gap-2"><input type="radio" name="tipoM" checked={formCamioneta.tipoMantenimiento === 'Correctivo'} onChange={() => setFormCamioneta({...formCamioneta, tipoMantenimiento: 'Correctivo'})} /> Correctivo</label>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {['cambioAceiteGeneral', 'cambioAceiteMotor', 'cambioAceiteTransmision', 'cambioFiltro', 'suspension', 'frenos', 'embrague', 'cajaCambios'].map((item) => (
                              <label key={item} className="flex items-center gap-2 text-sm text-slate-700 p-2 bg-slate-50 rounded border border-slate-100">
                                <input type="checkbox" checked={(formCamioneta as any)[item]} onChange={(e) => setFormCamioneta({...formCamioneta, [item]: e.target.checked})} />
                                {item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </label>
                            ))}
                          </div>
                          <textarea placeholder="Descripción del trabajo realizado..." value={formCamioneta.descripcionTrabajo} onChange={e => setFormCamioneta({...formCamioneta, descripcionTrabajo: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm mt-4"></textarea>
                          <textarea placeholder="Observaciones adicionales..." value={formCamioneta.observaciones} onChange={e => setFormCamioneta({...formCamioneta, observaciones: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm"></textarea>
                        </div>
                      ) : (
                        <div className="space-y-6">
                           <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="Empresa/Técnico" value={formPesado.empresaTecnico} onChange={e => setFormPesado({...formPesado, empresaTecnico: e.target.value})} className="p-3 border border-slate-200 rounded-xl text-sm" />
                            <input type="number" placeholder="Horas de Parada" value={formPesado.horasParada} onChange={e => setFormPesado({...formPesado, horasParada: e.target.value})} className="p-3 border border-slate-200 rounded-xl text-sm" />
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-2">Descripción de Tareas</h3>
                            {formPesado.tareas.map((tarea, idx) => (
                              <div key={idx} className="flex gap-2 mb-2">
                                <input type="text" placeholder="Tarea" value={tarea.descripcion} onChange={e => { const n = [...formPesado.tareas]; n[idx].descripcion = e.target.value; setFormPesado({...formPesado, tareas: n}); }} className="flex-1 p-2 border rounded text-xs" />
                                <input type="number" placeholder="Horas" value={tarea.horas} onChange={e => { const n = [...formPesado.tareas]; n[idx].horas = e.target.value; setFormPesado({...formPesado, tareas: n}); }} className="w-20 p-2 border rounded text-xs" />
                                <input type="date" value={tarea.fInicio} onChange={e => { const n = [...formPesado.tareas]; n[idx].fInicio = e.target.value; setFormPesado({...formPesado, tareas: n}); }} className="w-32 p-2 border rounded text-xs" />
                                <input type="date" value={tarea.fFin} onChange={e => { const n = [...formPesado.tareas]; n[idx].fFin = e.target.value; setFormPesado({...formPesado, tareas: n}); }} className="w-32 p-2 border rounded text-xs" />
                              </div>
                            ))}
                            <button onClick={agregarFilaTarea} className="text-xs font-bold text-blue-600 hover:underline">+ Agregar Tarea</button>
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-2">Repuestos / Consumibles</h3>
                            {formPesado.repuestos.map((rep, idx) => (
                              <div key={idx} className="flex gap-2 mb-2">
                                <input type="number" placeholder="Cant." value={rep.cant} onChange={e => { const n = [...formPesado.repuestos]; n[idx].cant = e.target.value; setFormPesado({...formPesado, repuestos: n}); }} className="w-20 p-2 border rounded text-xs" />
                                <input type="text" placeholder="Unidad" value={rep.unidad} onChange={e => { const n = [...formPesado.repuestos]; n[idx].unidad = e.target.value; setFormPesado({...formPesado, repuestos: n}); }} className="w-24 p-2 border rounded text-xs" />
                                <input type="text" placeholder="Descripción Repuesto" value={rep.descripcion} onChange={e => { const n = [...formPesado.repuestos]; n[idx].descripcion = e.target.value; setFormPesado({...formPesado, repuestos: n}); }} className="flex-1 p-2 border rounded text-xs" />
                              </div>
                            ))}
                            <button onClick={agregarFilaRepuesto} className="text-xs font-bold text-blue-600 hover:underline">+ Agregar Repuesto</button>
                          </div>
                          <textarea placeholder="Observaciones..." value={formPesado.observaciones} onChange={e => setFormPesado({...formPesado, observaciones: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm"></textarea>
                        </div>
                      )}

                      <button onClick={guardarOT} disabled={guardando} className="mt-6 w-full bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-all">
                        {guardando ? 'Guardando OT...' : 'Generar y Cerrar OT'}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}