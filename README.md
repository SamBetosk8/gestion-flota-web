# 🚚 Sistema de Gestión de Flota - Ecopanta

Aplicación web integral diseñada para el control, monitoreo y mantenimiento de la flota de vehículos de la empresa **Ecopanta**. 

Este sistema permite digitalizar los procesos de revisión diaria (Checklists), mantener un control estricto sobre el vencimiento de la documentación legal de cada máquina, registrar el kilometraje y administrar las horas de taller, todo de manera centralizada y en tiempo real.

---

## ✨ Características Principales

### 👤 Módulo para Conductores (App Móvil / Escaneo QR)
* **Checklist Diario Dinámico:** Preguntas de inspección visual adaptadas automáticamente al tipo de vehículo (Tracto camión, Semirremolque, Camioneta).
* **Registro de Kilometraje:** Ingreso manual del kilometraje o mediante captura fotográfica del tablero.
* **Aprobación/Bloqueo Automático:** Si el conductor marca una falla crítica, el sistema bloquea la salida del vehículo inmediatamente.
* **Billetera Digital de Documentos:** Tras completar la inspección, el conductor puede visualizar y descargar (en PDF) la Revisión Técnica, Permiso de Circulación y Certificados directamente a su celular.
* **Agenda de Taller:** Opción directa para reservar hora en el taller mecánico visualizando las horas disponibles en tiempo real.

### 👑 Panel de Administración (Dashboard)
* **Generador de Códigos QR:** Creación de identificadores únicos por patente con diseño corporativo exportables a PDF.
* **Gestión de Flota:** Panel para registrar vehículos, subir sus documentos en PDF (con reemplazo automático) y visualizar días restantes para vencimientos mediante alertas visuales (semáforo).
* **Control de Kilometraje:** Registro del kilometraje actual y cálculo del kilometraje estimado para el próximo ingreso a taller.
* **Historial de Reportes:** Tabla en tiempo real con los resultados de los checklists diarios y botón para limpiar o eliminar reportes antiguos (eliminación automática después de 15 días).
* **Agenda y Citas:** Módulo de administración para ver, aprobar o cancelar las reservas de taller hechas por los choferes.
* **Estadísticas (KPIs):** Gráficos interactivos de la variación de kilometraje de los últimos 15 días por vehículo, mostrando promedios y picos máximos.

---

## 🛠️ Tecnologías Utilizadas

* **Frontend:** React 18, TypeScript, Vite.
* **Estilos:** Tailwind CSS.
* **Base de Datos y Almacenamiento:** Firebase (Firestore Database, Firebase Storage).
* **Autenticación:** Firebase Auth.
* **Librerías Adicionales:** * `qrcode.react` (Generación de QRs).
    * `jspdf` & `html-to-image` (Captura y exportación a PDF).
    * `recharts` (Visualización de datos y estadísticas).
    * `react-router-dom` (Navegación y ruteo seguro).

---

## 🚀 Instalación y Despliegue Local

1. **Clonar el repositorio:**
   ```bash
   git clone [URL_DEL_REPOSITORIO]
   cd gestion-flota-web

Instalar dependencias:

Bash
npm install
Configuración de Variables de Entorno:
Crea un archivo .env en la raíz del proyecto y añade tus credenciales de Firebase:

Fragmento de código
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
Ejecutar en entorno de desarrollo:

Bash
npm run dev
🔒 Reglas de Seguridad (Firebase)
Para el correcto funcionamiento de la subida de imágenes y lectura de datos por parte de usuarios anónimos (conductores escaneando el QR), es indispensable configurar las reglas de Firebase Storage de la siguiente manera:

JavaScript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
(Nota: Asegurar las reglas de Firestore para permitir escrituras en las colecciones pertinentes según la arquitectura de seguridad requerida).

⚖️ Derechos de Autor y Propiedad Intelectual
© 2026 Ecopanta. Todos los derechos reservados.

Este software, incluyendo su código fuente, diseño, interfaz de usuario y arquitectura de base de datos, es propiedad exclusiva de Ecopanta. Queda estrictamente prohibida la copia, reproducción, distribución, modificación, comercialización o uso no autorizado de este sistema o cualquiera de sus partes por terceros sin el consentimiento expreso y por escrito de la empresa.

Desarrollado específicamente como herramienta de uso interno para la gestión operativa y logística de la compañía.