# 🚛 Ecopanta Flota — Sistema de Gestión de Flota

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

**Plataforma web integral para el control, monitoreo y mantenimiento de la flota vehicular de Ecopanta.**

Digitaliza los procesos de revisión diaria, vencimientos documentales, registro de kilometraje y agenda de taller — todo centralizado, en tiempo real y accesible desde cualquier dispositivo.

🔗 **Demo en producción:** [gestion-flota-web.vercel.app](https://gestion-flota-web.vercel.app)

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Stack Tecnológico](#️-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Uso Local](#-instalación-y-uso-local)
- [Variables de Entorno](#-variables-de-entorno)
- [Reglas de Seguridad Firebase](#-reglas-de-seguridad-firebase)
- [Scripts Disponibles](#-scripts-disponibles)
- [Derechos de Autor](#️-derechos-de-autor)

---

## ✨ Características Principales

### 👤 App para Conductores — Móvil / Escaneo QR

Interfaz optimizada para uso en terreno, accesible escaneando el código QR de cada vehículo.

| Función | Descripción |
|---|---|
| 📋 **Checklist Dinámico** | Preguntas adaptadas automáticamente al tipo de vehículo (Tracto camión, Semirremolque, Camioneta) |
| 🔢 **Registro de Kilometraje** | Ingreso manual o mediante captura fotográfica del tablero |
| 🚫 **Bloqueo Automático** | Si se detecta una falla crítica, el sistema bloquea la salida del vehículo de inmediato |
| 📄 **Billetera de Documentos** | Visualización y descarga en PDF de Revisión Técnica, Permiso de Circulación y Certificados |
| 🔧 **Agenda de Taller** | Reserva de hora directa con visualización de disponibilidad en tiempo real |
| 🔔 **Notificaciones Toast** | Retroalimentación visual instantánea mediante `sonner` |

### 👑 Panel de Administración — Dashboard Web

Control total de la flota desde un panel centralizado, con datos actualizados en tiempo real.

| Función | Descripción |
|---|---|
| 🔲 **Generador de QR** | Códigos únicos por patente con diseño corporativo, exportables a PDF |
| 🚦 **Alertas de Vencimiento** | Sistema semáforo visual con días restantes para cada documento |
| 📊 **Control de Kilometraje** | Registro del km actual y cálculo estimado del próximo ingreso a taller |
| 📁 **Historial de Reportes** | Tabla en tiempo real con limpieza automática tras 15 días |
| 📅 **Agenda y Citas** | Gestión de reservas de taller: aprobar, cancelar o reagendar |
| 📈 **Estadísticas (KPIs)** | Gráficos interactivos de variación de kilometraje por vehículo (últimos 15 días) |
| 📤 **Exportación PDF** | Reportes y tablas exportables con `jspdf` + `jspdf-autotable` |
| 🖼️ **Captura de pantalla** | Exportación de vistas como imagen con `html-to-image` y `html2canvas` |

---

## 🛠️ Stack Tecnológico

| Categoría | Tecnología | Versión |
|---|---|---|
| **Frontend** | React | 19.x |
| **Lenguaje** | TypeScript | ~5.9 |
| **Build Tool** | Vite | 8.x |
| **Estilos** | Tailwind CSS | 4.x |
| **Base de datos** | Firebase Firestore | 12.x |
| **Almacenamiento** | Firebase Storage | 12.x |
| **Autenticación** | Firebase Auth | 12.x |
| **Ruteo** | react-router-dom | 7.x |
| **Formularios** | react-hook-form | 7.x |
| **QR** | qrcode.react | 4.x |
| **PDF** | jspdf + jspdf-autotable | 4.x / 5.x |
| **Imágenes** | html-to-image + html2canvas | 1.x |
| **Gráficos** | recharts | 3.x |
| **Notificaciones** | sonner | 2.x |
| **Iconos** | lucide-react | 0.577 |
| **Deploy** | Vercel | — |

---

## 📁 Estructura del Proyecto

```
gestion-flota-web/
├── public/                  # Archivos estáticos
├── src/
│   ├── components/          # Componentes reutilizables (UI, formularios, modales)
│   ├── pages/               # Vistas principales (Admin, Conductor, etc.)
│   ├── hooks/               # Custom hooks de React
│   ├── services/            # Lógica de conexión con Firebase
│   ├── types/               # Tipos TypeScript compartidos
│   └── main.tsx             # Punto de entrada de la aplicación
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── vercel.json              # Configuración de deploy en Vercel
```

---

## 🚀 Instalación y Uso Local

### 1. Clonar el repositorio

```bash
git clone https://github.com/SamBetosk8/gestion-flota-web.git
cd gestion-flota-web
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (ver [sección de variables de entorno](#-variables-de-entorno)).

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

---

## 🔐 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Firebase:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

> ⚠️ **Importante:** Nunca subas el archivo `.env` al repositorio. Está incluido en `.gitignore` por defecto.

---

## 🔒 Reglas de Seguridad Firebase

### Firebase Storage

Para permitir la subida de imágenes y la lectura por conductores anónimos (acceso vía QR):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

### Firebase Firestore

> ⚠️ **Nota:** Asegúrate de configurar las reglas de Firestore para permitir escrituras en las colecciones pertinentes según la arquitectura de seguridad requerida. Se recomienda restringir el acceso por colección y rol en entornos productivos.

---

## 📦 Scripts Disponibles

| Script | Comando | Descripción |
|---|---|---|
| Desarrollo | `npm run dev` | Inicia el servidor local con Vite |
| Build | `npm run build` | Compila TypeScript y genera el build de producción |
| Lint | `npm run lint` | Ejecuta ESLint sobre el código fuente |
| Preview | `npm run preview` | Previsualiza el build de producción localmente |

---

## ⚖️ Derechos de Autor

© 2026 **Ecopanta**. Todos los derechos reservados.

Este software — incluyendo su código fuente, diseño, interfaz de usuario y arquitectura de base de datos — es propiedad exclusiva de Ecopanta. Queda estrictamente prohibida su copia, reproducción, distribución, modificación o uso no autorizado por terceros sin el consentimiento expreso y por escrito de la empresa.

> Desarrollado como herramienta de uso interno para la gestión operativa y logística de la compañía.