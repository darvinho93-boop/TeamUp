/**
 * Ce qu'une touche de la régie fait au chrono de la salle : le lancer pour une durée,
 * l'arrêter, ou n'y rien changer. Le départ est posé par la base, seule horloge qui fait foi.
 */
export type Chrono = 'garder' | 'arreter' | { demarrer: number };
