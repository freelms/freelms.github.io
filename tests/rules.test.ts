import { describe, it, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
  it('allows public to read published courses and their lessons', async () => {
    const admin = env.authenticatedContext('admin1', { email: 'shariqq.com@gmail.com' });
    await assertSucceeds(setDoc(doc(admin.firestore(), 'courses/pub1'), { title: 'Free Course', status: 'published' }));
    await assertSucceeds(setDoc(doc(admin.firestore(), 'courses/pub1/lessons/l1'), { title: 'Intro', videoId: 'dQw4w9WgXcQ' }));
    const anon = env.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(anon.firestore(), 'courses/pub1')));
    await assertSucceeds(getDoc(doc(anon.firestore(), 'courses/pub1/lessons/l1')));
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
});
