# Puesta en marcha — primeros pasos después de subir el código

## 1. Pegar las reglas de seguridad
Firebase Console → tu proyecto → Firestore Database → pestaña "Reglas" →
borra lo que hay y pega el contenido de `firestore.rules` → Publicar.

## 2. Crear tu propio usuario MASTER (a mano, por ahora)
Todavía no existe un panel para crear usuarios — eso lo construimos después.
Por ahora, tu primera cuenta (la tuya, MASTER) se crea manualmente:

**a) Crear la cuenta de acceso (Authentication)**
1. Firebase Console → Authentication → pestaña "Users" → "Add user"
2. Correo: el tuyo (ej. roxy@tweetalig.com)
3. Contraseña: la que quieras usar para entrar
4. Click "Add user" — cuando se cree, copia el **UID** que aparece al lado (una cadena larga de letras/números)

**b) Crear tu perfil con el rol (Firestore)**
1. Firebase Console → Firestore Database → "Start collection"
2. Collection ID: `usuarios`
3. Document ID: pega el **UID** que copiaste en el paso anterior (exacto, sin espacios)
4. Agrega estos campos:
   - `nombre` (string) → tu nombre, ej. "Roxy"
   - `rol` (string) → `master`
   - `correo` (string) → el mismo correo que usaste en Authentication
5. Guardar.

## 3. Probar el login
Entra a tu URL de GitHub Pages (`https://processadigitalstudio.github.io/tweetalig-notas/`),
inicia sesión con ese correo y contraseña. Deberías ver el dashboard con tu
nombre y las opciones del rol MASTER en el menú.

## 4. Siguiente paso
Cuando esto funcione, construimos el panel para que TÚ (desde la app, sin
tocar Firebase Console) puedas crear las cuentas de coordinadores,
secretarias y profesores — así no vuelves a repetir el paso 2 a mano.
