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

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

document.getElementById('logout-sidebar-btn')?.addEventListener('click', () => {
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
            if (!data.datePret) return;
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
            if (!data.dateRetour) return;
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
            if (!data.date) return;
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

// ==========================================
// TÉLÉCHARGEMENT PDF (html2pdf sans toucher au fond de la page)
// ==========================================
const btnDownloadPdf = document.getElementById('btn-download-pdf');
if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', () => {
        if (typeof html2pdf === 'undefined') {
            alert("La bibliothèque html2pdf n'est pas chargée dans rapport.html.");
            return;
        }

        const btn = document.getElementById('btn-download-pdf');
        const originalText = btn.innerHTML;

        const startStr = document.getElementById('date-debut').value;
        const endStr = document.getElementById('date-fin').value;

        function getBadgeHtml(type) {
            if (type === 'pret') return `<span style="background:#eff6ff; color:#2563eb; padding: 3px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">PRÊT</span>`;
            if (type === 'retour') return `<span style="background:#ecfdf5; color:#10b981; padding: 3px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">RETOUR</span>`;
            if (type === 'don') return `<span style="background:#fffbeb; color:#d97706; padding: 3px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">DON</span>`;
            if (type === 'ajout') return `<span style="background:#faf5ff; color:#9333ea; padding: 3px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">STOCK</span>`;
            return '';
        }

        let trs = "";
        if (currentAllEvents.length === 0) {
            trs = `<tr><td colspan="4" style="padding: 15px; text-align: center; color: #94a3b8;">Aucune opération sur cette période.</td></tr>`;
        } else {
            trs = currentAllEvents.map(ev => {
                const dateStr = ev.date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `
                    <tr style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">
                        <td style="width: 17%; padding: 8px 5px; color: #475569; vertical-align: top;">${dateStr}</td>
                        <td style="width: 13%; padding: 8px 5px; vertical-align: top;">${getBadgeHtml(ev.type)}</td>
                        <td style="width: 34%; padding: 8px 5px; font-weight: bold; color: #1e293b; vertical-align: top; word-break: break-word;">${ev.titre}</td>
                        <td style="width: 36%; padding: 8px 5px; color: #64748b; line-height: 1.4; vertical-align: top; word-break: break-word;">${ev.desc.replace(' | ', '<br>')}</td>
                    </tr>
                `;
            }).join('');
        }

        const htmlString = `
        <div style="width: 700px; background: #ffffff; padding: 15px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; box-sizing: border-box;">
            <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 18px;">
                <h1 style="color: #1e293b; font-size: 22px; margin: 0;">La Lumière de l'Ange Zeïna</h1>
                <h2 style="color: #64748b; font-size: 15px; margin: 4px 0 0 0; font-weight: normal;">Rapport d'activité détaillé</h2>
                <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Période du <strong>${startStr}</strong> au <strong>${endStr}</strong></p>
            </div>

            <table style="width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 -8px 20px -8px;">
                <tr>
                    <td style="width: 25%; background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 6px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${currentStats.prets}</div>
                        <div style="margin-top: 4px; font-size: 9px; color: #475569; font-weight: bold; text-transform: uppercase;">Prêts</div>
                    </td>
                    <td style="width: 25%; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 6px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: #10b981;">${currentStats.retours}</div>
                        <div style="margin-top: 4px; font-size: 9px; color: #475569; font-weight: bold; text-transform: uppercase;">Retours</div>
                    </td>
                    <td style="width: 25%; background: #fffbeb; border: 1px solid #fde68a; padding: 12px 6px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: #d97706;">${currentStats.dons}</div>
                        <div style="margin-top: 4px; font-size: 9px; color: #475569; font-weight: bold; text-transform: uppercase;">Dons</div>
                    </td>
                    <td style="width: 25%; background: #faf5ff; border: 1px solid #e9d5ff; padding: 12px 6px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: #9333ea;">${currentStats.ajouts}</div>
                        <div style="margin-top: 4px; font-size: 9px; color: #475569; font-weight: bold; text-transform: uppercase;">Stock Reçu</div>
                    </td>
                </tr>
            </table>

            <h3 style="font-size: 14px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 0 0 10px 0; color: #0f172a;">Journal des opérations</h3>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; table-layout: fixed;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="width: 17%; padding: 8px 5px; border-bottom: 2px solid #cbd5e1; color: #475569;">Date</th>
                        <th style="width: 13%; padding: 8px 5px; border-bottom: 2px solid #cbd5e1; color: #475569;">Action</th>
                        <th style="width: 34%; padding: 8px 5px; border-bottom: 2px solid #cbd5e1; color: #475569;">Objet</th>
                        <th style="width: 36%; padding: 8px 5px; border-bottom: 2px solid #cbd5e1; color: #475569;">Détails</th>
                    </tr>
                </thead>
                <tbody>
                    ${trs}
                </tbody>
            </table>

            <div style="margin-top: 20px; text-align: right; color: #94a3b8; font-size: 9px;">
                Généré le ${new Date().toLocaleString('fr-FR')} par le système Zeïna.
            </div>
        </div>
        `;

        const opt = {
            margin:       10,
            filename:     `Zeina_Rapport_${startStr}_au_${endStr}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Génération...';
        btn.disabled = true;

        try {
            html2pdf().set(opt).from(htmlString).save().then(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }).catch(err => {
                console.error("Erreur PDF:", err);
                btn.innerHTML = originalText;
                btn.disabled = false;
                alert("Erreur lors de la création du PDF : " + (err.message || err));
            });
        } catch (err) {
            console.error("Erreur PDF:", err);
            btn.innerHTML = originalText;
            btn.disabled = false;
            alert("Erreur lors de la création du PDF : " + (err.message || err));
        }
    });
}

// ==========================================
// BOUTON IMPRIMER
// ==========================================
const btnPrint = document.getElementById('btn-print')
    || document.getElementById('print-btn')
    || document.getElementById('btn-imprimer')
    || Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('imprimer'));

if (btnPrint && !btnPrint.getAttribute('onclick')) {
    btnPrint.addEventListener('click', () => window.print());
}

generateReport();
