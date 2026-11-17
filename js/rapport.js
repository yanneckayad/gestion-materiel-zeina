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

// Toujours version 2.4 (On utilisera le bouton dans Paramètres pour vider le cache)
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
// MOTEUR PDF INFAILLIBLE : TECHNIQUE DE L'ÉCRAN DE CHARGEMENT
// =========================================================================
const btnDownloadPdf = document.getElementById('btn-download-pdf');
if(btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', () => {
        const btn = document.getElementById('btn-download-pdf');
        const originalText = btn.innerHTML;

        const startStr = document.getElementById('date-debut').value;
        const endStr = document.getElementById('date-fin').value;

        function getBadgeHtml(type) {
            if (type === 'pret') return `<span style="background:#eff6ff; color:#2563eb; padding: 4px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">PRÊT</span>`;
            if (type === 'retour') return `<span style="background:#ecfdf5; color:#10b981; padding: 4px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">RETOUR</span>`;
            if (type === 'don') return `<span style="background:#fffbeb; color:#d97706; padding: 4px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">DON</span>`;
            if (type === 'ajout') return `<span style="background:#faf5ff; color:#9333ea; padding: 4px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">STOCK</span>`;
            return '';
        }

        let trs = "";
        if (currentAllEvents.length === 0) {
            trs = `<tr><td colspan="4" style="padding: 15px; text-align: center; color: #94a3b8;">Aucune opération sur cette période.</td></tr>`;
        } else {
            trs = currentAllEvents.map(ev => {
                const dateStr = ev.date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="width: 15%; padding: 12px 6px; color: #475569; vertical-align: top;">${dateStr}</td>
                        <td style="width: 12%; padding: 12px 6px; vertical-align: top;">${getBadgeHtml(ev.type)}</td>
                        <td style="width: 33%; padding: 12px 6px; font-weight: bold; color: #1e293b; vertical-align: top; word-break: break-word;">${ev.titre}</td>
                        <td style="width: 40%; padding: 12px 6px; color: #64748b; line-height: 1.5; vertical-align: top; word-break: break-word;">${ev.desc.replace(' | ', '<br>')}</td>
                    </tr>
                `;
            }).join('');
        }

        const htmlString = `
        <div style="width: 800px; background: white; padding: 30px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; box-sizing: border-box;">
            <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px;">
                <h1 style="color: #1e293b; font-size: 26px; margin: 0;">La Lumière de l'Ange Zeïna</h1>
                <h2 style="color: #64748b; font-size: 18px; margin: 6px 0 0 0;">Rapport d'activité détaillé</h2>
                <p style="color: #94a3b8; font-size: 14px; margin: 6px 0 0 0;">Période du <strong>${startStr}</strong> au <strong>${endStr}</strong></p>
            </div>

            <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 30px; width: 100%;">
                <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="margin: 0; font-size: 24px; color: #2563eb;">${currentStats.prets}</h3>
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: #475569; font-weight: bold; text-transform: uppercase;">Prêts</p>
                </div>
                <div style="flex: 1; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="margin: 0; font-size: 24px; color: #10b981;">${currentStats.retours}</h3>
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: #475569; font-weight: bold; text-transform: uppercase;">Retours</p>
                </div>
                <div style="flex: 1; background: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="margin: 0; font-size: 24px; color: #d97706;">${currentStats.dons}</h3>
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: #475569; font-weight: bold; text-transform: uppercase;">Dons</p>
                </div>
                <div style="flex: 1; background: #faf5ff; border: 1px solid #e9d5ff; padding: 15px; border-radius: 8px; text-align: center;">
                    <h3 style="margin: 0; font-size: 24px; color: #9333ea;">${currentStats.ajouts}</h3>
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: #475569; font-weight: bold; text-transform: uppercase;">Stock Reçu</p>
                </div>
            </div>

            <h3 style="font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; color: #0f172a;">Journal des opérations</h3>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; table-layout: fixed;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="width: 15%; padding: 10px 6px; border-bottom: 2px solid #cbd5e1; color: #475569;">Date</th>
                        <th style="width: 12%; padding: 10px 6px; border-bottom: 2px solid #cbd5e1; color: #475569;">Action</th>
                        <th style="width: 33%; padding: 10px 6px; border-bottom: 2px solid #cbd5e1; color: #475569;">Objet</th>
                        <th style="width: 40%; padding: 10px 6px; border-bottom: 2px solid #cbd5e1; color: #475569;">Détails</th>
                    </tr>
                </thead>
                <tbody>
                    ${trs}
                </tbody>
            </table>
            <div style="margin-top: 30px; text-align: right; color: #94a3b8; font-size: 10px;">
                Généré le ${new Date().toLocaleString('fr-FR')} par le système Zeïna.
            </div>
        </div>
        `;

        // 1. ÉCRAN DE CHARGEMENT PLEIN ÉCRAN (Cache la bidouille à l'utilisateur)
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = '100vw';
        loadingOverlay.style.height = '100vh';
        loadingOverlay.style.backgroundColor = '#0f172a';
        loadingOverlay.style.zIndex = '99999'; // Par-dessus TOUT
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.flexDirection = 'column';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.innerHTML = `
            <div style="text-align: center;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 40px; color: #3b82f6; margin-bottom: 15px;"></i>
                <h2 style="color: white; font-family: sans-serif; font-size: 18px; margin: 0;">Génération du PDF...</h2>
                <p style="color: #94a3b8; font-family: sans-serif; font-size: 12px; margin-top: 5px;">Veuillez patienter quelques secondes.</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);

        // 2. LE DOCUMENT PDF RÉEL (En dessous de l'écran de chargement)
        const pdfWrapper = document.createElement('div');
        pdfWrapper.innerHTML = htmlString;
        pdfWrapper.style.position = 'absolute';
        pdfWrapper.style.top = '0';
        pdfWrapper.style.left = '0';
        pdfWrapper.style.width = '800px';
        pdfWrapper.style.zIndex = '99998'; // Juste en dessous de l'écran de chargement

        document.body.appendChild(pdfWrapper);
        window.scrollTo(0, 0); // Sécurité pour iOS

        const opt = {
            margin:       10,
            filename:     `Zeina_Rapport_${startStr}_au_${endStr}.pdf`,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        btn.disabled = true;

        // 3. CAPTURE ET NETTOYAGE
        html2pdf().set(opt).from(pdfWrapper).save().then(() => {
            document.body.removeChild(pdfWrapper);
            document.body.removeChild(loadingOverlay);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }).catch(err => {
            console.error("Erreur PDF:", err);
            document.body.removeChild(pdfWrapper);
            document.body.removeChild(loadingOverlay);
            btn.innerHTML = originalText;
            btn.disabled = false;
            alert("Erreur lors de la création du PDF.");
        });
    });
}

generateReport();
