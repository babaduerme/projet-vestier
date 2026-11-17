/** Construit la requête de vêtements adaptée au filtre actif. */
export function buildClothesQuery(collectionRef, category, pageSize, firestore) {
  const constraints = category === "tous"
    ? [firestore.limit(pageSize)]
    : [firestore.where("category", "==", category)];
  return firestore.query(collectionRef, ...constraints);
}
