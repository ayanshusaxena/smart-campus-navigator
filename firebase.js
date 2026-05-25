// js/firebase.js
// Firebase initialization — loaded before all other scripts

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCp0VEmGKV69XtoAaFZwIxeAduqIDqB9fg",
  authDomain: "smart-campus-navigator-16e82.firebaseapp.com",
  projectId: "smart-campus-navigator-16e82",
  storageBucket: "smart-campus-navigator-16e82.firebasestorage.app",
  messagingSenderId: "957937112548",
  appId: "1:957937112548:web:029fb6b0856678d5a423f1"
};

const ADMIN_EMAIL = "cricorts.com@gmail.com";

// Initialize Firebase app
firebase.initializeApp(FIREBASE_CONFIG);

// Global references used by other scripts
const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Current user state — updated by auth.js
window.__CNS_currentUser = null;
window.__CNS_isAdmin = false;
