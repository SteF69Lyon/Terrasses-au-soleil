
import { initializeApp, FirebaseApp, getApp, getApps } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  Auth
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Firestore
} from "firebase/firestore";
import { UserProfile, EstablishmentType, Advertisement } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyBxuoqnwBvr3FnUV8_jY_CKeKHIOBWFiHQ",
  authDomain: "terrassesausoleil.firebaseapp.com",
  projectId: "terrassesausoleil",
  storageBucket: "terrassesausoleil.firebasestorage.app",
  messagingSenderId: "205163900348",
  appId: "1:205163900348:web:f3dd3e85dc64303f834fb9",
  measurementId: "G-8Q3P0EC5LQ"
};

const ADMIN_EMAIL = 'sflandrin@outlook.com';

class DatabaseService {
  private app: FirebaseApp;
  private auth!: Auth;
  private db!: Firestore;

  constructor() {
    try {
      // On initialise l'app Firebase
      if (getApps().length === 0) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApp();
      }
      
      // Initialisation immédiate des services
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      
      console.log("Terrasses au soleil : Services Firebase initialisés.");
    } catch (error) {
      console.error("Échec critique de l'initialisation Firebase :", error);
      // On ne jette pas d'erreur pour ne pas bloquer tout le JS de la page
    }
  }

  private handleAuthError(error: any): string {
    console.error("Erreur Auth :", error.code);
    switch (error.code) {
      case 'auth/configuration-not-found':
        return "L'authentification par email n'est pas activée dans la console Firebase.";
      case 'auth/email-already-in-use':
        return "Cet email est déjà utilisé.";
      case 'auth/invalid-credential':
        return "Identifiants incorrects.";
      case 'auth/weak-password':
        return "Mot de passe trop court.";
      default:
        return "Erreur d'accès au compte.";
    }
  }

  onAuthChange(callback: (user: User | null) => void) {
    if (!this.auth) return () => {};
    return onAuthStateChanged(this.auth, callback);
  }

  async register(name: string, email: string, password: string): Promise<UserProfile> {
    if (!this.auth) throw new Error("Service indisponible.");
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      const newProfile: UserProfile = {
        name,
        email: user.email!,
        isSubscribed: false,
        emailNotifications: false,
        preferredType: EstablishmentType.ALL,
        preferredSunLevel: 20,
        favorites: []
      };

      await setDoc(doc(this.db, "profiles", user.uid), newProfile);
      return newProfile;
    } catch (error: any) {
      throw new Error(this.handleAuthError(error));
    }
  }

  async login(email: string, password: string): Promise<UserProfile> {
    if (!this.auth) throw new Error("Service indisponible.");
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const profileData = await this.fetchProfileByUid(userCredential.user.uid);
      return profileData || {
        name: userCredential.user.displayName || 'Utilisateur',
        email: userCredential.user.email!,
        isSubscribed: false,
        emailNotifications: false,
        preferredType: EstablishmentType.ALL,
        preferredSunLevel: 20,
        favorites: []
      };
    } catch (error: any) {
      throw new Error(this.handleAuthError(error));
    }
  }

  async logout() {
    if (this.auth) await signOut(this.auth);
  }

  async updateProfile(uid: string, profile: UserProfile): Promise<void> {
    if (!this.db) return;
    try {
      const { password, ...safeProfile } = profile as any;
      await setDoc(doc(this.db, "profiles", uid), safeProfile, { merge: true });
    } catch (error) {
      console.error("Erreur Firestore :", error);
    }
  }

  async fetchProfileByUid(uid: string): Promise<UserProfile | null> {
    if (!this.db) return null;
    try {
      const docSnap = await getDoc(doc(this.db, "profiles", uid));
      return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
    } catch {
      return null;
    }
  }

  async setSubscriptionStatus(uid: string, status: boolean): Promise<void> {
    if (this.db) await updateDoc(doc(this.db, "profiles", uid), { isSubscribed: status });
  }

  isAdmin(email?: string | null): boolean {
    return email?.toLowerCase().trim() === ADMIN_EMAIL;
  }

  onAdsChange(callback: (ads: Advertisement[]) => void) {
    if (!this.db) return () => {};
    try {
      const q = query(collection(this.db, "ads"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Advertisement)));
      }, () => callback([]));
    } catch {
      return () => {};
    }
  }

  async addAd(text: string, link?: string): Promise<void> {
    if (this.db) await addDoc(collection(this.db, "ads"), { text, link: link || null, isActive: true, createdAt: Date.now() });
  }

  async deleteAd(id: string): Promise<void> {
    if (this.db) await deleteDoc(doc(this.db, "ads", id));
  }

  async toggleAdStatus(id: string, currentStatus: boolean): Promise<void> {
    if (this.db) await updateDoc(doc(this.db, "ads", id), { isActive: !currentStatus });
  }

  getAuth() { return this.auth; }
}

export const dbService = new DatabaseService();
