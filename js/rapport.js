import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// ==========================================
// SYSTÈME DE MISE À JOUR FORCÉE
const APP_VERSION = "2.1"; // ⚠️ Change ce numéro à chaque fois que tu mets à jour le site (ex: "2.1", "2.2")

if (localStorage.getItem("zeina_version") !== APP_VERSION) {
    // 1. On vide la mémoire cache du téléphone pour forcer le nouveau code
    if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    // 2. On mémorise la nouvelle version
    localStorage.setItem("zeina_version", APP_VERSION);
    // 3. On force la déconnexion et on renvoie à l'accueil
    signOut(auth).then(() => {
        window.location.replace("index.html");
    });
}
// ==========================================

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

const today = new Date();
const lastMonth = new Date();
lastMonth.setDate(today.getDate() - 30);

document.getElementById('date-fin').valueAsDate = today;
document.getElementById('date-debut').valueAsDate = lastMonth;

document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await generateReport();
});

async function generateReport() {
    const startInput = document.getElementById('date-debut').value;
    const endInput = document.getElementById('date-fin').value;

    const startDate = new Date(startInput);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endInput);
    endDate.setHours(23, 59, 59, 999);

    const submitBtn = document.querySelector('#report-form button');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calcul...';
    submitBtn.disabled = true;

    try {
        const materielMap = {};
        const materielSnap = await getDocs(collection(db, "materiel"));
        materielSnap.forEach(doc => materielMap[doc.id] = doc.data().nom);

        const medMap = {};
        const medSnap = await getDocs(collection(db, "medicaments"));
        medSnap.forEach(doc => medMap[doc.id] = doc.data().nom);

        let allEvents = [];
        let countPrets = 0, countRetours = 0, countDons = 0, countAjouts = 0;

        const pretsSnap = await getDocs(collection(db, "prets"));
        pretsSnap.forEach(doc => {
            const data = doc.data();
            const eventDate = data.datePret.toDate();
            if (eventDate >= startDate && eventDate <= endDate) {
                countPrets++;
                allEvents.push({
                    date: eventDate,
                    category: 'materiel',
                    itemId: data.materielId, // Sauvegarde de l'ID pour le lien
                    type: 'pret',
                    titre: `Prêt : ${materielMap[data.materielId] || 'Matériel inconnu'}`,
                    desc: `Au patient : ${data.patientNom} | Par : ${data.membreEmail}`,
                    icon: 'fa-hand-holding-heart',
                    color: 'text-blue-400',
                    bg: 'bg-blue-900'
                });
            }
        });

        const retoursSnap = await getDocs(collection(db, "retours"));
        retoursSnap.forEach(doc => {
            const data = doc.data();
            const eventDate = data.dateRetour.toDate();
            if (eventDate >= startDate && eventDate <= endDate) {
                countRetours++;
                allEvents.push({
                    date: eventDate,
                    category: 'materiel',
                    itemId: data.materielId, // Sauvegarde de l'ID pour le lien
                    type: 'retour',
                    titre: `Retour : ${materielMap[data.materielId] || 'Matériel inconnu'}`,
                    desc: `Validé par : ${data.membreEmail}`,
                    icon: 'fa-boxes-packing',
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-900'
                });
            }
        });

        const medHistSnap = await getDocs(collection(db, "historique_medicaments"));
        medHistSnap.forEach(doc => {
            const data = doc.data();
            const eventDate = data.date.toDate();
            if (eventDate >= startDate && eventDate <= endDate) {
                const medName = medMap[data.medicamentId] || 'Médicament supprimé';

                if (data.type === "distribution") {
                    countDons += data.quantite;
                    allEvents.push({
                        date: eventDate,
                        category: 'medicament',
                        itemId: data.medicamentId, // Sauvegarde de l'ID pour le lien
                        type: 'don',
                        titre: `Don : ${medName} (-${data.quantite} boîte(s))`,
                        desc: `Au patient : ${data.beneficiaire} | Par : ${data.membreEmail}`,
                        icon: 'fa-pills',
                        color: 'text-amber-400',
                        bg: 'bg-amber-900'
                    });
                } else if (data.type === "ajout_stock") {
                    countAjouts += data.quantite;
                    allEvents.push({
                        date: eventDate,
                        category: 'medicament',
                        itemId: data.medicamentId, // Sauvegarde de l'ID pour le lien
                        type: 'ajout',
                        titre: `Ajout Stock : ${medName} (+${data.quantite} boîte(s))`,
                        desc: `Réceptionné par : ${data.membreEmail}`,
                        icon: 'fa-boxes-stacked',
                        color: 'text-purple-400',
                        bg: 'bg-purple-900'
                    });
                }
            }
        });

        document.getElementById('stat-prets').textContent = countPrets;
        document.getElementById('stat-retours').textContent = countRetours;
        document.getElementById('stat-dons').textContent = countDons;
        document.getElementById('stat-ajouts').textContent = countAjouts;

        allEvents.sort((a, b) => b.date - a.date);

        const timelineEl = document.getElementById('report-timeline');
        timelineEl.innerHTML = "";

        if (allEvents.length === 0) {
            timelineEl.innerHTML = `<p class="pl-6 text-slate-500 italic">Aucune activité enregistrée sur cette période.</p>`;
        } else {
            allEvents.forEach(ev => {
                const dateStr = ev.date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                // Définition de l'URL cible selon la catégorie (matériel ou médicament)
                const targetUrl = ev.category === 'materiel' ? `history.html?id=${ev.itemId}` : `med-history.html?id=${ev.itemId}`;

                const div = document.createElement('div');
                div.className = "relative pl-8 mb-4";
                div.innerHTML = `
                    <div class="absolute -left-[17px] top-1 h-8 w-8 rounded-full ${ev.bg} border-4 border-slate-900 flex items-center justify-center z-10">
                        <i class="fa-solid ${ev.icon} ${ev.color} text-xs"></i>
                    </div>
                    <!-- Transformation de la carte en lien cliquable -->
                    <a href="${targetUrl}" class="block bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 hover:bg-slate-800 hover:border-slate-500 transition-all group shadow-sm hover:shadow-md cursor-pointer">
                        <div class="flex justify-between items-start flex-wrap gap-2">
                            <h4 class="text-white font-bold text-sm group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                ${ev.titre}
                                <i class="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </h4>
                            <span class="text-xs text-slate-400 font-mono">${dateStr}</span>
                        </div>
                        <p class="text-xs text-slate-300 mt-1">${ev.desc}</p>
                    </a>
                `;
                timelineEl.appendChild(div);
            });
        }

    } catch (error) {
        alert("Erreur lors de la génération du rapport : " + error.message);
        console.error(error);
    } finally {
        submitBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Analyser';
        submitBtn.disabled = false;
    }
}

generateReport();
