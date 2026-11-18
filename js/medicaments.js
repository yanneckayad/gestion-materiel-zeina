import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let allMeds = [];
let allPatients = [];
let searchQuery = "";
let currentFilter = "all";
let currentMedId = null;
let currentPatientId = null;
let currentMedLots = [];
let scannedBarcodeValue = "";

function normalizeText(str) {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

document.getElementById('logout-sidebar-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

// ==========================================
// GESTION DES ONGLETS (STOCK / PATIENTS)
// ==========================================
const tabStock = document.getElementById('tab-stock');
const tabPatients = document.getElementById('tab-patients');
const viewStock = document.getElementById('view-stock');
const viewPatients = document.getElementById('view-patients');

function switchTab(tab) {
    if (tab === 'stock') {
        viewStock.classList.remove('hidden');
        viewPatients.classList.add('hidden');

        tabStock.classList.add('bg-blue-600', 'text-white', 'shadow-lg', 'shadow-blue-500/20');
        tabStock.classList.remove('text-slate-400', 'hover:text-white');

        tabPatients.classList.remove('bg-rose-600', 'text-white', 'shadow-lg', 'shadow-rose-500/20');
        tabPatients.classList.add('text-slate-400', 'hover:text-white');
    } else {
        viewPatients.classList.remove('hidden');
        viewStock.classList.add('hidden');

        tabPatients.classList.add('bg-rose-600', 'text-white', 'shadow-lg', 'shadow-rose-500/20');
        tabPatients.classList.remove('text-slate-400', 'hover:text-white');

        tabStock.classList.remove('bg-blue-600', 'text-white', 'shadow-lg', 'shadow-blue-500/20');
        tabStock.classList.add('text-slate-400', 'hover:text-white');
    }
}

tabStock.addEventListener('click', () => switchTab('stock'));
tabPatients.addEventListener('click', () => switchTab('patients'));

// ==========================================
// GESTION DU STOCK PHARMACIE
// ==========================================
document.getElementById('search-med').addEventListener('input', (e) => {
    searchQuery = normalizeText(e.target.value);
    renderMeds();
});

const btnAll = document.getElementById('filter-all');
const btnStock = document.getElementById('filter-stock');
const btnExpiring = document.getElementById('filter-expiring');
const btnRupture = document.getElementById('filter-rupture');

function updateFilterUI(activeBtn) {
    [btnAll, btnStock, btnExpiring, btnRupture].forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white', 'shadow-md');
        btn.classList.add('text-slate-400');
    });
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-700', 'text-white', 'shadow-md');
}

btnAll.addEventListener('click', () => { currentFilter = "all"; updateFilterUI(btnAll); renderMeds(); });
btnStock.addEventListener('click', () => { currentFilter = "stock"; updateFilterUI(btnStock); renderMeds(); });
btnExpiring.addEventListener('click', () => { currentFilter = "expiring"; updateFilterUI(btnExpiring); renderMeds(); });
btnRupture.addEventListener('click', () => { currentFilter = "rupture"; updateFilterUI(btnRupture); renderMeds(); });

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "zeina_photos");
    const response = await fetch("https://api.cloudinary.com/v1_1/qljytaa3/image/upload", { method: "POST", body: formData });
    const data = await response.json();
    return data.secure_url;
}

function extractLots(data) {
    let lots = data.lots || [];
    let qteTotale = data.quantiteTotale ?? data.quantite ?? 0;
    if (lots.length === 0 && data.dateExpiration && qteTotale > 0) {
        lots = [{ quantite: qteTotale, dateExpiration: data.dateExpiration }];
    }
    lots = lots.map(l => ({ ...l })).sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));
    return { lots, qteTotale };
}

// ==========================================
// OUVERTURE UNIFIÉE DE LA MODALE DE DON
// ==========================================
function populateGiveModalForMed(medItem, prefillQty = 1) {
    currentMedId = medItem.id;
    const { lots, qteTotale } = extractLots(medItem.data);
    currentMedLots = lots;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    document.getElementById('give-med-name').textContent = `${medItem.data.nom} (${qteTotale} dispo)`;
    const stockInfoEl = document.getElementById('give-med-stock-info');
    if (stockInfoEl) stockInfoEl.textContent = `Total disponible : ${qteTotale} boîte(s)`;

    const lotSelect = document.getElementById('give-lot-select');
    lotSelect.innerHTML = "";
    lots.forEach((lot) => {
        const opt = document.createElement('option');
        opt.value = lot.dateExpiration;

        const expDate = new Date(lot.dateExpiration);
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        const baseText = `Lot Exp: ${lot.dateExpiration} (${lot.quantite} dispo)`;

        if (diffDays < 0) {
            opt.textContent = `⛔ PÉRIMÉ: ${baseText}`;
        } else if (diffDays <= 90) {
            opt.textContent = `🔴 URGENT (${diffDays}j): ${baseText}`;
        } else {
            opt.textContent = `🟢 ${baseText}`;
        }

        lotSelect.appendChild(opt);
    });

    const maxFirstLot = lots.length > 0 ? lots[0].quantite : 1;
    document.getElementById('give-quantity').value = Math.min(Math.max(1, prefillQty), maxFirstLot);
}

async function openGiveModal({ medIds = [], beneficiary = "", quantity = 1, patientId = null }) {
    currentPatientId = patientId;

    let availableMeds = [];
    for (const id of medIds) {
        const medDoc = await getDoc(doc(db, "medicaments", id));
        if (medDoc.exists()) {
            const medData = medDoc.data();
            const { lots, qteTotale } = extractLots(medData);
            if (qteTotale > 0 && lots.length > 0) {
                availableMeds.push({ id: medDoc.id, data: medData });
            }
        }
    }

    if (availableMeds.length === 0) {
        return alert("Ce médicament est en rupture totale de stock.");
    }

    const existingSelectWrap = document.getElementById('give-med-select-wrap');
    if (existingSelectWrap) existingSelectWrap.remove();

    if (availableMeds.length > 1) {
        const wrap = document.createElement('div');
        wrap.id = 'give-med-select-wrap';
        wrap.innerHTML = `
            <label class="block text-xs font-medium text-slate-400 mb-1">Choisir la boîte en stock</label>
            <select id="give-med-select" class="w-full px-3 py-2.5 bg-slate-900/50 text-white border border-emerald-500/40 rounded-xl"></select>
        `;
        const selectEl = wrap.querySelector('#give-med-select');
        availableMeds.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.data.nom} (${extractLots(m.data).qteTotale} dispo)`;
            selectEl.appendChild(opt);
        });
        selectEl.addEventListener('change', (e) => {
            const chosen = availableMeds.find(m => m.id === e.target.value);
            if (chosen) populateGiveModalForMed(chosen, quantity);
        });

        const giveForm = document.getElementById('give-med-form');
        giveForm.insertBefore(wrap, giveForm.firstChild);
    }

    populateGiveModalForMed(availableMeds[0], quantity);
    document.getElementById('give-beneficiary').value = beneficiary;
    document.getElementById('give-med-modal').classList.remove('hidden');
}

const addMedForm = document.getElementById('add-med-form');
addMedForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('med-name').value;
    const stock = parseInt(document.getElementById('med-stock').value);
    const expDate = document.getElementById('med-exp').value;
    const file = document.getElementById('med-photo').files[0];

    if (!expDate) return alert("Veuillez sélectionner une date d'expiration.");

    const submitBtn = addMedForm.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';
    submitBtn.disabled = true;

    try {
        let imageUrl = "https://placehold.co/400x300/1e293b/94a3b8?text=Boîte+de+médicament";
        if (file) imageUrl = await uploadToCloudinary(file);

        const medRef = await addDoc(collection(db, "medicaments"), {
            nom: name,
            quantiteTotale: stock,
            quantite: stock,
            lots: [{ quantite: stock, dateExpiration: expDate }],
            photo: imageUrl,
            codeBarre: "",
            dateAjout: new Date()
        });

        await addDoc(collection(db, "historique_medicaments"), {
            medicamentId: medRef.id,
            type: "ajout_stock",
            quantite: stock,
            membreEmail: auth.currentUser ? auth.currentUser.email : "Inconnu",
            date: new Date()
        });

        addMedForm.reset();
        alert("Médicament ajouté avec succès !");
    } catch (error) {
        alert("Erreur : " + error.message);
    } finally {
        submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Ajouter au stock';
        submitBtn.disabled = false;
    }
});

let html5BarcodeScanner;
const barcodeModal = document.getElementById('barcode-modal');
const newMedModal = document.getElementById('new-med-modal');

document.getElementById('btn-scan-barcode').addEventListener('click', () => {
    barcodeModal.classList.remove('hidden');
    html5BarcodeScanner = new Html5Qrcode("barcode-reader");
    html5BarcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 150 } },
        async (decodedText) => {
            await html5BarcodeScanner.stop();
            barcodeModal.classList.add('hidden');
            scannedBarcodeValue = decodedText;
            await verifierCodeBarre(decodedText);
        },
        (errorMessage) => {}
    ).catch(err => {
        alert("Erreur d'accès à la caméra : " + err);
        barcodeModal.classList.add('hidden');
    });
});

document.getElementById('close-barcode-modal').addEventListener('click', () => {
    if (html5BarcodeScanner) {
        html5BarcodeScanner.stop().then(() => barcodeModal.classList.add('hidden')).catch(() => barcodeModal.classList.add('hidden'));
    } else {
        barcodeModal.classList.add('hidden');
    }
});

async function verifierCodeBarre(code) {
    try {
        const q = query(collection(db, "medicaments"), where("codeBarre", "==", code));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const medData = docSnap.data();

            document.getElementById('search-med').value = medData.nom;
            searchQuery = normalizeText(medData.nom);
            renderMeds();
            const qte = extractLots(medData).qteTotale;
            alert(`Médicament reconnu : "${medData.nom}" (Stock : ${qte} boîtes)`);
        } else {
            const codeDisplay = document.getElementById('scanned-code-display');
            if (codeDisplay) codeDisplay.textContent = `Code-barres scanné : ${code}`;
            document.getElementById('scanned-med-name').value = "";
            document.getElementById('scanned-med-stock').value = 1;
            document.getElementById('scanned-med-exp').value = "";
            document.getElementById('scanned-med-photo').value = "";
            newMedModal.classList.remove('hidden');
        }
    } catch (error) {
        alert("Erreur lors de la vérification : " + error.message);
    }
}

document.getElementById('close-new-med-modal').addEventListener('click', () => newMedModal.classList.add('hidden'));
document.getElementById('cancel-new-med').addEventListener('click', () => newMedModal.classList.add('hidden'));

document.getElementById('new-scanned-med-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('scanned-med-name').value;
    const stock = parseInt(document.getElementById('scanned-med-stock').value);
    const expDate = document.getElementById('scanned-med-exp').value;
    const file = document.getElementById('scanned-med-photo').files[0];

    if (!expDate) return alert("Veuillez sélectionner une date d'expiration.");

    try {
        let imageUrl = "https://placehold.co/400x300/1e293b/94a3b8?text=Boîte+de+médicament";
        if (file) imageUrl = await uploadToCloudinary(file);

        const medRef = await addDoc(collection(db, "medicaments"), {
            nom: name,
            quantiteTotale: stock,
            quantite: stock,
            lots: [{ quantite: stock, dateExpiration: expDate }],
            photo: imageUrl,
            codeBarre: scannedBarcodeValue,
            dateAjout: new Date()
        });

        await addDoc(collection(db, "historique_medicaments"), {
            medicamentId: medRef.id,
            type: "ajout_stock",
            quantite: stock,
            membreEmail: auth.currentUser ? auth.currentUser.email : "Inconnu",
            date: new Date()
        });

        newMedModal.classList.add('hidden');
        alert(`Nouveau médicament "${name}" enregistré avec succès !`);
    } catch (error) {
        alert("Erreur : " + error.message);
    }
});

const medListEl = document.getElementById('med-list');

function renderMeds() {
    medListEl.innerHTML = "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = allMeds.filter(item => {
        const { lots, qteTotale } = extractLots(item.data);
        const matchesSearch = normalizeText(item.data.nom).includes(searchQuery);
        const isRupture = qteTotale === 0;

        let isExpiringSoon = false;
        if (lots.length > 0) {
            const expDate = new Date(lots[0].dateExpiration);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 90) isExpiringSoon = true;
        }

        if (currentFilter === "stock" && isRupture) return false;
        if (currentFilter === "rupture" && !isRupture) return false;
        if (currentFilter === "expiring" && !isExpiringSoon) return false;

        return matchesSearch;
    });

    if (filtered.length === 0) {
        medListEl.innerHTML = '<div class="text-center py-10 text-slate-500 animate-fade-in"><i class="fa-solid fa-pills text-4xl mb-3 opacity-50"></i><p>Aucun médicament trouvé.</p></div>';
        return;
    }

    filtered.forEach((item, index) => {
        const data = item.data;
        const id = item.id;
        const { lots, qteTotale } = extractLots(data);

        let badgeHtml = '';
        if (qteTotale === 0) {
            badgeHtml = `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-circle-xmark mr-1"></i> Rupture</span>`;
        } else if (lots.length > 0) {
            const expDate = new Date(lots[0].dateExpiration);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
                badgeHtml = `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Périmé !</span>`;
            } else if (diffDays <= 90) {
                badgeHtml = `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><i class="fa-solid fa-clock mr-1"></i>Urgent (${diffDays}j)</span>`;
            } else {
                badgeHtml = `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-circle-check mr-1"></i> Bon état</span>`;
            }
        }

        const lotsHtml = lots.map(l => `<span class="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-[10px]">${l.quantite}x Exp: ${l.dateExpiration}</span>`).join(' ');

        const card = document.createElement('div');
        card.className = "animate-slide-up bg-slate-900/40 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-700/50 hover:border-slate-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300";
        card.style.animationDelay = `${index * 60}ms`;

        card.innerHTML = `
            <div class="flex items-center gap-4 w-full sm:w-auto">
                <div class="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 shadow-md">
                    <img src="${data.photo}" alt="Boîte" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110">
                </div>
                <div class="flex-grow">
                    <a href="med-history.html?id=${id}" class="font-bold text-white text-lg hover:text-blue-400 transition-colors flex items-center gap-2 group">
                        ${data.nom} <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1"></i>
                    </a>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                        <span class="text-sm font-mono text-white bg-blue-600/20 px-2 py-0.5 rounded border border-blue-500/30">Total : <strong>${qteTotale}</strong></span>
                        ${badgeHtml}
                    </div>
                    <div class="flex gap-1 mt-2 flex-wrap">
                        ${lotsHtml}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap mt-2 sm:mt-0">
                <button class="btn-give active:scale-95 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5" data-id="${id}">
                    <i class="fa-solid fa-hand-holding-medical pointer-events-none"></i> Donner
                </button>
                <button class="btn-restock active:scale-95 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5" data-id="${id}" data-nom="${data.nom}">
                    <i class="fa-solid fa-boxes-stacked pointer-events-none"></i> + Stock
                </button>
                <button onclick="deleteMed('${id}')" class="w-9 h-9 active:scale-90 bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 border border-slate-700 rounded-lg transition-all duration-200 ml-1" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        medListEl.appendChild(card);
    });

    document.querySelectorAll('.btn-give').forEach(button => {
        button.addEventListener('click', async (e) => {
            const medId = e.currentTarget.getAttribute('data-id');
            await openGiveModal({ medIds: [medId], beneficiary: "", quantity: 1, patientId: null });
        });
    });

    document.querySelectorAll('.btn-restock').forEach(button => {
        button.addEventListener('click', (e) => {
            currentMedId = e.currentTarget.getAttribute('data-id');
            document.getElementById('restock-med-name').textContent = e.currentTarget.getAttribute('data-nom');
            document.getElementById('restock-quantity').value = 1;
            document.getElementById('restock-exp').value = "";
            document.getElementById('restock-modal').classList.remove('hidden');
        });
    });
}

const giveModal = document.getElementById('give-med-modal');
function closeGiveModal() {
    giveModal.classList.add('hidden');
    currentPatientId = null;
}
document.getElementById('close-give-modal').addEventListener('click', closeGiveModal);
document.getElementById('cancel-give-btn').addEventListener('click', closeGiveModal);

document.getElementById('give-med-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const qtyToGive = parseInt(document.getElementById('give-quantity').value);
    const beneficiary = document.getElementById('give-beneficiary').value;
    const selectedExpDate = document.getElementById('give-lot-select').value;

    try {
        const medDoc = await getDoc(doc(db, "medicaments", currentMedId));
        let { lots, qteTotale } = extractLots(medDoc.data());

        let lotIndex = lots.findIndex(l => l.dateExpiration === selectedExpDate);
        if (lotIndex === -1 || lots[lotIndex].quantite < qtyToGive) {
            return alert("Erreur : Ce lot ne contient pas assez de boîtes !");
        }

        lots[lotIndex].quantite -= qtyToGive;
        qteTotale -= qtyToGive;
        if (lots[lotIndex].quantite === 0) lots.splice(lotIndex, 1);

        await updateDoc(doc(db, "medicaments", currentMedId), {
            lots: lots,
            quantiteTotale: qteTotale,
            quantite: qteTotale
        });

        await addDoc(collection(db, "historique_medicaments"), {
            medicamentId: currentMedId,
            type: "distribution",
            quantite: qtyToGive,
            beneficiaire: beneficiary,
            membreEmail: auth.currentUser ? auth.currentUser.email : "Inconnu",
            date: new Date()
        });

        if (currentPatientId) {
            await updateDoc(doc(db, "patients_prioritaires", currentPatientId), {
                dernierDon: new Date()
            });
        }

        alert(`Don de ${qtyToGive} boîte(s) à ${beneficiary} validé !`);
        closeGiveModal();
    } catch (error) {
        alert("Erreur : " + error.message);
    }
});

const restockModal = document.getElementById('restock-modal');
document.getElementById('close-restock-modal').addEventListener('click', () => restockModal.classList.add('hidden'));
document.getElementById('cancel-restock-btn').addEventListener('click', () => restockModal.classList.add('hidden'));

document.getElementById('restock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = parseInt(document.getElementById('restock-quantity').value);
    const expDate = document.getElementById('restock-exp').value;

    try {
        const medDoc = await getDoc(doc(db, "medicaments", currentMedId));
        let { lots, qteTotale } = extractLots(medDoc.data());

        let existingLot = lots.find(l => l.dateExpiration === expDate);
        if (existingLot) existingLot.quantite += qty;
        else lots.push({ quantite: qty, dateExpiration: expDate });

        qteTotale += qty;

        await updateDoc(doc(db, "medicaments", currentMedId), {
            lots: lots,
            quantiteTotale: qteTotale,
            quantite: qteTotale
        });

        await addDoc(collection(db, "historique_medicaments"), {
            medicamentId: currentMedId,
            type: "ajout_stock",
            quantite: qty,
            membreEmail: auth.currentUser ? auth.currentUser.email : "Inconnu",
            date: new Date()
        });

        alert(`Le stock a été mis à jour (+${qty} boîtes).`);
        restockModal.classList.add('hidden');
    } catch (error) {
        alert("Erreur : " + error.message);
    }
});

window.deleteMed = async function(id) {
    if (confirm("Supprimer intégralement ce médicament et tous ses lots ?")) {
        await deleteDoc(doc(db, "medicaments", id));
    }
};

// ==========================================
// GESTION DES PATIENTS PRIORITAIRES
// ==========================================
const patientModal = document.getElementById('patient-modal');
const patientForm = document.getElementById('patient-form');
const patientsListEl = document.getElementById('patients-list');

document.getElementById('btn-add-patient').addEventListener('click', () => {
    patientForm.reset();
    patientModal.classList.remove('hidden');
});

document.getElementById('close-patient-modal').addEventListener('click', () => patientModal.classList.add('hidden'));
document.getElementById('cancel-patient-btn').addEventListener('click', () => patientModal.classList.add('hidden'));

patientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nom = document.getElementById('patient-name').value.trim();
    const medicament = document.getElementById('patient-med').value.trim();
    const quantite = parseInt(document.getElementById('patient-qty').value);
    const type = document.getElementById('patient-duration').value;

    const submitBtn = patientForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';
    submitBtn.disabled = true;

    try {
        await addDoc(collection(db, "patients_prioritaires"), {
            nom,
            medicament,
            quantite,
            type,
            ajoutePar: auth.currentUser ? auth.currentUser.email : "Inconnu",
            dateAjout: new Date()
        });
        patientForm.reset();
        patientModal.classList.add('hidden');
    } catch (error) {
        alert("Erreur lors de l'enregistrement du patient : " + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

function renderPatients() {
    patientsListEl.innerHTML = "";

    if (allPatients.length === 0) {
        patientsListEl.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-500 animate-fade-in">
                <i class="fa-solid fa-heart-pulse text-4xl mb-3 opacity-50 text-rose-500/60"></i>
                <p>Aucun patient prioritaire enregistré pour le moment.</p>
            </div>
        `;
        return;
    }

    allPatients.forEach((item, index) => {
        const data = item.data;
        const id = item.id;
        const isUrgent = data.type && data.type.toLowerCase().includes('urgent');

        const searchKey = normalizeText(data.medicament);
        const matchingInStock = allMeds.filter(m => {
            const medNorm = normalizeText(m.data.nom);
            return searchKey && (medNorm.includes(searchKey) || searchKey.includes(medNorm)) && extractLots(m.data).qteTotale > 0;
        });
        const availableStock = matchingInStock.reduce((sum, m) => sum + extractLots(m.data).qteTotale, 0);

        const stockBadge = availableStock > 0
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-check"></i> En stock (${availableStock})</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-triangle-exclamation"></i> Rupture / Absent</span>`;

        const typeBadge = isUrgent
            ? `<span class="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><i class="fa-solid fa-bolt mr-1"></i>Urgent</span>`
            : `<span class="px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"><i class="fa-solid fa-repeat mr-1"></i>Chronique</span>`;

        const dernierDonHtml = data.dernierDon
            ? `<p class="text-[11px] text-emerald-400/90 mt-1"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Dernier don : ${data.dernierDon.toDate().toLocaleDateString('fr-FR')}</p>`
            : '';

        const givePatientBtnHtml = availableStock > 0
            ? `<button class="btn-give-patient active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5" data-patient-id="${id}">
                    <i class="fa-solid fa-hand-holding-medical pointer-events-none"></i> Donner
               </button>`
            : '';

        const card = document.createElement('div');
        card.className = "animate-slide-up bg-slate-900/50 p-5 rounded-2xl border border-slate-700/60 hover:border-rose-500/40 transition-all duration-300 flex flex-col justify-between gap-4 shadow-lg";
        card.style.animationDelay = `${index * 60}ms`;

        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center flex-shrink-0">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-white text-base leading-tight">${data.nom}</h3>
                            <div class="mt-1">${typeBadge}</div>
                        </div>
                    </div>
                    <button onclick="deletePatient('${id}')" class="w-8 h-8 active:scale-90 bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 border border-slate-700 rounded-lg transition-all flex items-center justify-center" title="Supprimer">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>

                <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 space-y-1.5">
                    <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Médicament requis</p>
                    <p class="text-white font-bold flex items-center gap-2">
                        <i class="fa-solid fa-pills text-rose-400"></i> ${data.medicament}
                    </p>
                    <p class="text-xs text-slate-300">Quantité : <strong class="text-white">${data.quantite} boîte(s) / mois</strong></p>
                    ${dernierDonHtml}
                </div>
            </div>

            <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 flex-wrap">
                ${stockBadge}
                <div class="flex items-center gap-2">
                    ${givePatientBtnHtml}
                    <button class="btn-find-med active:scale-95 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1" data-patient-id="${id}" title="Voir dans le stock">
                        <i class="fa-solid fa-magnifying-glass pointer-events-none"></i>
                    </button>
                </div>
            </div>
        `;
        patientsListEl.appendChild(card);
    });

    document.querySelectorAll('.btn-give-patient').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const patientId = e.currentTarget.getAttribute('data-patient-id');
            const patient = allPatients.find(p => p.id === patientId);
            if (!patient) return;

            const searchKey = normalizeText(patient.data.medicament);
            const matchingIds = allMeds
                .filter(m => {
                    const medNorm = normalizeText(m.data.nom);
                    return searchKey && (medNorm.includes(searchKey) || searchKey.includes(medNorm)) && extractLots(m.data).qteTotale > 0;
                })
                .map(m => m.id);

            await openGiveModal({
                medIds: matchingIds,
                beneficiary: patient.data.nom,
                quantity: parseInt(patient.data.quantite) || 1,
                patientId: patient.id
            });
        });
    });

    document.querySelectorAll('.btn-find-med').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const patientId = e.currentTarget.getAttribute('data-patient-id');
            const patient = allPatients.find(p => p.id === patientId);
            if (!patient) return;

            document.getElementById('search-med').value = patient.data.medicament;
            searchQuery = normalizeText(patient.data.medicament);
            currentFilter = "all";
            updateFilterUI(btnAll);
            renderMeds();
            switchTab('stock');
        });
    });
}

window.deletePatient = async function(id) {
    if (confirm("Supprimer ce patient de la liste prioritaire ?")) {
        await deleteDoc(doc(db, "patients_prioritaires", id));
    }
};

// ==========================================
// ÉCOUTE TEMPS RÉEL FIRESTORE
// ==========================================
onSnapshot(collection(db, "medicaments"), (snapshot) => {
    allMeds = [];
    snapshot.forEach((doc) => {
        allMeds.push({ id: doc.id, data: doc.data() });
    });
    renderMeds();
    renderPatients();
});

onSnapshot(collection(db, "patients_prioritaires"), (snapshot) => {
    allPatients = [];
    snapshot.forEach((doc) => {
        allPatients.push({ id: doc.id, data: doc.data() });
    });
    renderPatients();
});
