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

// ==========================================
// SYSTÈME DE MISE À JOUR FORCÉE
const APP_VERSION = "2.1";
if (localStorage.getItem("zeina_version") !== APP_VERSION) {
    if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    localStorage.setItem("zeina_version", APP_VERSION);
    signOut(auth).then(() => { window.location.replace("index.html"); });
}
// ==========================================

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

let allMeds = [];
let searchQuery = "";
let currentFilter = "all";
let currentMedId = null;
let currentMedLots = [];
let scannedBarcodeValue = "";

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

document.getElementById('search-med').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
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
    lots.sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));
    return { lots, qteTotale };
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
            searchQuery = medData.nom.toLowerCase();
            renderMeds();
            const qte = extractLots(medData).qteTotale;
            alert(`Médicament reconnu : "${medData.nom}" (Stock : ${qte} boîtes)`);
        } else {
            document.getElementById('scanned-code-display').textContent = `Code-barres scanné : ${code}`;
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
        const matchesSearch = item.data.nom.toLowerCase().includes(searchQuery);
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
        // NOUVEAU : Effet Cascade (animate-slide-up), Délai (animationDelay), et Survol (hover:-translate-y-1, hover:shadow-xl)
        card.className = "animate-slide-up bg-slate-900/40 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-700/50 hover:border-slate-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300";
        card.style.animationDelay = `${index * 60}ms`; // Décale l'apparition de chaque carte de 60ms

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
                <button class="btn-give active:scale-95 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5" data-id="${id}" data-nom="${data.nom}">
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

    // Réattachement des événements (le reste du code reste identique)
    document.querySelectorAll('.btn-give').forEach(button => {
        button.addEventListener('click', async (e) => {
            currentMedId = e.target.getAttribute('data-id');
            const nom = e.target.getAttribute('data-nom');

            const medDoc = await getDoc(doc(db, "medicaments", currentMedId));
            const { lots, qteTotale } = extractLots(medDoc.data());
            currentMedLots = lots;

            if (qteTotale === 0 || lots.length === 0) {
                return alert("Ce médicament est en rupture totale de stock.");
            }

            document.getElementById('give-med-name').textContent = nom;
            document.getElementById('give-med-stock-info').textContent = `Total disponible : ${qteTotale} boîte(s)`;
            document.getElementById('give-quantity').value = 1;
            document.getElementById('give-beneficiary').value = "";

            const lotSelect = document.getElementById('give-lot-select');
            lotSelect.innerHTML = "";
            lots.forEach((lot, index) => {
                const opt = document.createElement('option');
                opt.value = lot.dateExpiration;
                let text = `Lot Exp: ${lot.dateExpiration} (${lot.quantite} dispo)`;
                if(index === 0) text = "🔴 URGENT: " + text;
                opt.textContent = text;
                lotSelect.appendChild(opt);
            });

            document.getElementById('give-med-modal').classList.remove('hidden');
        });
    });

    document.querySelectorAll('.btn-restock').forEach(button => {
        button.addEventListener('click', (e) => {
            currentMedId = e.target.getAttribute('data-id');
            document.getElementById('restock-med-name').textContent = e.target.getAttribute('data-nom');
            document.getElementById('restock-quantity').value = 1;
            document.getElementById('restock-exp').value = "";
            document.getElementById('restock-modal').classList.remove('hidden');
        });
    });
}

const giveModal = document.getElementById('give-med-modal');
document.getElementById('close-give-modal').addEventListener('click', () => giveModal.classList.add('hidden'));
document.getElementById('cancel-give-btn').addEventListener('click', () => giveModal.classList.add('hidden'));

document.getElementById('give-med-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const qtyToGive = parseInt(document.getElementById('give-quantity').value);
    const beneficiary = document.getElementById('give-beneficiary').value;
    const selectedExpDate = document.getElementById('give-lot-select').value;

    try {
        const medDoc = await getDoc(doc(db, "medicaments", currentMedId));
        let { lots, qteTotale } = extractLots(medDoc.data());

        let lotIndex = lots.findIndex(l => l.dateExpiration === selectedExpDate);
        if (lotIndex === -1 || lots[lotIndex].quantite < qtyToGive) return alert("Erreur : Ce lot ne contient pas assez de boîtes !");

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

        alert(`Don de ${qtyToGive} boîte(s) validé !`);
        giveModal.classList.add('hidden');
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

onSnapshot(collection(db, "medicaments"), (snapshot) => {
    allMeds = [];
    snapshot.forEach((doc) => {
        allMeds.push({ id: doc.id, data: doc.data() });
    });
    renderMeds();
});
