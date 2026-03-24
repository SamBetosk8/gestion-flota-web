import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { LOGO_BASE64 } from '../constants';

export default function GeneradorQR() {
  const [patente, setPatente] = useState('HBL123');
  const [tipoVehiculo, setTipoVehiculo] = useState('Camioneta'); // Estado para el tipo
  const [procesando, setProcesando] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>(''); 
  const urlVehiculo = `${window.location.origin}/v/${patente}`;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL('image/png'));
      }
    };
    img.src = '/logo.jpg';
  }, []);

  const guardarYDescargar = async () => {
    if (!patente) return;
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
          try {
            await navigator.share({ files: [file] });
          } catch (e) {
            pdf.save(nombreArchivo);
          }
        } else {
          pdf.save(nombreArchivo);
        }
      }

    } catch (error) {
      console.error(error);
      alert("Error al generar el PDF. Verifica la consola.");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
      
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div id="tarjeta-pdf-generador" className="bg-white p-8 flex flex-col items-center justify-center" style={{ width: '400px', height: '600px' }}>
          <img src={LOGO_BASE64} alt="Logo" style={{ height: '90px', marginBottom: '30px' }} />
          <h2 className="text-5xl font-black text-slate-800 mb-2 tracking-widest">{patente.toUpperCase()}</h2>
          <p className="text-lg text-slate-500 font-bold uppercase mb-10">{tipoVehiculo}</p>
          <div className="bg-white p-4 rounded-3xl border-8 border-slate-800 mb-8 shadow-xl">
            <QRCodeSVG value={urlVehiculo} size={220} level="H" />
          </div>
          <p className="text-slate-500 font-bold text-center">Escanee para iniciar el checklist.</p>
        </div>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-slate-100 z-10">
        <h2 className="text-2xl font-black text-slate-800 mb-2">Generador QR</h2>
        <p className="text-slate-500 mb-8 text-sm">Identificadores de Vehiculos</p>
        
        <div className="mb-6 text-left">
          <label className="block text-xs font-black text-slate-400 uppercase mb-2 ml-1">Patente / ID</label>
          <input type="text" value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-mono text-lg text-center focus:border-blue-500 focus:outline-none transition-all" placeholder="EJ: ABCD12" />
        </div>

        <div className="flex justify-center bg-white p-6 border-4 border-slate-50 rounded-3xl mb-6">
          <QRCodeSVG value={urlVehiculo} size={150} level="H" />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-black text-slate-400 uppercase mb-3 text-left ml-1">Tipo de Vehiculo</label>
          <div className="flex gap-2">
            {['Camion', 'Tractor', 'Camioneta'].map((tipo) => (
              <button 
                key={tipo}
                onClick={() => setTipoVehiculo(tipo)}
                className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border ${tipoVehiculo === tipo ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={guardarYDescargar} 
            disabled={procesando || !logoBase64} 
            className={`w-full font-bold py-4 rounded-xl transition-all shadow-md ${(procesando || !logoBase64) ? 'bg-slate-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {procesando ? 'Procesando...' : 'Guardar y Descargar PDF'}
          </button>
          
          <Link to="/admin" className="block mt-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">
            Volver al Panel Admin
          </Link>
        </div>
      </div>
    </div>
  );
}