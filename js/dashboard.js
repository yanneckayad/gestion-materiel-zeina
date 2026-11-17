import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// --- Sécurité : Vérifie si l'utilisateur est bien connecté ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Si personne n'est connecté, on le renvoie à l'accueil
        window.location.href = "index.html";
    }
});

let allMateriel = [];
let currentFilter = "all";

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

const addItemForm = document.getElementById('add-item-form');
addItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('item-name').value;
    const ref = document.getElementById('item-ref').value;

    // Animation du bouton pendant l'envoi
    const submitBtn = addItemForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Ajout...';
    submitBtn.disabled = true;

    try {
        await addDoc(collection(db, "materiel"), { nom: name, reference: ref, statut: "Disponible", dateAjout: new Date() });
        addItemForm.reset();
    } catch (error) {
        alert("Erreur lors de l'ajout : " + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

const btnFilterAll = document.getElementById('filter-all');
const btnFilterAvailable = document.getElementById('filter-available');
const btnFilterLoaned = document.getElementById('filter-loaned');

function updateFilterUI(activeBtn) {
    [btnFilterAll, btnFilterAvailable, btnFilterLoaned].forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white', 'shadow-md');
        btn.classList.add('text-slate-400');
    });
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-700', 'text-white', 'shadow-md');
}

btnFilterAll.addEventListener('click', () => { currentFilter = "all"; updateFilterUI(btnFilterAll); renderInventory(); });
btnFilterAvailable.addEventListener('click', () => { currentFilter = "Disponible"; updateFilterUI(btnFilterAvailable); renderInventory(); });
btnFilterLoaned.addEventListener('click', () => { currentFilter = "En prêt"; updateFilterUI(btnFilterLoaned); renderInventory(); });

const inventoryList = document.getElementById('inventory-list');

function renderInventory() {
    inventoryList.innerHTML = "";
    const filteredList = allMateriel.filter(item => currentFilter === "all" || item.data.statut === currentFilter);

    if (filteredList.length === 0) {
        inventoryList.innerHTML = '<div class="text-center py-10 text-slate-500 animate-fade-in"><i class="fa-solid fa-box-open text-4xl mb-3 opacity-50"></i><p>Aucun matériel trouvé dans cette catégorie.</p></div>';
        return;
    }

    // On ajoute un petit délai (index) pour faire apparaître les lignes en cascade
    filteredList.forEach((item, index) => {
        const data = item.data;
        const itemId = item.id;
        const itemElement = document.createElement('div');

        // Classes de la carte (Hover effects et animation fade-in)
        itemElement.className = "animate-fade-in bg-slate-900/40 p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-slate-700/50 hover:border-slate-500 hover:bg-slate-800/60 shadow-lg hover:shadow-xl transition-all duration-300";
        itemElement.style.animationDelay = `${index * 0.05}s`; // Effet cascade

        let actionHtml = '';
        let statusBadge = '';

        if (data.statut === "Disponible") {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-circle-check"></i> Disponible</span>`;
            actionHtml = `<button class="btn-preter w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all" data-id="${itemId}" data-nom="${data.nom}"><i class="fa-solid fa-hand-holding-heart mr-2 pointer-events-none"></i>Prêter</button>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><i class="fa-solid fa-clock"></i> En prêt</span>`;
            actionHtml = `<button class="btn-restituer w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all" data-id="${itemId}" data-nom="${data.nom}"><i class="fa-solid fa-boxes-packing mr-2 pointer-events-none"></i>Restituer</button>`;
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
            <div class="flex items-center w-full sm:w-auto">
                ${actionHtml}
            </div>
        `;
        inventoryList.appendChild(itemElement);
    });

    document.querySelectorAll('.btn-preter').forEach(button => {
        button.addEventListener('click', (e) => {
            currentItemId = e.target.getAttribute('data-id');
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
}

onSnapshot(collection(db, "materiel"), (snapshot) => {
    allMateriel = [];
    snapshot.forEach((doc) => {
        allMateriel.push({ id: doc.id, data: doc.data() });
    });
    renderInventory();
});

// --- Gestion des Modales et Cases à cocher ---
const loanModal = document.getElementById('loan-modal');
const closeLoanBtn = document.getElementById('close-modal-btn');
const closeLoanIcon = document.getElementById('close-modal-icon-btn'); // Croix en haut
const loanForm = document.getElementById('loan-form');
const modalItemName = document.getElementById('modal-item-name');
const noPhotoLoan = document.getElementById('no-photo-loan');
const equipmentPhoto = document.getElementById('equipment-photo');

const returnModal = document.getElementById('return-modal');
const closeReturnBtn = document.getElementById('close-return-modal-btn');
const closeReturnIcon = document.getElementById('close-return-icon-btn'); // Croix en haut
const returnForm = document.getElementById('return-form');
const returnModalItemName = document.getElementById('return-modal-item-name');
const noPhotoReturn = document.getElementById('no-photo-return');
const returnPhoto = document.getElementById('return-photo');

let currentItemId = null;

function closeLoan() { loanModal.classList.add('hidden'); loanForm.reset(); equipmentPhoto.disabled = false; }
function closeReturn() { returnModal.classList.add('hidden'); returnForm.reset(); returnPhoto.disabled = false; }

closeLoanBtn.addEventListener('click', closeLoan);
closeLoanIcon.addEventListener('click', closeLoan);
closeReturnBtn.addEventListener('click', closeReturn);
closeReturnIcon.addEventListener('click', closeReturn);

noPhotoLoan.addEventListener('change', (e) => {
    equipmentPhoto.disabled = e.target.checked;
    if(e.target.checked) equipmentPhoto.value = "";
});
noPhotoReturn.addEventListener('change', (e) => {
    returnPhoto.disabled = e.target.checked;
    if(e.target.checked) returnPhoto.value = "";
});

loanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = equipmentPhoto.files[0];
    const isNoPhoto = noPhotoLoan.checked;

    if (!file && !isNoPhoto) return alert("Veuillez prendre une photo, ou cocher la case si c'est impossible.");

    const submitBtn = loanForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
    submitBtn.disabled = true;

    try {
        let imageUrl = "https://placehold.co/400x300/1e293b/94a3b8?text=Photo+non+disponible";

        if (file && !isNoPhoto) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "zeina_photos");
            const cloudinaryResponse = await fetch("https://api.cloudinary.com/v1_1/qljytaa3/image/upload", { method: "POST", body: formData });
            const cloudinaryData = await cloudinaryResponse.json();
            imageUrl = cloudinaryData.secure_url;
        }

        await addDoc(collection(db, "prets"), {
            materielId: currentItemId,
            dateDebutPret: document.getElementById('loan-date').value,
            membreNom: document.getElementById('member-name').value,
            patientPieceId: document.getElementById('patient-id').value,
            patientNom: document.getElementById('patient-name').value,
            patientTelephone: document.getElementById('patient-phone').value,
            patientDateNaissance: document.getElementById('patient-dob').value,
            duree: document.getElementById('loan-duration').value,
            photoSortie: imageUrl,
            datePret: new Date(),
            // CORRECTION ICI (déjà appliquée)
            membreEmail: auth.currentUser ? auth.currentUser.email : "Email introuvable"
        });

        await updateDoc(doc(db, "materiel", currentItemId), { statut: "En prêt" });
        closeLoan();
    } catch (error) {
        alert("Erreur lors du prêt : " + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

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
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "zeina_photos");
            const cloudinaryResponse = await fetch("https://api.cloudinary.com/v1_1/qljytaa3/image/upload", { method: "POST", body: formData });
            const cloudinaryData = await cloudinaryResponse.json();
            imageUrl = cloudinaryData.secure_url;
        }

        await addDoc(collection(db, "retours"), {
            materielId: currentItemId,
            photoRetour: imageUrl,
            dateRetour: new Date(),
            // CORRECTION ICI (ajoutée pour le retour)
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
