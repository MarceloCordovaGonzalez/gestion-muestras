import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

/**
 * Acceso web del Administrador: correo + contraseña con MFA obligatorio (CU-09, RNF-04),
 * gestionado por Identity Platform. El segundo factor se configura en el proyecto de Identity
 * Platform; esta capa solo obtiene el ID token para la API.
 */
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);

/** En desarrollo local sin Identity Platform: token de prueba aceptado por la API (AUTH_DEV_BYPASS). */
const TOKEN_DEV =
  import.meta.env.DEV && !import.meta.env.VITE_FIREBASE_API_KEY ? 'dev:ADMINISTRADOR:EMP1' : null;

export async function obtenerToken(): Promise<string> {
  if (TOKEN_DEV) return TOKEN_DEV;
  const u = auth.currentUser;
  if (!u) throw new Error('Sesión no iniciada');
  return u.getIdToken();
}

export const iniciarSesion = (correo: string, clave: string) =>
  signInWithEmailAndPassword(auth, correo, clave);

export const cerrarSesion = () => signOut(auth);

export function observarSesion(cb: (u: User | null | 'dev') => void): () => void {
  if (TOKEN_DEV) {
    cb('dev');
    return () => undefined;
  }
  return onAuthStateChanged(auth, cb);
}
