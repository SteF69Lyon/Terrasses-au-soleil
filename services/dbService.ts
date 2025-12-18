
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
      this.app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      console.log("Firebase ready.");
    } catch (error) {
      console.error("Firebase init failed:", error);
      throw error;
    }
  }

  private handleAuthError(error: any): string {
    console.error("Firebase Auth Error:", error.code, error.message);
    switch (error.code) {
      case 'auth/configuration-not-found':
        return "Configuration manquante : Veuillez activer la méthode de connexion 'E-mail/Mot de passe' dans votre console Firebase (Authentication > Sign-in method).";
      case 'auth/email-already-in-use':
        return "Cet e-mail est déjà utilisé par un autre compte.";
      case 'auth/invalid-email':
        return "L'adresse e-mail n'est pas valide.";
      case 'auth/weak-password':
        return "Le mot de passe est trop court (min. 6 caractères).";
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return "Identifiants incorrects. Veuillez réessayer.";
      default:
        return error.message || "Une erreur inconnue est survenue.";
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
        throw new Error("Profil introuvable en base.");
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
      console.error("Update error:", error.message);
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
      return null;
    }
  }

  async setSubscriptionStatus(uid: string, status: boolean): Promise<void> {
    try {
      const profileRef = doc(this.db, "profiles", uid);
      await updateDoc(profileRef, { isSubscribed: status });
    } catch (error) {
      console.error("Sub error:", error);
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
