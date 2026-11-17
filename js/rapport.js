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

// Version 2.9 (Mise à jour silencieuse)
const APP_VERSION = "2.9";
if (localStorage.getItem("zeina_version") !== APP_VERSION) {
    if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    localStorage.setItem("zeina_version", APP_VERSION);
    console.log("Mise à jour vers la version " + APP_VERSION);
}

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

document.getElementById('logout-sidebar-btn').addEventListener('click', () => {
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

let currentAllEvents = [];
let currentStats = { prets: 0, retours: 0, dons: 0, ajouts: 0 };

async function generateReport() {
    const startInput = document.getElementById('date-debut').value;
    const endInput = document.getElementById('date-fin').value;

    const startDate = new Date(startInput);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endInput);
    endDate.setHours(23, 59, 59, 999);

    const submitBtn = document.querySelector('#report-form button');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calcul...';
    submitBtn.disabled = true;

    try {
        const materielMap = {};
        const materielSnap = await getDocs(collection(db, "materiel"));
        materielSnap.forEach(doc => materielMap[doc.id] = doc.data().nom);

        const medMap = {};
        const medSnap = await getDocs(collection(db, "medicaments"));
        medSnap.forEach(doc => medMap[doc.id] = doc.data().nom);

        currentAllEvents = [];
        currentStats = { prets: 0, retours: 0, dons: 0, ajouts: 0 };

        const pretsSnap = await getDocs(collection(db, "prets"));
        pretsSnap.forEach(doc => {
            const data = doc.data();
            const eventDate = data.datePret.toDate();
            if (eventDate >= startDate && eventDate <= endDate) {
                currentStats.prets++;
                currentAllEvents.push({
                    date: eventDate, category: 'materiel', itemId: data.materielId, type: 'pret',
                    titre: `Prêt : ${materielMap[data.materielId] || 'Matériel inconnu'}`,
                    desc: `Au patient : ${data.patientNom} | Par : ${data.membreEmail}`,
                    icon: 'fa-hand-holding-heart', color: 'text-blue-400', bg: 'bg-blue-900'
                });
            }
        });

        const retoursSnap = await getDocs(collection(db, "retours"));
        retoursSnap.forEach(doc => {
            const data = doc.data();
            const eventDate = data.dateRetour.toDate();
            if (eventDate >= startDate && eventDate <= endDate) {
                currentStats.retours++;
                currentAllEvents.push({
                    date: eventDate, category: 'materiel', itemId: data.materielId, type: 'retour',
                    titre: `Retour : ${materielMap[data.materielId] || 'Matériel inconnu'}`,
                    desc: `Validé par : ${data.membreEmail}`,
                    icon: 'fa-boxes-packing', color: 'text-emerald-400', bg: 'bg-emerald-900'
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
                    currentStats.dons += data.quantite;
                    currentAllEvents.push({
                        date: eventDate, category: 'medicament', itemId: data.medicamentId, type: 'don',
                        titre: `Don : ${medName} (-${data.quantite} boîte(s))`,
                        desc: `Au patient : ${data.beneficiaire} | Par : ${data.membreEmail}`,
                        icon: 'fa-pills', color: 'text-amber-400', bg: 'bg-amber-900'
                    });
                } else if (data.type === "ajout_stock") {
                    currentStats.ajouts += data.quantite;
                    currentAllEvents.push({
                        date: eventDate, category: 'medicament', itemId: data.medicamentId, type: 'ajout',
                        titre: `Ajout Stock : ${medName} (+${data.quantite} boîte(s))`,
                        desc: `Réceptionné par : ${data.membreEmail}`,
                        icon: 'fa-boxes-stacked', color: 'text-purple-400', bg: 'bg-purple-900'
                    });
                }
            }
        });

        document.getElementById('stat-prets').textContent = currentStats.prets;
        document.getElementById('stat-retours').textContent = currentStats.retours;
        document.getElementById('stat-dons').textContent = currentStats.dons;
        document.getElementById('stat-ajouts').textContent = currentStats.ajouts;

        currentAllEvents.sort((a, b) => b.date - a.date);

        const timelineEl = document.getElementById('report-timeline');
        timelineEl.innerHTML = "";

        if (currentAllEvents.length === 0) {
            timelineEl.innerHTML = `<p class="pl-6 text-slate-500 italic">Aucune activité enregistrée sur cette période.</p>`;
        } else {
            currentAllEvents.forEach(ev => {
                const dateStr = ev.date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const targetUrl = ev.category === 'materiel' ? `history.html?id=${ev.itemId}` : `med-history.html?id=${ev.itemId}`;

                const div = document.createElement('div');
                div.className = "relative pl-8 mb-4";
                div.innerHTML = `
                    <div class="absolute -left-[17px] top-1 h-8 w-8 rounded-full ${ev.bg} border-4 border-slate-900 flex items-center justify-center z-10">
                        <i class="fa-solid ${ev.icon} ${ev.color} text-xs"></i>
                    </div>
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
        alert("Erreur lors de la génération : " + error.message);
    } finally {
        submitBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Analyser';
        submitBtn.disabled = false;
    }
}

// =========================================================================
// MOTEUR PDF INFAILLIBLE : jsPDF + autoTable (Aucun blocage, Génération en 0.1s)
// =========================================================================
const btnDownloadPdf = document.getElementById('btn-download-pdf');
if(btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', () => {
        const btn = document.getElementById('btn-download-pdf');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Création...';
        btn.disabled = true;

        try {
            if (!window.jspdf) {
                alert("Erreur : La librairie PDF n'est pas chargée. Veuillez mettre à jour rapport.html.");
                btn.innerHTML = originalText;
                btn.disabled = false;
                return;
            }

            const startStr = document.getElementById('date-debut').value;
            const endStr = document.getElementById('date-fin').value;

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // En-tête du PDF
            doc.setFontSize(22);
            doc.setTextColor(37, 99, 235); // Bleu Zeïna
            doc.text("La Lumiere de l'Ange Zeina", 14, 20);

            doc.setFontSize(14);
            doc.setTextColor(71, 85, 105);
            doc.text("Rapport d'activite detaille", 14, 28);

            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184);
            doc.text(`Periode du ${startStr} au ${endStr}`, 14, 34);

            // Ligne de séparation
            doc.setDrawColor(226, 232, 240);
            doc.line(14, 38, 196, 38);

            // Chiffres Clés (Statistiques)
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text(`Prets : ${currentStats.prets}  |  Retours : ${currentStats.retours}  |  Dons : ${currentStats.dons}  |  Ajouts Stock : ${currentStats.ajouts}`, 14, 46);

            // Préparation des données du journal
            const tableData = currentAllEvents.map(ev => {
                const dateStr = ev.date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                // Nettoyage des caractères spéciaux pour une police standard
                let action = ev.type.toUpperCase();
                let titre = ev.titre.replace(/Prêt/g, 'Pret').replace(/Médicament/g, 'Medicament').replace(/Boîte/g, 'Boite').replace(/boîte/g, 'boite');
                let desc = ev.desc.replace(' | ', '\n').replace(/Bénéficiaire/g, 'Beneficiaire').replace(/Réceptionné/g, 'Receptionne');

                return [dateStr, action, titre, desc];
            });

            if (tableData.length === 0) {
                tableData.push(["-", "-", "Aucune operation sur cette periode", "-"]);
            }

            // Génération du tableau (autoTable gère tout le formatage proprement)
            if (doc.autoTable) {
                doc.autoTable({
                    startY: 52,
                    head: [['Date', 'Action', 'Objet', 'Details']],
                    body: tableData,
                    theme: 'striped',
                    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
                    styles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
                    columnStyles: {
                        0: { cellWidth: 28 },
                        1: { cellWidth: 22 },
                        2: { cellWidth: 65 },
                        3: { cellWidth: 'auto' }
                    },
                    didDrawPage: function (data) {
                        doc.setFontSize(8);
                        doc.setTextColor(148, 163, 184);
                        doc.text('Genere le ' + new Date().toLocaleString('fr-FR') + ' par l\'application Zeina', data.settings.margin.left, doc.internal.pageSize.height - 10);
                    }
                });
            } else {
                doc.text("Module tableau manquant.", 14, 60);
            }

            // Téléchargement du PDF
            doc.save(`Zeina_Rapport_${startStr}_au_${endStr}.pdf`);

        } catch (error) {
            console.error("Erreur PDF :", error);
            alert("Erreur : " + error.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

generateReport();
