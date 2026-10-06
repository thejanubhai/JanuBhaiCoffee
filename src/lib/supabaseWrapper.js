import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, limit, doc, setDoc, deleteDoc, writeBatch, getDoc } from "firebase/firestore";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";

// Master Firebase Config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dummy-api-key-for-build',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "janubhaiconsultancy",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
if (getApps().length > 0) app = getApp();
else app = initializeApp(firebaseConfig);

const db = getFirestore(app, "janubhaiconsultancy");
const auth = getAuth(app);

class SupabaseQueryBuilder {
  constructor(coll) {
    this._collection = coll;
    this._select = '*';
    this._limit = null;
    this._eq = [];
  }

  select(cols) { this._select = cols; return this; }
  limit(count) { this._limit = count; return this; }
  eq(key, val) { this._eq.push({ key, val }); return this; }
  or(clause) { return this; }
  in(key, vals) { return this; }
  lte(key, val) { return this; }
  gte(key, val) { return this; }
  order(key, opts) { return this; }

  async single() {
    const res = await this.execute();
    return { data: res.data?.[0] || null, error: res.error };
  }
  async maybeSingle() { return this.single(); }

  async execute() {
    try {
      const collRef = collection(db, this._collection);
      let q = collRef;
      
      for (const cond of this._eq) {
        if (cond.key === 'id') {
          const d = await getDoc(doc(db, this._collection, cond.val));
          if (d.exists()) return { data: [{ id: d.id, ...d.data() }], error: null };
          return { data: [], error: null };
        }
        q = query(q, where(cond.key, "==", cond.val));
      }
      
      if (this._limit) q = query(q, limit(this._limit));
      
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { data, error: null };
    } catch (error) { return { data: null, error }; }
  }

  async insert(payload) {
    try {
      if (Array.isArray(payload)) {
        const batch = writeBatch(db);
        const results = [];
        for (const item of payload) {
          const dRef = doc(collection(db, this._collection));
          batch.set(dRef, item, { merge: true });
          results.push({ id: dRef.id, ...item });
        }
        await batch.commit();
        return { data: results, error: null };
      } else {
        const dRef = payload.id ? doc(db, this._collection, payload.id) : doc(collection(db, this._collection));
        await setDoc(dRef, payload, { merge: true });
        return { data: [{ id: dRef.id, ...payload }], error: null };
      }
    } catch (error) { return { data: null, error }; }
  }

  async update(payload) { return this.insert(payload); }
  async upsert(payload) { return this.insert(payload); }
  
  async delete() {
    try {
      const idCond = this._eq.find(c => c.key === 'id');
      if (idCond) await deleteDoc(doc(db, this._collection, idCond.val));
      return { data: null, error: null };
    } catch (error) { return { data: null, error }; }
  }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

export function createClient() {
  return {
    auth: {
      getUser: async () => {
        return new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) resolve({ data: { user: { id: user.uid, email: user.email } }, error: null });
            else resolve({ data: { user: null }, error: null });
          });
        });
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => {
        await signOut(auth);
        if (typeof window !== 'undefined') window.location.href = "https://janubhai.space/auth?app=janubhaicoffee";
        return { error: null };
      },
      admin: {
        generateLink: async () => ({ data: null, error: null }),
        deleteUser: async () => ({ data: null, error: null }),
      }
    },
    from: (table) => new SupabaseQueryBuilder(table),
    channel: (name) => ({
      on: () => ({ subscribe: () => {} }),
      subscribe: () => {},
      unsubscribe: () => {}
    }),
    removeChannel: () => {}
  };
}

