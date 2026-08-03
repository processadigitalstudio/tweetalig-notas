# Puesta en marcha

## 1. Activar el login con Google en Firebase
Firebase Console → tu proyecto → Authentication → pestaña "Sign-in method"
→ activa el proveedor **"Google"** → guarda.

## 2. Pegar las reglas de seguridad
Firebase Console → Firestore Database → pestaña "Reglas" → borra todo →
pega el contenido de `firestore.rules` → Publicar.

## 3. Registrarte a ti misma como MASTER (el único paso manual)
Ya NO se crean cuentas a mano en Authentication — con Google Workspace,
la cuenta se crea sola la primera vez que alguien entra. Lo único que
hay que hacer antes es "pre-registrar" tu correo con el rol:

1. Firebase Console → Firestore Database → "Start collection"
2. Collection ID: `usuarios`
3. Document ID: tu correo completo, en minúsculas (ej. `roxy@tweetalig.edu.co`)
4. Agrega los campos:
   - `nombre` (string) → tu nombre
   - `rol` (string) → `master`
5. Guardar.

## 4. Probar el login
Entra a tu URL de GitHub Pages, click en "Entrar con Google", elige tu
cuenta @tweetalig.edu.co. Deberías caer en el dashboard con el menú
completo de MASTER.

## 5. Registrar las 3 sedes
Desde el dashboard → "Sedes": agrega Cartagena, Sincelejo y Barranquilla,
con el correo de coordinación de cada una (la URL de alertas de Apps
Script se agrega más adelante, cuando la construyamos).

## 6. Registrar profesores y crear clases
Desde "Profesores": registra a cada profesor con su correo @tweetalig.edu.co
— en cuanto entren por primera vez con Google, el sistema ya los reconoce.
Desde "Clases": crea cada clase (nivel + grupo + profesor + día + hora + sede).

## Siguiente paso
Con sedes, profesores y clases ya creados, seguimos con:
- Carga de estudiantes por CSV (matricula automática a la clase)
- Pantallas de Notas y Asistencia para el profesor
- Alertas de 2 inasistencias vía Apps Script
