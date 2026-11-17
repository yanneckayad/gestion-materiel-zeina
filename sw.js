// Ce Service Worker est le moteur de base pour rendre l'app installable (PWA)
self.addEventListener('install', (event) => {
    console.log('Service Worker : Installé');
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Permet à l'application de fonctionner normalement en ligne
});
