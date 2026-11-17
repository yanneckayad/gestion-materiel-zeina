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

const APP_VERSION = "2.4";
if (localStorage.getItem("zeina_version") !== APP_VERSION) {
    if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    localStorage.setItem("zeina_version", APP_VERSION);
    signOut(auth).then(() => { window.location.replace("index.html"); });
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
// NOUVEAU GÉNÉRATEUR PDF NATIF (IMMUNISÉ AUX COUPURES & PAGES BLANCHES)
// =========================================================================
const btnDownloadPdf = document.getElementById('btn-download-pdf');
if(btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', () => {
        const startStr = document.getElementById('date-debut').value;
        const endStr = document.getElementById('date-fin').value;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const cleanText = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

        // En-tête
        doc.setFontSize(22);
        doc.setTextColor(37, 99, 235);
        doc.text("La Lumiere de l'Ange Zeina", 105, 20, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text("RAPPORT D'ACTIVITE DETAILLE", 105, 30, { align: "center" });

        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text(`Periode du ${startStr} au ${endStr}`, 105, 38, { align: "center" });

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(15, 45, 195, 45);

        // Blocs Statistiques
        const startY = 52;

        doc.setDrawColor(191, 219, 254); doc.setFillColor(239, 246, 255);
        doc.roundedRect(15, startY, 40, 25, 3, 3, "FD");
        doc.setFontSize(20); doc.setTextColor(37, 99, 235);
        doc.text(currentStats.prets.toString(), 35, startY + 14, { align: "center" });
        doc.setFontSize(9); doc.setTextColor(71, 85, 105);
        doc.text("PRETS", 35, startY + 21, { align: "center" });

        doc.setDrawColor(167, 243, 208); doc.setFillColor(236, 253, 245);
        doc.roundedRect(59, startY, 40, 25, 3, 3, "FD");
        doc.setFontSize(20); doc.setTextColor(16, 185, 129);
        doc.text(currentStats.retours.toString(), 79, startY + 14, { align: "center" });
        doc.setFontSize(9); doc.setTextColor(71, 85, 105);
        doc.text("RETOURS", 79, startY + 21, { align: "center" });

        doc.setDrawColor(253, 230, 138); doc.setFillColor(255, 251, 235);
        doc.roundedRect(103, startY, 42, 25, 3, 3, "FD");
        doc.setFontSize(20); doc.setTextColor(217, 119, 6);
        doc.text(currentStats.dons.toString(), 124, startY + 14, { align: "center" });
        doc.setFontSize(9); doc.setTextColor(71, 85, 105);
        doc.text("DONS (Boites)", 124, startY + 21, { align: "center" });

        doc.setDrawColor(233, 213, 255); doc.setFillColor(250, 245, 255);
        doc.roundedRect(149, startY, 46, 25, 3, 3, "FD");
        doc.setFontSize(20); doc.setTextColor(147, 51, 234);
        doc.text(currentStats.ajouts.toString(), 172, startY + 14, { align: "center" });
        doc.setFontSize(9); doc.setTextColor(71, 85, 105);
        doc.text("STOCK RECU", 172, startY + 21, { align: "center" });

        // Titre Journal
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("Journal des operations", 15, 95);
        doc.setLineWidth(0.2);
        doc.line(15, 98, 195, 98);

        let yPos = 105;

        if (currentAllEvents.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184);
            doc.text("Aucune activite enregistree sur cette periode.", 105, 115, { align: "center" });
        } else {
            currentAllEvents.forEach(ev => {
                if (yPos > 275) {
                    doc.addPage();
                    yPos = 20;
                }

                const dateStr = ev.date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");

                if (ev.type === 'pret') doc.setTextColor(37, 99, 235);
                else if (ev.type === 'retour') doc.setTextColor(16, 185, 129);
                else if (ev.type === 'don') doc.setTextColor(217, 119, 6);
                else if (ev.type === 'ajout') doc.setTextColor(147, 51, 234);

                doc.text(`[${cleanText(ev.type).toUpperCase()}]`, 15, yPos);

                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 100, 100);
                doc.text(dateStr, 38, yPos);

                doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 41, 59);
                doc.text(cleanText(ev.titre), 65, yPos);

                yPos += 5;
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 100, 100);

                const splitDesc = doc.splitTextToSize(cleanText(ev.desc.replace(' | ', ' - ')), 125);
                doc.text(splitDesc, 65, yPos);

                yPos += (splitDesc.length * 4) + 2;

                doc.setDrawColor(226, 232, 240);
                doc.line(15, yPos, 195, yPos);
                yPos += 6;
            });
        }

        // Pied de page
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Genere le ${new Date().toLocaleString('fr-FR')} par Zeina`, 105, 290, { align: "center" });

        doc.save(`Zeina_Rapport_${startStr}_au_${endStr}.pdf`);
    });
}

generateReport();
