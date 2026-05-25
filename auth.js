// js/auth.js
// Handles Google login, logout, role detection, and UI updates

function signInWithGoogle() {
  auth.signInWithPopup(googleProvider).catch(function(err) {
    console.error('Login failed:', err.message);
    alert('Login failed: ' + err.message);
  });
}

function signOut() {
  auth.signOut();
}

function isAdmin(user) {
  return user && user.email === ADMIN_EMAIL;
}

// Called on every auth state change
auth.onAuthStateChanged(function(user) {
  window.__CNS_currentUser = user;
  window.__CNS_isAdmin = isAdmin(user);
  updateAuthUI(user);
});

function updateAuthUI(user) {
  const loginBtn   = document.getElementById('btn-login');
  const logoutBtn  = document.getElementById('btn-logout');
  const adminBtn   = document.getElementById('btn-admin');
  const userInfo   = document.getElementById('auth-user-info');

  if (!loginBtn) return; // not on index.html

  if (!user) {
    // Logged out state
    loginBtn.style.display  = 'inline-flex';
    logoutBtn.style.display = 'none';
    if (adminBtn) adminBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
  } else {
    // Logged in state
    loginBtn.style.display  = 'none';
    // Hide login modal if open
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
    logoutBtn.style.display = 'inline-flex';
    if (userInfo) {
      userInfo.style.display = 'inline-flex';
      userInfo.textContent   = user.displayName || user.email;
    }
    if (adminBtn) {
      adminBtn.style.display = window.__CNS_isAdmin ? 'inline-flex' : 'none';
    }
  }
}
