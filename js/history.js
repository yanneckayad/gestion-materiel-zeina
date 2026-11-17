import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

// ==========================================
// SYSTÈME DE MISE À JOUR FORCÉE (VERSION UNIFIÉE)
const APP_VERSION = "2.4";

if (localStorage.getItem("zeina_version") !== APP_VERSION) {
    if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    localStorage.setItem("zeina_version", APP_VERSION);
    signOut(auth).then(() => { window.location.replace("index.html"); });
}
// ==========================================

// Sécurité : Redirection si non connecté
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

// Récupération de l'ID du matériel dans l'URL
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('id');

if (!itemId) {
    alert("Aucun matériel sélectionné.");
    window.location.href = "dashboard.html";
}

// Références HTML
const itemNameEl = document.getElementById('item-name');
const itemRefEl = document.getElementById('item-ref');
const itemStatusEl = document.getElementById('item-status');
const qrBox = document.getElementById('qr-box');
const timelineEl = document.getElementById('history-timeline');

// Fonction pour charger les données du matériel
async function loadItemData() {
    try {
        const itemSnap = await getDoc(doc(db, "materiel", itemId));
        if (itemSnap.exists()) {
            const data = itemSnap.data();

            // Affichage des infos texte
            itemNameEl.textContent = data.nom;
            itemRefEl.textContent = data.reference;

            // Affichage du joli badge de statut
            if (data.statut === "Disponible") {
                itemStatusEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-circle-check"></i> Disponible</span>`;
            } else if (data.statut === "En prêt") {
                itemStatusEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><i class="fa-solid fa-clock"></i> En prêt</span>`;
            } else {
                itemStatusEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20"><i class="fa-solid fa-wrench"></i> En réparation</span>`;
            }

            // Génération du QR Code
            new QRCode(qrBox, {
                text: data.reference,
                width: 150,
                height: 150,
                colorDark : "#0f172a",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });

            // Logique du bouton Imprimer
            document.getElementById('btn-print-qr').addEventListener('click', () => {
                const canvas = qrBox.querySelector('canvas');
                if(!canvas) return;
                const qrImage = canvas.toDataURL("image/png");
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                    <head><title>Impression Etiquette</title></head>
                    <body style="text-align: center; font-family: Arial, sans-serif; padding-top: 20px;">
                        <h2 style="margin-bottom: 5px;">${data.nom}</h2>
                        <p style="font-size: 18px; color: #555; margin-top: 0;">Réf: <strong>${data.reference}</strong></p>
                        <img src="${qrImage}" style="margin: 20px auto; display: block; width: 150px; height: 150px;" />
                        <p style="font-size: 12px; color: #888;">La Lumière de l'Ange Zeïna</p>
                        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }<\/script>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            });

            // On charge ensuite l'historique
            loadHistory();
        } else {
            alert("Matériel introuvable.");
        }
    } catch (error) {
        console.error("Erreur de chargement :", error);
    }
}

// Fonction pour charger la timeline
async function loadHistory() {
    try {
        let history = [];

        // 1. Récupérer les PRÊTS
        const pretsQuery = query(collection(db, "prets"), where("materielId", "==", itemId));
        const pretsSnap = await getDocs(pretsQuery);
        pretsSnap.forEach(doc => {
            const data = doc.data();
            history.push({
                type: 'pret',
                dateObject: data.datePret.toDate(),
                dateFormatee: data.datePret.toDate().toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                data: data
            });
        });

        // 2. Récupérer les RETOURS
        const retoursQuery = query(collection(db, "retours"), where("materielId", "==", itemId));
        const retoursSnap = await getDocs(retoursQuery);
        retoursSnap.forEach(doc => {
            const data = doc.data();
            history.push({
                type: 'retour',
                dateObject: data.dateRetour.toDate(),
                dateFormatee: data.dateRetour.toDate().toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                data: data
            });
        });

        // 3. Trier du plus récent au plus ancien
        history.sort((a, b) => b.dateObject - a.dateObject);

        // 4. Affichage
        timelineEl.innerHTML = "";

        if (history.length === 0) {
            timelineEl.innerHTML = `<p class="pl-6 text-slate-500 italic">Aucun mouvement enregistré pour ce matériel.</p>`;
            return;
        }

        history.forEach(event => {
            const div = document.createElement('div');
            div.className = "relative pl-8 sm:pl-10";

            if (event.type === 'pret') {
                div.innerHTML = `
                    <div class="absolute -left-[17px] top-1 h-8 w-8 rounded-full bg-blue-900 border-4 border-slate-900 flex items-center justify-center">
                        <i class="fa-solid fa-hand-holding-heart text-blue-400 text-xs"></i>
                    </div>
                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <div class="flex justify-between items-start mb-2 flex-wrap gap-2">
                            <span class="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase rounded border border-blue-500/20">Prêt</span>
                            <span class="text-xs text-slate-400 font-mono"><i class="fa-regular fa-clock mr-1"></i> ${event.dateFormatee}</span>
                        </div>
                        <p class="text-white text-sm mb-2"><span class="text-slate-400">Au patient :</span> <span class="font-bold">${event.data.patientNom}</span></p>
                        <p class="text-sm text-slate-300 mb-3"><span class="text-slate-400">Par :</span> ${event.data.membreNom} (${event.data.membreEmail})</p>
                        <div class="mt-2 border-t border-slate-700 pt-3 flex flex-col sm:flex-row gap-4">
                            <div class="flex-1 text-xs text-slate-400 space-y-1">
                                <p><i class="fa-solid fa-phone w-4 text-center"></i> ${event.data.patientTelephone}</p>
                                <p><i class="fa-solid fa-id-card w-4 text-center"></i> ${event.data.patientPieceId}</p>
                            </div>
                            <div class="w-24 h-24 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                                <img src="${event.data.photoSortie}" alt="Photo prêt" class="w-full h-full object-cover">
                            </div>
                        </div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div class="absolute -left-[17px] top-1 h-8 w-8 rounded-full bg-emerald-900 border-4 border-slate-900 flex items-center justify-center">
                        <i class="fa-solid fa-boxes-packing text-emerald-400 text-xs"></i>
                    </div>
                    <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <div class="flex justify-between items-start mb-2 flex-wrap gap-2">
                            <span class="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase rounded border border-emerald-500/20">Retour</span>
                            <span class="text-xs text-slate-400 font-mono"><i class="fa-regular fa-clock mr-1"></i> ${event.dateFormatee}</span>
                        </div>
                        <p class="text-sm text-slate-300 mb-3"><span class="text-slate-400">Validé par :</span> ${event.data.membreEmail}</p>
                        <div class="mt-2 border-t border-slate-700 pt-3 flex">
                            <div class="w-24 h-24 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden">
                                <img src="${event.data.photoRetour}" alt="Photo retour" class="w-full h-full object-cover">
                            </div>
                        </div>
                    </div>
                `;
            }
            timelineEl.appendChild(div);
        });

    } catch (error) {
        console.error("Erreur historique :", error);
        timelineEl.innerHTML = `<p class="pl-6 text-red-400">Erreur lors du chargement de l'historique.</p>`;
    }
}

// Démarrage
loadItemData();
