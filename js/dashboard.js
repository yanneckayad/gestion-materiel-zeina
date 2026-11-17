import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let allMateriel = [];
let currentFilter = "all";
let searchQuery = "";
let currentItemId;
let currentItemRef;

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

const addItemForm = document.getElementById('add-item-form');
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
    } catch (error) {
        alert("Erreur lors de l'ajout : " + error.message);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

function enleverAccents(texte) {
    if (!texte) return "";
    return String(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

document.getElementById('search-bar').addEventListener('input', (e) => {
    searchQuery = enleverAccents(e.target.value);
    renderInventory();
});

const btnFilterAll = document.getElementById('filter-all');
const btnFilterAvailable = document.getElementById('filter-available');
const btnFilterLoaned = document.getElementById('filter-loaned');
const btnFilterRepair = document.getElementById('filter-repair');

function updateFilterUI(activeBtn) {
    [btnFilterAll, btnFilterAvailable, btnFilterLoaned, btnFilterRepair].forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white', 'shadow-md');
        btn.classList.add('text-slate-400');
    });
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-slate-700', 'text-white', 'shadow-md');
}

btnFilterAll.addEventListener('click', () => { currentFilter = "all"; updateFilterUI(btnFilterAll); renderInventory(); });
btnFilterAvailable.addEventListener('click', () => { currentFilter = "Disponible"; updateFilterUI(btnFilterAvailable); renderInventory(); });
btnFilterLoaned.addEventListener('click', () => { currentFilter = "En prêt"; updateFilterUI(btnFilterLoaned); renderInventory(); });
btnFilterRepair.addEventListener('click', () => { currentFilter = "En réparation"; updateFilterUI(btnFilterRepair); renderInventory(); });

const inventoryList = document.getElementById('inventory-list');

function renderInventory() {
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

// 🔥 LE "MOTEUR" FIREBASE QUI AVAIT DISPARU EST DE RETOUR ICI 🔥
onSnapshot(collection(db, "materiel"), (snapshot) => {
    allMateriel = [];
    snapshot.forEach((doc) => {
        allMateriel.push({ id: doc.id, data: doc.data() });
    });
    renderInventory();
});

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

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "zeina_photos");
    const response = await fetch("https://api.cloudinary.com/v1_1/qljytaa3/image/upload", { method: "POST", body: formData });
    const data = await response.json();
    return data.secure_url;
}

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
