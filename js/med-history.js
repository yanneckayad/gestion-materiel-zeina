import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const db = getFirestore(app);

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

const urlParams = new URLSearchParams(window.location.search);
const medId = urlParams.get('id');

if (!medId) {
    window.location.href = "medicaments.html";
}

const photoEl = document.getElementById('med-photo');
const nameEl = document.getElementById('med-name');
const stockEl = document.getElementById('med-stock');
const statusEl = document.getElementById('med-status');
const timelineEl = document.getElementById('med-timeline');

async function loadMedDetails() {
    try {
        const snap = await getDoc(doc(db, "medicaments", medId));
        if (!snap.exists()) {
            alert("Médicament introuvable.");
            window.location.href = "medicaments.html";
            return;
        }

        const data = snap.data();
        nameEl.textContent = data.nom;
        stockEl.textContent = `Stock actuel : ${data.quantite} boîtes`;
        photoEl.src = data.photo;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expDate = new Date(data.dateExpiration);
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

        if (data.quantite === 0) {
            statusEl.innerHTML = `<span class="px-3 py-1 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Rupture de stock</span>`;
        } else if (diffDays < 0) {
            statusEl.innerHTML = `<span class="px-3 py-1 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Périmé</span>`;
        } else {
            statusEl.innerHTML = `<span class="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">En stock (Expire le ${data.dateExpiration})</span>`;
        }

        loadMedHistory();
    } catch (error) {
        console.error(error);
    }
}

async function loadMedHistory() {
    try {
        const q = query(collection(db, "historique_medicaments"), where("medicamentId", "==", medId));
        const querySnap = await getDocs(q);

        let history = [];
        querySnap.forEach(docSnap => {
            const d = docSnap.data();
            history.push({
                dateObj: d.date.toDate(),
                dateFormatee: d.date.toDate().toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                ...d
            });
        });

        // Tri du plus récent au plus ancien
        history.sort((a, b) => b.dateObj - a.dateObj);

        timelineEl.innerHTML = "";

        if (history.length === 0) {
            timelineEl.innerHTML = `<p class="pl-6 text-slate-500 italic">Aucun mouvement enregistré pour ce médicament.</p>`;
            return;
        }

        history.forEach(ev => {
            const div = document.createElement('div');
            div.className = "relative pl-8";

            if (ev.type === "ajout_stock") {
                div.innerHTML = `
                    <div class="absolute -left-[17px] top-1 h-8 w-8 rounded-full bg-blue-900 border-4 border-slate-900 flex items-center justify-center">
                        <i class="fa-solid fa-plus text-blue-400 text-xs"></i>
                    </div>
                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <div class="flex justify-between items-start mb-1 flex-wrap gap-2">
                            <span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase rounded border border-blue-500/20">Ajout de stock</span>
                            <span class="text-xs text-slate-400 font-mono">${ev.dateFormatee}</span>
                        </div>
                        <p class="text-white text-sm">Ajout de <strong class="text-emerald-400">+${ev.quantite}</strong> boîte(s)</p>
                        <p class="text-xs text-slate-400 mt-1">Enregistré par : ${ev.membreEmail}</p>
                    </div>
                `;
            } else if (ev.type === "distribution") {
                div.innerHTML = `
                    <div class="absolute -left-[17px] top-1 h-8 w-8 rounded-full bg-emerald-900 border-4 border-slate-900 flex items-center justify-center">
                        <i class="fa-solid fa-hand-holding-medical text-emerald-400 text-xs"></i>
                    </div>
                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <div class="flex justify-between items-start mb-1 flex-wrap gap-2">
                            <span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase rounded border border-emerald-500/20">Distribution (Don)</span>
                            <span class="text-xs text-slate-400 font-mono">${ev.dateFormatee}</span>
                        </div>
                        <p class="text-white text-sm">Don de <strong class="text-red-400">-${ev.quantite}</strong> boîte(s) au patient : <span class="font-bold text-white">${ev.beneficiaire}</span></p>
                        <p class="text-xs text-slate-400 mt-1">Distribué par : ${ev.membreEmail}</p>
                    </div>
                `;
            }
            timelineEl.appendChild(div);
        });

    } catch (error) {
        console.error("Erreur historique med :", error);
        timelineEl.innerHTML = `<p class="pl-6 text-red-400">Erreur lors du chargement de l'historique.</p>`;
    }
}

loadMedDetails();
