import { describe, it, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'node:fs';

let env: any;

beforeEach(async () => {
  env = await initializeTestEnvironment({
    projectId: 'learnhub-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
  });
  await env.clearFirestore();
});

describe('rules', () => {
  it('blocks unauthenticated course reads', async () => {
    const ctx = env.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), 'courses', 'c1')));
  });
  it('blocks students from others data', async () => {
    const alice = env.authenticatedContext('alice');
    const bob = env.authenticatedContext('bob');
    await assertSucceeds(setDoc(doc(alice.firestore(), 'users/alice/enrollments/c1'), { completedLessons: [] }));
    await assertFails(getDoc(doc(bob.firestore(), 'users/alice/enrollments/c1')));
  });
  it('blocks non-admin course writes', async () => {
    const alice = env.authenticatedContext('alice');
    await assertFails(setDoc(doc(alice.firestore(), 'courses', 'c1'), { title: 'x' }));
  });
  it('blocks non-enrolled users from lessons and quizzes', async () => {
    const alice = env.authenticatedContext('alice');
    await assertFails(getDoc(doc(alice.firestore(), 'courses/c1/lessons/l1')));
    await assertFails(getDoc(doc(alice.firestore(), 'courses/c1/quizzes/q1')));
  });
  it('allows admins to write courses', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'courses', 'c1'), { title: 'x', status: 'draft' }));
  });
  it('allows public to read published course docs, but not lessons', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'courses/pub1'), { title: 'Free Course', status: 'published' }));
    await assertSucceeds(setDoc(doc(admin.firestore(), 'courses/pub1/lessons/l1'), { title: 'Intro', videoId: 'dQw4w9WgXcQ' }));
    const anon = env.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(anon.firestore(), 'courses/pub1')));
    await assertFails(getDoc(doc(anon.firestore(), 'courses/pub1/lessons/l1')));
  });
  it('blocks public from draft courses', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'courses/draft1'), { title: 'Draft', status: 'draft' }));
    const anon = env.unauthenticatedContext();
    await assertFails(getDoc(doc(anon.firestore(), 'courses/draft1')));
  });
  it('blocks non-admins from writing paths/announcements', async () => {
    const alice = env.authenticatedContext('alice');
    await assertFails(setDoc(doc(alice.firestore(), 'paths', 'p1'), { title: 'x' }));
    await assertFails(setDoc(doc(alice.firestore(), 'announcements', 'a1'), { message: 'hi' }));
  });

  // Tag rules tests
  it('allows anyone to read tags', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'tags/t1'), { name: 'Test', slug: 't1', color: '#4f46e5' }));
    const anon = env.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(anon.firestore(), 'tags/t1')));
  });
  it('blocks non-admins from creating tags', async () => {
    const alice = env.authenticatedContext('alice');
    await assertFails(setDoc(doc(alice.firestore(), 'tags/t2'), { name: 'Test2', slug: 't2', color: '#4f46e5' }));
  });
  it('allows admins to create tags', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'tags/t3'), { name: 'Test3', slug: 't3', color: '#4f46e5' }));
  });
  it('blocks non-admins from updating tags', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'tags/t4'), { name: 'Test4', slug: 't4', color: '#4f46e5' }));
    const alice = env.authenticatedContext('alice');
    await assertFails(updateDoc(doc(alice.firestore(), 'tags/t4'), { name: 'Test4 Updated' }));
  });
  it('blocks non-admins from deleting tags', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'tags/t5'), { name: 'Test5', slug: 't5', color: '#4f46e5' }));
    const alice = env.authenticatedContext('alice');
    await assertFails(deleteDoc(doc(alice.firestore(), 'tags/t5')));
  });
  it('allows admins to update and delete tags', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'tags/t6'), { name: 'Test6', slug: 't6', color: '#4f46e5' }));
    await assertSucceeds(updateDoc(doc(admin.firestore(), 'tags/t6'), { name: 'Test6 Updated' }));
    await assertSucceeds(deleteDoc(doc(admin.firestore(), 'tags/t6')));
  });

  it('pageviews: anyone appends valid shapes, only admins read, never update', async () => {    const anon = env.unauthenticatedContext();
    const alice = env.authenticatedContext('alice');
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(anon.firestore(), 'pageviews/v1'), { path: '/', courseId: null, uid: null, ts: new Date() }));
    await assertSucceeds(setDoc(doc(alice.firestore(), 'pageviews/v2'), { path: '/course/c1', courseId: 'c1', uid: 'alice', ts: new Date() }));
    await assertFails(setDoc(doc(anon.firestore(), 'pageviews/v3'), { path: '/', evil: 1, ts: new Date() }));
    await assertFails(setDoc(doc(anon.firestore(), 'pageviews/v4'), { path: 'x'.repeat(500), ts: new Date() }));
    await assertFails(getDoc(doc(alice.firestore(), 'pageviews/v1')));
    await assertSucceeds(getDoc(doc(admin.firestore(), 'pageviews/v1')));
  });

  it('reviews: public read, enrolled write own, strangers blocked', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'courses/c9'), { title: 'C', status: 'published' }));
    const alice = env.authenticatedContext('alice');
    const bob = env.authenticatedContext('bob');
    await assertSucceeds(setDoc(doc(alice.firestore(), 'users/alice/enrollments/c9'), { completedLessons: [] }));
    await assertSucceeds(setDoc(doc(alice.firestore(), 'courses/c9/reviews/alice'), { uid: 'alice', rating: 5, text: 'Great' }));
    await assertFails(setDoc(doc(bob.firestore(), 'courses/c9/reviews/bob'), { uid: 'bob', rating: 4, text: 'Ok' }));
    await assertFails(setDoc(doc(alice.firestore(), 'courses/c9/reviews/alice'), { uid: 'alice', rating: 9, text: 'Bad rating' }));
    const anon = env.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(anon.firestore(), 'courses/c9/reviews/alice')));
  });

  it('config: admin-only read/write', async () => {
    const alice = env.authenticatedContext('alice');
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertFails(getDoc(doc(alice.firestore(), 'config/deploy')));
    await assertFails(setDoc(doc(alice.firestore(), 'config/deploy'), { githubToken: 'x' }));
    await assertSucceeds(setDoc(doc(admin.firestore(), 'config/deploy'), { githubToken: 'x' }));
    await assertSucceeds(getDoc(doc(admin.firestore(), 'config/deploy')));
  });
});
