import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let searchQuery = "";
let currentFilter = "all";
let currentMedId = null;
let currentMedMaxStock = 0;

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

document.getElementById('search-med').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderMeds();
});

const btnAll = document.getElementById('filter-all');
const btnStock = document.getElementById('filter-stock');
const btnRupture = document.getElementById('filter-rupture');

function updateFilterUI(activeBtn) {
    [btnAll, btnStock, btnRupture].forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white', 'shadow-md');
        btn.classList.add('text-slate-400');
    });
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-700', 'text-white', 'shadow-md');
}

btnAll.addEventListener('click', () => { currentFilter = "all"; updateFilterUI(btnAll); renderMeds(); });
btnStock.addEventListener('click', () => { currentFilter = "stock"; updateFilterUI(btnStock); renderMeds(); });
btnRupture.addEventListener('click', () => { currentFilter = "rupture"; updateFilterUI(btnRupture); renderMeds(); });

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "zeina_photos");
    const response = await fetch("https://api.cloudinary.com/v1_1/qljytaa3/image/upload", { method: "POST", body: formData });
    const data = await response.json();
    return data.secure_url;
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
            quantite: stock,
            dateExpiration: expDate,
            photo: imageUrl,
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

const medListEl = document.getElementById('med-list');

function renderMeds() {
    medListEl.innerHTML = "";

    const filtered = allMeds.filter(item => {
        const matchesSearch = item.data.nom.toLowerCase().includes(searchQuery);
        const isRupture = item.data.quantite === 0;

        if (currentFilter === "stock" && isRupture) return false;
        if (currentFilter === "rupture" && !isRupture) return false;

        return matchesSearch;
    });

    if (filtered.length === 0) {
        medListEl.innerHTML = '<div class="text-center py-10 text-slate-500"><i class="fa-solid fa-pills text-4xl mb-3 opacity-50"></i><p>Aucun médicament trouvé.</p></div>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered.forEach((item) => {
        const data = item.data;
        const id = item.id;

        const expDate = new Date(data.dateExpiration);
        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let badgeHtml = '';
        if (data.quantite === 0) {
            badgeHtml = `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-circle-xmark mr-1"></i> Rupture de stock</span>`;
        } else if (diffDays < 0) {
            badgeHtml = `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Périmé !</span>`;
        } else if (diffDays <= 90) {
            badgeHtml = `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><i class="fa-solid fa-clock mr-1"></i>Expire (${diffDays}j)</span>`;
        } else {
            badgeHtml = `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-circle-check mr-1"></i> En stock</span>`;
        }

        const card = document.createElement('div');
        card.className = "bg-slate-900/40 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-700/50 hover:border-slate-500 transition-all";
        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                    <img src="${data.photo}" alt="Boîte" class="w-full h-full object-cover">
                </div>
                <div>
                    <a href="med-history.html?id=${id}" class="font-bold text-white text-lg hover:text-blue-400 transition-colors flex items-center gap-2 group">
                        ${data.nom} <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </a>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                        <span class="text-sm font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Stock : <strong>${data.quantite}</strong> boîtes</span>
                        ${badgeHtml}
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                <button class="btn-give bg-emerald-600/25 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5" data-id="${id}" data-nom="${data.nom}" data-stock="${data.quantite}">
                    <i class="fa-solid fa-hand-holding-medical pointer-events-none"></i> Donner
                </button>
                
                <button class="btn-restock bg-blue-600/25 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5" data-id="${id}" data-nom="${data.nom}">
                    <i class="fa-solid fa-boxes-stacked pointer-events-none"></i> + Stock
                </button>

                <button onclick="deleteMed('${id}')" class="w-9 h-9 bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 border border-slate-700 rounded-lg transition-all ml-1" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        medListEl.appendChild(card);
    });

    document.querySelectorAll('.btn-give').forEach(button => {
        button.addEventListener('click', (e) => {
            currentMedId = e.target.getAttribute('data-id');
            currentMedMaxStock = parseInt(e.target.getAttribute('data-stock'));
            document.getElementById('give-med-name').textContent = e.target.getAttribute('data-nom');
            document.getElementById('give-med-stock-info').textContent = `Stock disponible : ${currentMedMaxStock} boîte(s)`;
            document.getElementById('give-quantity').value = 1;
            document.getElementById('give-beneficiary').value = "";
            document.getElementById('give-med-modal').classList.remove('hidden');
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

    if (qtyToGive > currentMedMaxStock) {
        return alert("Erreur : Pas assez de stock disponible !");
    }

    try {
        const newStock = currentMedMaxStock - qtyToGive;
        await updateDoc(doc(db, "medicaments", currentMedId), { quantite: newStock });

        await addDoc(collection(db, "historique_medicaments"), {
            medicamentId: currentMedId,
            type: "distribution",
            quantite: qtyToGive,
            beneficiaire: beneficiary,
            membreEmail: auth.currentUser ? auth.currentUser.email : "Inconnu",
            date: new Date()
        });

        alert(`Don de ${qtyToGive} boîte(s) enregistré avec succès !`);
        giveModal.classList.add('hidden');
    } catch (error) {
        alert("Erreur : " + error.message);
    }
});

// Gestion du clic sur le bouton + Stock (quantité personnalisée)
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-restock')) {
        const id = e.target.getAttribute('data-id');
        const nom = e.target.getAttribute('data-nom');

        const saisie = prompt(`Combien de boîtes de "${nom}" souhaitez-vous ajouter au stock ?`, "30");
        if (!saisie) return;

        const qtéAjoutee = parseInt(saisie);
        if (isNaN(qtéAjoutee) || qtéAjoutee <= 0) {
            alert("Veuillez entrer un nombre valide.");
            return;
        }

        try {
            const medDoc = await getDoc(doc(db, "medicaments", id));
            if (medDoc.exists()) {
                const stockActuel = medDoc.data().quantite;
                const nouveauStock = stockActuel + qtéAjoutee;

                await updateDoc(doc(db, "medicaments", id), { quantite: nouveauStock });

                await addDoc(collection(db, "historique_medicaments"), {
                    medicamentId: id,
                    type: "ajout_stock",
                    quantite: qtéAjoutee,
                    membreEmail: auth.currentUser ? auth.currentUser.email : "Inconnu",
                    date: new Date()
                });

                alert(`Succès ! +${qtéAjoutee} boîtes ajoutées à ${nom}.`);
            }
        } catch (error) {
            alert("Erreur lors de la mise à jour du stock : " + error.message);
        }
    }
});

window.deleteMed = async function(id) {
    if (confirm("Supprimer ce médicament ?")) {
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
