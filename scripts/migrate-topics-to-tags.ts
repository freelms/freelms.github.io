import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, getDoc, writeBatch } from 'firebase/firestore';

// This script converts existing course topics into tags
// Run with: npx ts-node scripts/migrate-topics-to-tags.ts

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error('Firebase config not found. Set environment variables from .env');
  process.exit(1);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function migrateTopics() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log('Fetching all courses...');
  const coursesSnap = await getDocs(collection(db, 'courses'));
  console.log(`Found ${coursesSnap.size} courses`);

  // Collect unique topics
  const topicMap = new Map<string, { name: string; count: number }>();
  const courseTagMap = new Map<string, string[]>(); // courseId -> tag slugs

  for (const doc of coursesSnap.docs) {
    const course = doc.data() as any;
    const topic = course.topic;
    if (topic) {
      const slug = slugify(topic);
      const existing = topicMap.get(slug);
      if (existing) {
        existing.count++;
      } else {
        topicMap.set(slug, { name: course.topic, count: 1 });
      }
      const tags = course.tagSlugs || [];
      if (!tags.includes(slug)) {
        courseTagMap.set(doc.id, [...tags, slug]);
      } else {
        courseTagMap.set(doc.id, tags);
      }
    }
  }

  console.log(`Found ${topicMap.size} unique topics`);

  // Create or update tag documents
  const batch = writeBatch(db);
  let tagCount = 0;

  for (const [slug, data] of topicMap) {
    const tagRef = doc(db, 'tags', slug);
    const tagDoc = await getDoc(tagRef);
    if (!tagDoc.exists()) {
      batch.set(tagRef, {
        name: data.name,
        slug,
        description: '',
        color: '#4f46e5',
        icon: 'book-open',
        parentSlug: '',
        showInMenu: true,
        featured: false,
        courseCount: data.count,
        seoTitle: '',
        seoDescription: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      tagCount++;
    } else {
      // Update course count
      batch.update(tagRef, { courseCount: data.count, updatedAt: new Date() });
    }
  }

  if (batch.commit) {
    await batch.commit();
    console.log(`Created/updated ${tagCount} tag documents`);
  }

  // Update courses with tagSlugs
  const courseBatch = writeBatch(db);
  let updatedCourses = 0;
  for (const [courseId, tagSlugs] of courseTagMap) {
    const courseRef = doc(db, 'courses', courseId);
    const courseDoc = await getDoc(courseRef);
    if (courseDoc.exists()) {
      const courseData = courseDoc.data() as any;
      const existingTags = courseData.tagSlugs || [];
      const mergedTags = [...new Set([...existingTags, ...tagSlugs])];
      if (JSON.stringify(mergedTags) !== JSON.stringify(existingTags)) {
        batch.update(courseRef, { tagSlugs: mergedTags, updatedAt: new Date() });
        updatedCourses++;
      }
    }

    if (updatedCourses > 0) {
      await batch.commit();
      console.log(`Updated ${updatedCourses} courses with tagSlugs`);
    }

    console.log('Migration complete!');
    process.exit(0);
  }
}

migrateTopics().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});