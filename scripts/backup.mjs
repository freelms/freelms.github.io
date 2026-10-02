// Manual Firestore backup helper: prints collections to back up.
// For real backups use: gcloud firestore export gs://BUCKET --project=PROJECT
// or Firebase console → Firestore → Import/Export.
console.log('Backup routine:');
console.log('1. gcloud firestore export gs://<bucket>/backups/$(date +%F) --project=<prod-project>');
console.log('2. Monthly: verify restore in dev project. See README.');
