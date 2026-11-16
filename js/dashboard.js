import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
    try {
        await addDoc(collection(db, "materiel"), { nom: name, reference: ref, statut: "Disponible", dateAjout: new Date() });
        addItemForm.reset();
    } catch (error) {
        alert("Erreur lors de l'ajout : " + error.message);
    }
});

const btnFilterAll = document.getElementById('filter-all');
const btnFilterAvailable = document.getElementById('filter-available');
const btnFilterLoaned = document.getElementById('filter-loaned');

function updateFilterUI(activeBtn) {
    [btnFilterAll, btnFilterAvailable, btnFilterLoaned].forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white', 'shadow');
        btn.classList.add('text-slate-400');
    });
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-700', 'text-white', 'shadow');
}

btnFilterAll.addEventListener('click', () => { currentFilter = "all"; updateFilterUI(btnFilterAll); renderInventory(); });
btnFilterAvailable.addEventListener('click', () => { currentFilter = "Disponible"; updateFilterUI(btnFilterAvailable); renderInventory(); });
btnFilterLoaned.addEventListener('click', () => { currentFilter = "En prêt"; updateFilterUI(btnFilterLoaned); renderInventory(); });

const inventoryList = document.getElementById('inventory-list');

function renderInventory() {
    inventoryList.innerHTML = "";
    const filteredList = allMateriel.filter(item => currentFilter === "all" || item.data.statut === currentFilter);

    if (filteredList.length === 0) {
        inventoryList.innerHTML = '<p class="text-slate-400 text-sm">Aucun matériel ne correspond à ce filtre.</p>';
        return;
    }

    filteredList.forEach((item) => {
        const data = item.data;
        const itemId = item.id;
        const itemElement = document.createElement('div');
        itemElement.className = "bg-slate-700 p-4 rounded-lg flex justify-between items-center border border-slate-600";

        let actionHtml = '';
        let statusBadge = '';
        if (data.statut === "Disponible") {
            statusBadge = `<span class="px-3 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400">Disponible</span>`;
            actionHtml = `<button class="btn-preter bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg ml-4 transition" data-id="${itemId}" data-nom="${data.nom}">Prêter</button>`;
        } else {
            statusBadge = `<span class="px-3 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-400">En prêt</span>`;
            actionHtml = `<button class="btn-restituer bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2 rounded-lg ml-4 transition" data-id="${itemId}" data-nom="${data.nom}">Restituer</button>`;
        }

        itemElement.innerHTML = `
            <div class="flex-1">
                <a href="history.html?id=${itemId}" class="font-bold text-white hover:text-blue-400 underline decoration-slate-600 transition">${data.nom}</a>
                <p class="text-sm text-slate-400">Réf: ${data.reference}</p>
            </div>
            <div class="flex items-center">
                ${statusBadge}
                ${actionHtml}
            </div>
        `;
        inventoryList.appendChild(itemElement);
    });

    document.querySelectorAll('.btn-preter').forEach(button => {
        button.addEventListener('click', (e) => {
            currentItemId = e.target.getAttribute('data-id');
            modalItemName.textContent = "Prêt : " + e.target.getAttribute('data-nom');
            document.getElementById('loan-date').valueAsDate = new Date();
            loanModal.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.btn-restituer').forEach(button => {
        button.addEventListener('click', (e) => {
            currentItemId = e.target.getAttribute('data-id');
            returnModalItemName.textContent = "Retour : " + e.target.getAttribute('data-nom');
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
const loanForm = document.getElementById('loan-form');
const modalItemName = document.getElementById('modal-item-name');
const noPhotoLoan = document.getElementById('no-photo-loan');
const equipmentPhoto = document.getElementById('equipment-photo');

const returnModal = document.getElementById('return-modal');
const closeReturnBtn = document.getElementById('close-return-modal-btn');
const returnForm = document.getElementById('return-form');
const returnModalItemName = document.getElementById('return-modal-item-name');
const noPhotoReturn = document.getElementById('no-photo-return');
const returnPhoto = document.getElementById('return-photo');

let currentItemId = null;

closeLoanBtn.addEventListener('click', () => { loanModal.classList.add('hidden'); loanForm.reset(); equipmentPhoto.disabled = false; });
closeReturnBtn.addEventListener('click', () => { returnModal.classList.add('hidden'); returnForm.reset(); returnPhoto.disabled = false; });

// Désactive le champ photo si la case est cochée
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

    if (!file && !isNoPhoto) {
        return alert("Veuillez prendre une photo, ou cocher la case si c'est impossible.");
    }

    const submitBtn = loanForm.querySelector('button[type="submit"]');
    submitBtn.textContent = "Envoi en cours...";
    submitBtn.disabled = true;

    try {
        let imageUrl = "https://placehold.co/400x300/1e293b/94a3b8?text=Photo+non+disponible"; // Image par défaut

        if (file && !isNoPhoto) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "zeina_photos");
            // ⚠️ REMPLACE TON_CLOUD_NAME
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
            membreEmail: auth.currentUser.email
        });

        await updateDoc(doc(db, "materiel", currentItemId), { statut: "En prêt" });
        loanModal.classList.add('hidden');
        loanForm.reset();
        equipmentPhoto.disabled = false;
    } catch (error) {
        alert("Erreur lors du prêt : " + error.message);
    } finally {
        submitBtn.textContent = "Valider le prêt";
        submitBtn.disabled = false;
    }
});

returnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = returnPhoto.files[0];
    const isNoPhoto = noPhotoReturn.checked;

    if (!file && !isNoPhoto) {
        return alert("Veuillez prendre une photo, ou cocher la case si c'est impossible.");
    }

    const submitBtn = returnForm.querySelector('button[type="submit"]');
    submitBtn.textContent = "Envoi en cours...";
    submitBtn.disabled = true;

    try {
        let imageUrl = "https://placehold.co/400x300/1e293b/94a3b8?text=Photo+non+disponible";

        if (file && !isNoPhoto) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "zeina_photos");
            // ⚠️ REMPLACE TON_CLOUD_NAME
            const cloudinaryResponse = await fetch("https://api.cloudinary.com/v1_1/qljytaa3/image/upload", { method: "POST", body: formData });
            const cloudinaryData = await cloudinaryResponse.json();
            imageUrl = cloudinaryData.secure_url;
        }

        await addDoc(collection(db, "retours"), {
            materielId: currentItemId,
            photoRetour: imageUrl,
            dateRetour: new Date(),
            membreEmail: auth.currentUser.email
        });

        await updateDoc(doc(db, "materiel", currentItemId), { statut: "Disponible" });

        returnModal.classList.add('hidden');
        returnForm.reset();
        returnPhoto.disabled = false;
    } catch (error) {
        alert("Erreur lors du retour : " + error.message);
    } finally {
        submitBtn.textContent = "Valider le retour";
        submitBtn.disabled = false;
    }
});
