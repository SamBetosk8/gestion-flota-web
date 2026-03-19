import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { LOGO_BASE64 } from '../constants';

export default function GeneradorQR() {
  const [patente, setPatente] = useState('HBL123');
  const [procesando, setProcesando] = useState(false);
  const urlVehiculo = `${window.location.origin}/v/${patente}`;

  const guardarYDescargar = async () => {
    if (!patente) return;
    setProcesando(true);
    
    try {
      const patenteMayuscula = patente.toUpperCase();
      const q = query(collection(db, 'qrs_guardados'), where('patente', '==', patenteMayuscula));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        await addDoc(collection(db, 'qrs_guardados'), {
          patente: patenteMayuscula,
          url: urlVehiculo,
          fechaRegistro: serverTimestamp()
        });
      }

      const elemento = document.getElementById('tarjeta-pdf-generador');
      if (elemento) {
        const imgData = await toPng(elemento, { 
          quality: 1, 
          pixelRatio: 3,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
        pdf.addImage(imgData, 'PNG', 0, 0, 100, 150);
        
        const nombreArchivo = `QR_${patenteMayuscula}.pdf`;
        const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        const pdfBlob = pdf.output('blob');
        const file = new File([pdfBlob], nombreArchivo, { type: 'application/pdf' });

        if (esCelular && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          pdf.save(nombreArchivo);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Error al procesar.");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
      
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: -999, opacity: 0 }}>
        <div id="tarjeta-pdf-generador" className="bg-white p-8 flex flex-col items-center justify-center" style={{ width: '400px', height: '600px' }}>
          <img src={LOGO_BASE64} alt="Logo" style={{ height: '90px', marginBottom: '30px' }} />
          <h2 className="text-5xl font-black text-slate-800 mb-2 tracking-widest">{patente.toUpperCase()}</h2>
          <p className="text-lg text-slate-500 font-bold uppercase mb-10">Control de Flota</p>
          <div className="bg-white p-4 rounded-3xl border-8 border-slate-800 mb-8 shadow-xl">
            <QRCodeSVG value={urlVehiculo} size={220} level="H" />
          </div>
          <p className="text-slate-500 font-bold text-center">Escanee para iniciar el checklist.</p>
        </div>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-slate-100 z-10">
        <h2 className="text-2xl font-black text-slate-800 mb-2">Generador QR</h2>
        <div className="mb-8 text-left">
          <label className="block text-xs font-black text-slate-400 uppercase mb-2">Patente / ID</label>
          <input type="text" value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-mono text-lg text-center" />
        </div>
        <div className="flex justify-center bg-white p-6 border-4 border-slate-50 rounded-3xl mb-8">
          <QRCodeSVG value={urlVehiculo} size={180} level="H" />
        </div>
        <button onClick={guardarYDescargar} disabled={procesando} className="w-full font-bold py-4 rounded-xl shadow-md bg-blue-600 text-white hover:bg-blue-700 transition-all">
          {procesando ? 'Procesando...' : 'Guardar y Descargar PDF'}
        </button>
        <Link to="/admin" className="block mt-4 text-slate-500 font-bold">Ver Panel Admin</Link>
      </div>
    </div>
  );
}