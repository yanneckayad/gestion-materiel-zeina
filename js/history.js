import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Ta configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA5RLJI5ahBhZKGQNLXCFWIEnRxx0MNN44",
    authDomain: "zeina-materiel.firebaseapp.com",
    projectId: "zeina-materiel",
    storageBucket: "zeina-materiel.firebasestorage.app",
    messagingSenderId: "746522436111",
    appId: "1:746522436111:web:f35696a07036abd285797a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('id');

if (!itemId) window.location.href = "dashboard.html";

const itemTitle = document.getElementById('item-title');
const itemRef = document.getElementById('item-ref');
const timeline = document.getElementById('timeline');

async function loadHistory() {
    try {
        const itemDoc = await getDoc(doc(db, "materiel", itemId));
        if (itemDoc.exists()) {
            itemTitle.textContent = itemDoc.data().nom;
            itemRef.textContent = "Référence : " + itemDoc.data().reference;
        } else {
            itemTitle.textContent = "Matériel introuvable";
            return;
        }

        const qPrets = query(collection(db, "prets"), where("materielId", "==", itemId));
        const pretsSnapshot = await getDocs(qPrets);

        const qRetours = query(collection(db, "retours"), where("materielId", "==", itemId));
        const retoursSnapshot = await getDocs(qRetours);

        let events = [];

        pretsSnapshot.forEach((doc) => {
            const data = doc.data();

            // Transforme la date de "2026-11-16" à "16/11/2026"
            let dateSaisie = "Non spécifiée";
            if (data.dateDebutPret) {
                const parts = data.dateDebutPret.split('-');
                if (parts.length === 3) dateSaisie = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }

            events.push({
                type: "Prêt",
                date: data.datePret.toDate(),
                dateSaisie: dateSaisie, // La nouvelle date demandée
                membre: data.membreNom || data.membreEmail, // Le nouveau nom du bénévole
                patient: data.patientNom,
                pieceId: data.patientPieceId || "Non renseignée", // La nouvelle pièce d'identité
                telephone: data.patientTelephone,
                duree: data.duree,
                photo: data.photoSortie
            });
        });

        retoursSnapshot.forEach((doc) => {
            const data = doc.data();
            events.push({
                type: "Retour",
                date: data.dateRetour.toDate(),
                membre: data.membreEmail,
                photo: data.photoRetour
            });
        });

        events.sort((a, b) => b.date - a.date);

        timeline.innerHTML = "";

        if (events.length === 0) {
            timeline.innerHTML = '<p class="text-slate-400">Aucun historique pour ce matériel.</p>';
            return;
        }

        events.forEach(event => {
            const dateStr = event.date.toLocaleDateString('fr-FR') + ' à ' + event.date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

            if (event.type === "Prêt") {
                timeline.innerHTML += `
                    <div class="mb-8 relative">
                        <div class="absolute -left-[33px] bg-blue-500 h-4 w-4 rounded-full border-4 border-slate-900"></div>
                        <div class="bg-slate-800 p-5 rounded-lg border border-slate-700">
                            <div class="flex justify-between items-start mb-3">
                                <span class="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Sortie en prêt</span>
                                <span class="text-sm text-slate-400">Saisi le ${dateStr}</span>
                            </div>
                            <p class="text-slate-300 mb-1"><span class="font-semibold text-white">Date du prêt :</span> ${event.dateSaisie}</p>
                            <p class="text-slate-300 mb-1"><span class="font-semibold text-white">Patient :</span> ${event.patient} (Tél: ${event.telephone})</p>
                            <p class="text-slate-300 mb-1"><span class="font-semibold text-white">N° Pièce d'identité :</span> ${event.pieceId}</p>
                            <p class="text-slate-300 mb-3"><span class="font-semibold text-white">Durée :</span> ${event.duree} durée</p>
                            <a href="${event.photo}" target="_blank" class="block w-32 rounded-lg overflow-hidden border border-slate-600 hover:opacity-80 transition">
                                <img src="${event.photo}" alt="État sortie" class="w-full h-auto object-cover">
                            </a>
                            <p class="text-xs text-slate-500 mt-3">Bénévole : ${event.membre}</p>
                        </div>
                    </div>
                `;
            } else {
                timeline.innerHTML += `
                    <div class="mb-8 relative">
                        <div class="absolute -left-[33px] bg-green-500 h-4 w-4 rounded-full border-4 border-slate-900"></div>
                        <div class="bg-slate-800 p-5 rounded-lg border border-slate-700">
                            <div class="flex justify-between items-start mb-3">
                                <span class="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Retour</span>
                                <span class="text-sm text-slate-400">${dateStr}</span>
                            </div>
                            <a href="${event.photo}" target="_blank" class="block w-32 rounded-lg overflow-hidden border border-slate-600 hover:opacity-80 transition">
                                <img src="${event.photo}" alt="État retour" class="w-full h-auto object-cover">
                            </a>
                            <p class="text-xs text-slate-500 mt-3">Récupéré par : ${event.membre}</p>
                        </div>
                    </div>
                `;
            }
        });

    } catch (error) {
        timeline.innerHTML = `<p class="text-red-400">Erreur : ${error.message}</p>`;
    }
}

loadHistory();
