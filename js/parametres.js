import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA5RLJI5ahBhZKGQNLXCFWIEnRxx0MNN44",
    authDomain: "zeina-materiel.firebaseapp.com",
    projectId: "zeina-materiel",
    storageBucket: "zeina-materiel.firebasestorage.app",
    messagingSenderId: "746522436111",
    appId: "1:746522436111:web:f35696a07036abd285797a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        document.getElementById('user-email').textContent = user.email;
    }
});

document.getElementById('logout-sidebar-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

document.getElementById('btn-clear-cache').addEventListener('click', async () => {
    const btn = document.getElementById('btn-clear-cache');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Nettoyage...';

    if ('caches' in window) {
        const names = await caches.keys();
        for (let name of names) {
            await caches.delete(name);
        }
    }

    localStorage.removeItem("zeina_version");

    setTimeout(() => {
        alert("Cache nettoyé avec succès. L'application va redémarrer.");
        window.location.reload(true);
    }, 1000);
});

const toggleAnimationsBtn = document.getElementById('toggle-animations');
const toggleCircle = document.getElementById('toggle-circle');
let animationsEnabled = localStorage.getItem('zeina_animations') !== 'false';

function updateToggleUI() {
    if (animationsEnabled) {
        toggleAnimationsBtn.classList.replace('bg-slate-600', 'bg-blue-600');
        toggleCircle.classList.replace('left-1', 'right-1');
        document.body.classList.remove('no-animations');
    } else {
        toggleAnimationsBtn.classList.replace('bg-blue-600', 'bg-slate-600');
        toggleCircle.classList.replace('right-1', 'left-1');
        document.body.classList.add('no-animations');
    }
}

toggleAnimationsBtn.addEventListener('click', () => {
    animationsEnabled = !animationsEnabled;
    localStorage.setItem('zeina_animations', animationsEnabled);
    updateToggleUI();
});

updateToggleUI();
