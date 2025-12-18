
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
  private auth: Auth;
  private db: Firestore;

  constructor() {
    try {
      // Vérification de la clé API Gemini pour diagnostic console
      if (!process.env.API_KEY) {
        console.warn("ATTENTION: La clé process.env.API_KEY est manquante. Les recherches Gemini ne fonctionneront pas.");
      }

      // Initialisation atomique de Firebase
      if (getApps().length === 0) {
        this.app = initializeApp(firebaseConfig);
      } else {
        this.app = getApp();
      }
      
      // On initialise les références immédiatement pour éviter le "Component not registered"
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      
      console.log("SoleilTerrasse Database Engine: Online");
    } catch (error) {
      console.error("Firebase Initialization Critical Error:", error);
      throw error;
    }
  }

  private handleAuthError(error: any): string {
    console.error("Auth Exception:", error.code, error.message);
    switch (error.code) {
      case 'auth/configuration-not-found':
        return "ERREUR CONFIGURATION : L'authentification par e-mail n'est pas activée dans votre console Firebase (Authentication > Sign-in method).";
      case 'auth/email-already-in-use':
        return "Cette adresse e-mail est déjà rattachée à un compte.";
      case 'auth/invalid-email':
        return "Format d'e-mail invalide.";
      case 'auth/weak-password':
        return "Mot de passe trop faible (6 caractères minimum).";
      case 'auth/invalid-credential':
        return "Identifiants incorrects.";
      case 'auth/operation-not-allowed':
        return "Cette méthode de connexion est désactivée dans Firebase.";
      default:
        return "Erreur d'accès au service d'authentification.";
    }
  }

  onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(this.auth, callback);
  }

  async register(name: string, email: string, password: string): Promise<UserProfile> {
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
      localStorage.setItem('profile', JSON.stringify(newProfile));
      return newProfile;
    } catch (error: any) {
      throw new Error(this.handleAuthError(error));
    }
  }

  async login(email: string, password: string): Promise<UserProfile> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const profileData = await this.fetchProfileByUid(userCredential.user.uid);
      
      if (!profileData) {
        // Fallback si le doc Firestore n'existe pas encore
        return {
            name: userCredential.user.displayName || 'Utilisateur',
            email: userCredential.user.email!,
            isSubscribed: false,
            emailNotifications: false,
            preferredType: EstablishmentType.ALL,
            preferredSunLevel: 20,
            favorites: []
        };
      }
      
      localStorage.setItem('profile', JSON.stringify(profileData));
      return profileData;
    } catch (error: any) {
      throw new Error(this.handleAuthError(error));
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      localStorage.removeItem('profile');
    } catch (e) {
      console.error("Logout error:", e);
    }
  }

  async updateProfile(uid: string, profile: UserProfile): Promise<void> {
    try {
      const profileRef = doc(this.db, "profiles", uid);
      const { password, ...safeProfile } = profile as any;
      await setDoc(profileRef, safeProfile, { merge: true });
      localStorage.setItem('profile', JSON.stringify(safeProfile));
    } catch (error: any) {
      console.error("Firestore Update Error:", error.message);
      throw error;
    }
  }

  async fetchProfileByUid(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(this.db, "profiles", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error: any) {
      console.error("Firestore Fetch Error:", error);
      return null;
    }
  }

  async setSubscriptionStatus(uid: string, status: boolean): Promise<void> {
    try {
      const profileRef = doc(this.db, "profiles", uid);
      await updateDoc(profileRef, { isSubscribed: status });
    } catch (error) {
      console.error("Sub Update Error:", error);
    }
  }

  isAdmin(email?: string | null): boolean {
    return email?.toLowerCase().trim() === ADMIN_EMAIL;
  }

  onAdsChange(callback: (ads: Advertisement[]) => void) {
    try {
      const q = query(collection(this.db, "ads"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Advertisement));
        callback(ads);
      }, (error) => {
        console.warn("Ads listener skipped (likely permissions or empty):", error.message);
        callback([]);
      });
    } catch (e) {
      return () => {};
    }
  }

  async addAd(text: string, link?: string): Promise<void> {
    await addDoc(collection(this.db, "ads"), {
      text,
      link: link || null,
      isActive: true,
      createdAt: Date.now()
    });
  }

  async deleteAd(id: string): Promise<void> {
    await deleteDoc(doc(this.db, "ads", id));
  }

  async toggleAdStatus(id: string, currentStatus: boolean): Promise<void> {
    await updateDoc(doc(this.db, "ads", id), { isActive: !currentStatus });
  }

  getAuth() { return this.auth; }
}

export const dbService = new DatabaseService();
