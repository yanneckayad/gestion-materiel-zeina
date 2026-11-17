import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Passage à la version 2.5 !
const APP_VERSION = "2.5";

if (localStorage.getItem("zeina_version") !== APP_VERSION) {
    if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    localStorage.setItem("zeina_version", APP_VERSION);
    signOut(auth).then(() => { window.location.replace("index.html"); });
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        // Lancement de la vérification des nouveautés à la connexion
        checkAndShowWelcomeModal();
    }
});

document.getElementById('logout-sidebar-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

// =========================================================================
// LOGIQUE DE LA FENÊTRE DE BIENVENUE ET DES NOUVEAUTÉS
// =========================================================================
async function checkAndShowWelcomeModal() {
    const welcomeModal = document.getElementById('welcome-modal');
    if (!welcomeModal) return;

    const lastVisitStr = localStorage.getItem('zeina_last_visit');
    const lastNotifiedVersion = localStorage.getItem('zeina_notified_version');
    const now = new Date();

    let showUpdates = false;
    let showActivities = false;

    // 1. Liste des mises à jour (Tu pourras modifier ce texte pour tes futures versions !)
    const changelog = {
        "2.5": [
            "Nouvelle fenêtre affichant l'activité des autres membres depuis votre dernière visite.",
            "Amélioration des performances de la base de données.",
            "Exportation PDF HD 100% fonctionnelle sur mobile."
        ]
    };

    const updatesListEl = document.getElementById('welcome-updates-list');

    // Si c'est une nouvelle mise à jour, on affiche le bloc
    if (lastNotifiedVersion !== APP_VERSION) {
        const notes = changelog[APP_VERSION] || ["Amélioration des performances et correction de bugs."];
        updatesListEl.innerHTML = notes.map(n => `<li>${n}</li>`).join('');
        document.getElementById('welcome-updates-section').classList.remove('hidden');
        showUpdates = true;
    }

    // 2. Recherche de l'activité depuis la dernière visite
    if (lastVisitStr) {
        const lastVisit = new Date(lastVisitStr);
        const events = [];

        try {
            // On récupère d'abord les noms pour que l'affichage soit propre
            const materielMap = {};
            const matSnap = await getDocs(collection(db, "materiel"));
            matSnap.forEach(d => materielMap[d.id] = d.data().nom);

            const medMap = {};
            const medSnap = await getDocs(collection(db, "medicaments"));
            medSnap.forEach(d => medMap[d.id] = d.data().nom);

            // Recherche des Prêts récents
            const snapPrets = await getDocs(query(collection(db, "prets"), where("datePret", ">", lastVisit)));
            snapPrets.forEach(d => {
                const data = d.data();
                events.push({ date: data.datePret.toDate(), text: `<strong>Prêt : ${materielMap[data.materielId] || 'Matériel'}</strong><br>À ${data.patientNom} par <span class="text-blue-300">${data.membreEmail}</span>`, icon: "fa-hand-holding-heart text-blue-400" });
            });

            // Recherche des Retours récents
            const snapRetours = await getDocs(query(collection(db, "retours"), where("dateRetour", ">", lastVisit)));
            snapRetours.forEach(d => {
                const data = d.data();
                events.push({ date: data.dateRetour.toDate(), text: `<strong>Retour : ${materielMap[data.materielId] || 'Matériel'}</strong><br>Validé par <span class="text-emerald-300">${data.membreEmail}</span>`, icon: "fa-boxes-packing text-emerald-400" });
            });

            // Recherche de la Pharmacie récente
            const snapMeds = await getDocs(query(collection(db, "historique_medicaments"), where("date", ">", lastVisit)));
            snapMeds.forEach(d => {
                const data = d.data();
                const nomMed = medMap[data.medicamentId] || 'Médicament';
                if (data.type === "distribution") {
                    events.push({ date: data.date.toDate(), text: `<strong>Don : ${nomMed}</strong> (-${data.quantite})<br>À ${data.beneficiaire} par <span class="text-amber-300">${data.membreEmail}</span>`, icon: "fa-pills text-amber-400" });
                } else if (data.type === "ajout_stock") {
                    events.push({ date: data.date.toDate(), text: `<strong>Ajout Stock : ${nomMed}</strong> (+${data.quantite})<br>Par <span class="text-purple-300">${data.membreEmail}</span>`, icon: "fa-boxes-stacked text-purple-400" });
                }
            });

            if (events.length > 0) {
                showActivities = true;
                document.getElementById('welcome-activity-section').classList.remove('hidden');

                events.sort((a, b) => b.date - a.date); // Trier du plus récent au plus ancien

                document.getElementById('welcome-activity-list').innerHTML = events.slice(0, 8).map(ev => `
                    <div class="flex items-start gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 shadow-sm">
                        <div class="mt-1 text-lg"><i class="fa-solid ${ev.icon}"></i></div>
                        <div>
                            <p class="text-sm text-slate-200 leading-snug">${ev.text}</p>
                            <p class="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">${ev.date.toLocaleString('fr-FR', {day: '2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                    </div>
                `).join('');
            } else {
                if(!showUpdates) document.getElementById('welcome-empty-state').classList.remove('hidden');
            }
        } catch(e) {
            console.error("Erreur historique:", e);
        }
    } else {
        // Première visite absolue sur ce navigateur
        if(!showUpdates) {
            showUpdates = true;
            updatesListEl.innerHTML = "<li>Bienvenue sur votre espace de gestion associatif !</li>";
            document.getElementById('welcome-updates-section').classList.remove('hidden');
        }
    }

    // On affiche la modale s'il y a quelque chose à dire
    if (showUpdates || showActivities || !lastVisitStr) {
        welcomeModal.classList.remove('hidden');
    }

    // Fonction de fermeture : on sauvegarde la date ACTUELLE
    const closeModal = () => {
        welcomeModal.classList.add('hidden');
        localStorage.setItem('zeina_last_visit', now.toISOString());
        localStorage.setItem('zeina_notified_version', APP_VERSION);
    };

    document.getElementById('close-welcome-modal').addEventListener('click', closeModal);
    document.getElementById('btn-welcome-ok').addEventListener('click', closeModal);
}
// =========================================================================


let allMateriel = [];
let currentFilter = "all";
let searchQuery = "";
let currentItemId;
let currentItemRef;

// --- Logique d'affichage et d'impression du QR après création ---
const qrSuccessModal = document.getElementById('qr-success-modal');
const qrSuccessBox = document.getElementById('qr-success-box');
const qrSuccessName = document.getElementById('qr-success-name');
const qrSuccessRef = document.getElementById('qr-success-ref');

if (document.getElementById('btn-close-success')) {
    document.getElementById('btn-close-success').addEventListener('click', () => {
        qrSuccessModal.classList.add('hidden');
    });
}

if (document.getElementById('btn-print-qr')) {
    document.getElementById('btn-print-qr').addEventListener('click', () => {
        const canvas = qrSuccessBox.querySelector('canvas');
        if(!canvas) return;
        const qrImage = canvas.toDataURL("image/png");

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head><title>Impression Etiquette</title></head>
            <body style="text-align: center; font-family: Arial, sans-serif; padding-top: 20px;">
                <h2 style="margin-bottom: 5px;">${qrSuccessName.textContent}</h2>
                <p style="font-size: 18px; color: #555; margin-top: 0;">Réf: <strong>${qrSuccessRef.textContent}</strong></p>
                <img src="${qrImage}" style="margin: 20px auto; display: block; width: 150px; height: 150px;" />
                <p style="font-size: 12px; color: #888;">La Lumière de l'Ange Zeïna</p>
                <script>
                    window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    });
}

const addItemForm = document.getElementById('add-item-form');
if (addItemForm) {
    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('item-name').value;
        const ref = document.getElementById('item-ref').value;
        const submitBtn = addItemForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Ajout...';
        submitBtn.disabled = true;

        try {
            await addDoc(collection(db, "materiel"), { nom: name, reference: ref, statut: "Disponible", dateAjout: new Date() });
            addItemForm.reset();

            qrSuccessName.textContent = name;
            qrSuccessRef.textContent = ref;
            qrSuccessBox.innerHTML = "";
            new QRCode(qrSuccessBox, {
                text: ref,
                width: 150,
                height: 150,
                colorDark : "#0f172a",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
            qrSuccessModal.classList.remove('hidden');

        } catch (error) {
            alert("Erreur lors de l'ajout : " + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

function enleverAccents(texte) {
    if (!texte) return "";
    return String(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

if (document.getElementById('search-bar')) {
    document.getElementById('search-bar').addEventListener('input', (e) => {
        searchQuery = enleverAccents(e.target.value);
        renderInventory();
    });
}

const btnFilterAll = document.getElementById('filter-all');
const btnFilterAvailable = document.getElementById('filter-available');
const btnFilterLoaned = document.getElementById('filter-loaned');
const btnFilterRepair = document.getElementById('filter-repair');

function updateFilterUI(activeBtn) {
    if(!btnFilterAll) return;
    [btnFilterAll, btnFilterAvailable, btnFilterLoaned, btnFilterRepair].forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white', 'shadow-md');
        btn.classList.add('text-slate-400');
    });
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-700', 'text-white', 'shadow-md');
}

if (btnFilterAll) {
    btnFilterAll.addEventListener('click', () => { currentFilter = "all"; updateFilterUI(btnFilterAll); renderInventory(); });
    btnFilterAvailable.addEventListener('click', () => { currentFilter = "Disponible"; updateFilterUI(btnFilterAvailable); renderInventory(); });
    btnFilterLoaned.addEventListener('click', () => { currentFilter = "En prêt"; updateFilterUI(btnFilterLoaned); renderInventory(); });
    btnFilterRepair.addEventListener('click', () => { currentFilter = "En réparation"; updateFilterUI(btnFilterRepair); renderInventory(); });
}

const inventoryList = document.getElementById('inventory-list');

function renderInventory() {
    if (!inventoryList) return;
    inventoryList.innerHTML = "";

    const filteredList = allMateriel.filter(item => {
        const matchStatus = currentFilter === "all" || item.data.statut === currentFilter;
        const nomPropre = enleverAccents(item.data.nom);
        const refPropre = enleverAccents(item.data.reference);
        const matchSearch = nomPropre.includes(searchQuery) || refPropre.includes(searchQuery);

        return matchStatus && matchSearch;
    });

    if (filteredList.length === 0) {
        inventoryList.innerHTML = '<div class="text-center py-10 text-slate-500 animate-fade-in"><i class="fa-solid fa-magnifying-glass text-4xl mb-3 opacity-50"></i><p>Aucun matériel trouvé.</p></div>';
        return;
    }

    filteredList.forEach((item, index) => {
        const data = item.data;
        const itemId = item.id;
        const itemElement = document.createElement('div');
        itemElement.className = "animate-fade-in bg-slate-900/40 p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-slate-700/50 hover:border-slate-500 hover:bg-slate-800/60 shadow-lg hover:shadow-xl transition-all duration-300";
        itemElement.style.animationDelay = `${index * 0.05}s`;

        let actionHtml = '';
        let statusBadge = '';

        if (data.statut === "Disponible") {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-circle-check"></i> Disponible</span>`;
            actionHtml = `
                <div class="flex gap-2 w-full sm:w-auto">
                    <button class="btn-panne bg-slate-700 hover:bg-orange-500 text-slate-300 hover:text-white text-sm px-4 py-2.5 rounded-lg shadow-lg transition-all" data-id="${itemId}" title="Signaler une panne"><i class="fa-solid fa-wrench pointer-events-none"></i></button>
                    <button class="btn-preter flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all" data-id="${itemId}" data-nom="${data.nom}" data-ref="${data.reference}"><i class="fa-solid fa-hand-holding-heart mr-2 pointer-events-none"></i>Prêter</button>
                </div>
            `;
        } else if (data.statut === "En prêt") {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><i class="fa-solid fa-clock"></i> En prêt</span>`;
            actionHtml = `<button class="btn-restituer w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all" data-id="${itemId}" data-nom="${data.nom}"><i class="fa-solid fa-boxes-packing mr-2 pointer-events-none"></i>Restituer</button>`;
        } else if (data.statut === "En réparation") {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20"><i class="fa-solid fa-triangle-exclamation"></i> En panne</span>`;
            actionHtml = `<button class="btn-repare w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-all" data-id="${itemId}"><i class="fa-solid fa-check-double mr-2 pointer-events-none"></i>Marquer Réparé</button>`;
        }

        itemElement.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-3 mb-1">
                    <a href="history.html?id=${itemId}" class="font-bold text-lg text-white hover:text-blue-400 transition-colors flex items-center gap-2 group">
                        ${data.nom} <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </a>
                </div>
                <div class="flex items-center gap-3">
                    <p class="text-sm font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">Réf: ${data.reference}</p>
                    ${statusBadge}
                </div>
            </div>
            <div class="flex items-center w-full sm:w-auto mt-3 sm:mt-0">
                ${actionHtml}
            </div>
        `;
        inventoryList.appendChild(itemElement);
    });

    document.querySelectorAll('.btn-preter').forEach(button => {
        button.addEventListener('click', (e) => {
            currentItemId = e.target.getAttribute('data-id');
            currentItemRef = e.target.getAttribute('data-ref');
            modalItemName.textContent = e.target.getAttribute('data-nom');
            document.getElementById('loan-date').valueAsDate = new Date();
            loanModal.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.btn-restituer').forEach(button => {
        button.addEventListener('click', (e) => {
            currentItemId = e.target.getAttribute('data-id');
            returnModalItemName.textContent = e.target.getAttribute('data-nom');
            returnModal.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.btn-panne').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (confirm("Confirmer la mise en panne de ce matériel ? Il ne pourra plus être prêté.")) {
                const id = e.target.getAttribute('data-id');
                await updateDoc(doc(db, "materiel", id), { statut: "En réparation" });
            }
        });
    });

    document.querySelectorAll('.btn-repare').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (confirm("Le matériel a-t-il bien été réparé et est-il prêt à l'emploi ?")) {
                const id = e.target.getAttribute('data-id');
                await updateDoc(doc(db, "materiel", id), { statut: "Disponible" });
            }
        });
    });
}

onSnapshot(collection(db, "materiel"), (snapshot) => {
    allMateriel = [];
    snapshot.forEach((doc) => {
        allMateriel.push({ id: doc.id, data: doc.data() });
    });
    renderInventory();
});

let html5QrcodeScanner;
const qrModal = document.getElementById('qr-modal');
const btnScanQr = document.getElementById('btn-scan-qr');
const closeQrModalBtn = document.getElementById('close-qr-modal');
const searchBar = document.getElementById('search-bar');

if (btnScanQr) {
    btnScanQr.addEventListener('click', () => {
        qrModal.classList.remove('hidden');
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
        html5QrcodeScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                html5QrcodeScanner.stop().then(() => {
                    qrModal.classList.add('hidden');
                    searchBar.value = decodedText;
                    searchQuery = enleverAccents(decodedText);
                    renderInventory();
                }).catch(err => console.error(err));
            },
            (errorMessage) => { }
        ).catch(err => {
            alert("Erreur d'accès à la caméra. Vérifiez les autorisations sur Vercel.");
            qrModal.classList.add('hidden');
        });
    });
}

if(closeQrModalBtn) {
    closeQrModalBtn.addEventListener('click', () => {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.stop().then(() => qrModal.classList.add('hidden')).catch(err => qrModal.classList.add('hidden'));
        } else {
            qrModal.classList.add('hidden');
        }
    });
}

function genererBonDePretPDF(equipementNom, equipementRef, infosPret) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(30, 64, 175);
    doc.text("La Lumiere de l'Ange Zeina", 105, 20, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("BON DE PRET DE MATERIEL MEDICAL", 105, 30, { align: "center" });

    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Informations sur le materiel :", 20, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Equipement : ${equipementNom}`, 20, 60);
    doc.text(`Reference : ${equipementRef}`, 20, 70);
    doc.text(`Date du pret : ${infosPret.dateDebutPret}`, 20, 80);
    doc.text(`Duree prevue : ${infosPret.duree}`, 20, 90);

    doc.setFont("helvetica", "bold");
    doc.text("Informations du beneficiaire :", 110, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Nom : ${infosPret.patientNom}`, 110, 60);
    doc.text(`Piece d'identite : ${infosPret.patientPieceId}`, 110, 70);
    doc.text(`Telephone : ${infosPret.patientTelephone}`, 110, 80);
    doc.text(`Ne(e) le : ${infosPret.patientDateNaissance}`, 110, 90);

    doc.line(20, 100, 190, 100);

    doc.text(`Benevole ayant effectue le pret : ${infosPret.membreNom}`, 20, 110);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Conditions de pret :", 20, 130);
    doc.text("- Le materiel prete reste l'entiere propriete de l'association.", 20, 140);
    doc.text("- Le beneficiaire s'engage a en prendre soin et a le restituer dans son etat initial.", 20, 145);
    doc.text("- En cas de panne, veuillez contacter l'association immediatement.", 20, 150);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "italic");
    doc.text("Signature du beneficiaire", 40, 180);
    doc.setFontSize(9);
    doc.text("(precedee de la mention 'Lu et approuve')", 35, 185);

    doc.setFontSize(12);
    doc.text("Signature du benevole", 130, 180);

    const nomFichier = `Bon_de_pret_${infosPret.patientNom.replace(/\s+/g, '_')}.pdf`;
    doc.save(nomFichier);
}

const loanModal = document.getElementById('loan-modal');
const closeLoanBtn = document.getElementById('close-modal-btn');
const closeLoanIcon = document.getElementById('close-modal-icon-btn');
const loanForm = document.getElementById('loan-form');
const modalItemName = document.getElementById('modal-item-name');
const noPhotoLoan = document.getElementById('no-photo-loan');
const equipmentPhoto = document.getElementById('equipment-photo');

const returnModal = document.getElementById('return-modal');
const closeReturnBtn = document.getElementById('close-return-modal-btn');
const closeReturnIcon = document.getElementById('close-return-icon-btn');
const returnForm = document.getElementById('return-form');
const returnModalItemName = document.getElementById('return-modal-item-name');
const noPhotoReturn = document.getElementById('no-photo-return');
const returnPhoto = document.getElementById('return-photo');

function closeLoan() { if(loanModal) loanModal.classList.add('hidden'); if(loanForm) loanForm.reset(); if(equipmentPhoto) equipmentPhoto.disabled = false; }
function closeReturn() { if(returnModal) returnModal.classList.add('hidden'); if(returnForm) returnForm.reset(); if(returnPhoto) returnPhoto.disabled = false; }

if(closeLoanBtn) closeLoanBtn.addEventListener('click', closeLoan);
if(closeLoanIcon) closeLoanIcon.addEventListener('click', closeLoan);
if(closeReturnBtn) closeReturnBtn.addEventListener('click', closeReturn);
if(closeReturnIcon) closeReturnIcon.addEventListener('click', closeReturn);

if(noPhotoLoan) {
    noPhotoLoan.addEventListener('change', (e) => {
        equipmentPhoto.disabled = e.target.checked;
        if(e.target.checked) equipmentPhoto.value = "";
    });
}
if(noPhotoReturn) {
    noPhotoReturn.addEventListener('change', (e) => {
        returnPhoto.disabled = e.target.checked;
        if(e.target.checked) returnPhoto.value = "";
    });
}

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "zeina_photos");
    const response = await fetch("https://api.cloudinary.com/v1_1/qljytaa3/image/upload", { method: "POST", body: formData });
    const data = await response.json();
    return data.secure_url;
}

if (loanForm) {
    loanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = equipmentPhoto.files[0];
        const isNoPhoto = noPhotoLoan.checked;

        if (!file && !isNoPhoto) return alert("Veuillez prendre une photo, ou cocher la case si c'est impossible.");

        const submitBtn = loanForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validation...';
        submitBtn.disabled = true;

        try {
            const loanData = {
                dateDebutPret: document.getElementById('loan-date').value,
                membreNom: document.getElementById('member-name').value,
                patientPieceId: document.getElementById('patient-id').value,
                patientNom: document.getElementById('patient-name').value,
                patientTelephone: document.getElementById('patient-phone').value,
                patientDateNaissance: document.getElementById('patient-dob').value,
                duree: document.getElementById('loan-duration').value
            };

            let imageUrl = "https://placehold.co/400x300/1e293b/94a3b8?text=Photo+non+disponible";
            if (file && !isNoPhoto) {
                imageUrl = await uploadToCloudinary(file);
            }

            await addDoc(collection(db, "prets"), {
                materielId: currentItemId,
                dateDebutPret: loanData.dateDebutPret,
                membreNom: loanData.membreNom,
                patientPieceId: loanData.patientPieceId,
                patientNom: loanData.patientNom,
                patientTelephone: loanData.patientTelephone,
                patientDateNaissance: loanData.patientDateNaissance,
                duree: loanData.duree,
                photoSortie: imageUrl,
                datePret: new Date(),
                membreEmail: auth.currentUser ? auth.currentUser.email : "Email introuvable"
            });

            await updateDoc(doc(db, "materiel", currentItemId), { statut: "En prêt" });

            genererBonDePretPDF(modalItemName.textContent, currentItemRef, loanData);

            closeLoan();
        } catch (error) {
            alert("Erreur lors du prêt : " + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

if (returnForm) {
    returnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = returnPhoto.files[0];
        const isNoPhoto = noPhotoReturn.checked;

        if (!file && !isNoPhoto) return alert("Veuillez prendre une photo, ou cocher la case si c'est impossible.");

        const submitBtn = returnForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
        submitBtn.disabled = true;

        try {
            let imageUrl = "https://placehold.co/400x300/1e293b/94a3b8?text=Photo+non+disponible";

            if (file && !isNoPhoto) {
                imageUrl = await uploadToCloudinary(file);
            }

            await addDoc(collection(db, "retours"), {
                materielId: currentItemId,
                photoRetour: imageUrl,
                dateRetour: new Date(),
                membreEmail: auth.currentUser ? auth.currentUser.email : "Email introuvable"
            });

            await updateDoc(doc(db, "materiel", currentItemId), { statut: "Disponible" });
            closeReturn();
        } catch (error) {
            alert("Erreur lors du retour : " + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}
