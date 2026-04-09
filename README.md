<div align="center">

# 🚛 Ecopanta Fleet — Sistema de Gestión de Flota

![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

**Plataforma web integral para el control, monitoreo y mantenimiento de la flota vehicular de Ecopanta.**

Digitaliza los procesos de revisión diaria, vencimientos documentales, registro de kilometraje y agenda de taller — todo centralizado y en tiempo real.

</div>

---

## ✨ Características Principales

### 👤 App para Conductores — Móvil / Escaneo QR

| Función | Descripción |
|---|---|
| 📋 **Checklist Dinámico** | Preguntas adaptadas automáticamente al tipo de vehículo (Tracto camión, Semirremolque, Camioneta) |
| 🔢 **Registro de Kilometraje** | Ingreso manual o mediante captura fotográfica del tablero |
| 🚫 **Bloqueo Automático** | Si se detecta una falla crítica, el sistema bloquea la salida del vehículo de inmediato |
| 📄 **Billetera de Documentos** | Visualización y descarga en PDF de Revisión Técnica, Permiso de Circulación y Certificados |
| 🔧 **Agenda de Taller** | Reserva de hora directa con visualización de disponibilidad en tiempo real |

### 👑 Panel de Administración — Dashboard Web

| Función | Descripción |
|---|---|
| 🔲 **Generador de QR** | Códigos únicos por patente con diseño corporativo, exportables a PDF |
| 🚦 **Alertas de Vencimiento** | Sistema semáforo visual con días restantes para cada documento |
| 📊 **Control de Kilometraje** | Registro del km actual y cálculo estimado del próximo ingreso a taller |
| 📁 **Historial de Reportes** | Tabla en tiempo real con limpieza automática tras 15 días |
| 📅 **Agenda y Citas** | Gestión de reservas de taller: aprobar, cancelar o reagendar |
| 📈 **Estadísticas (KPIs)** | Gráficos interactivos de variación de kilometraje por vehículo (últimos 15 días) |

---

## 🛠️ Stack Tecnológico

| Categoría | Tecnología |
|---|---|
| **Frontend** | React 18, TypeScript, Vite |
| **Estilos** | Tailwind CSS |
| **Base de datos** | Firebase Firestore |
| **Almacenamiento** | Firebase Storage |
| **Autenticación** | Firebase Auth |
| **QR** | qrcode.react |
| **PDF** | jspdf, html-to-image |
| **Gráficos** | recharts |
| **Ruteo** | react-router-dom |

---

## 🚀 Instalación y Uso Local

### 1. Clonar el repositorio

```bash
git clone [URL_DEL_REPOSITORIO]
cd gestion-flota-web
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Firebase:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

---

## 🔒 Reglas de Seguridad Firebase

Para el correcto funcionamiento de la subida de imágenes y lectura de datos por conductores anónimos (acceso vía QR), configura las reglas de **Firebase Storage** de la siguiente manera:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ **Nota:** Asegúrate también de configurar las reglas de Firestore para permitir escrituras en las colecciones pertinentes según la arquitectura de seguridad requerida.

---

## ⚖️ Derechos de Autor

© 2026 **Ecopanta**. Todos los derechos reservados.

Este software — incluyendo su código fuente, diseño, interfaz de usuario y arquitectura de base de datos — es propiedad exclusiva de Ecopanta. Queda estrictamente prohibida su copia, reproducción, distribución, modificación o uso no autorizado por terceros sin el consentimiento expreso y por escrito de la empresa.

> Desarrollado como herramienta de uso interno para la gestión operativa y logística de la compañía.