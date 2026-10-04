export type CourseStatus = 'draft' | 'published' | 'archived';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Tag {
  id: string; // slug
  name: string;
  slug: string;
  description?: string;
  color?: string; // hex color
  icon?: string; // lucide icon name
  parentSlug?: string; // max one level nesting
  showInMenu?: boolean;
  menuOrder?: number;
  featured?: boolean;
  courseCount?: number; // published courses only
  seoTitle?: string;
  seoDescription?: string;
  slugHistory?: string[]; // previous slugs for redirects
  createdAt?: any;
  updatedAt?: any;
}

export interface CourseTag {
  slug: string;
  name: string;
  color?: string;
}

export interface Credit { creator: string; channelUrl?: string; videoUrl?: string; }
export interface ScheduleEntry { day: string; time: string; topic: string; link?: string; }
export interface ResourceLink { label: string; url: string; type?: string; }

export interface Course {
  id: string;
  title: string;
  description: string;
  topic?: string; // legacy, deprecated - use tagSlugs
  instructor: string;
  thumbnail?: string;
  outcomes?: string[];
  credits?: Credit[];
  schedule?: ScheduleEntry[];
  timezone?: string;
  status: CourseStatus;
  /** legacy flag — treated as published when status missing */
  published?: boolean;
  level?: Level;
  prerequisiteIds?: string[];
  lessonCount?: number;
  totalDuration?: string;
  enrollmentCount?: number;
  completionCount?: number;
  avgRating?: number;
  ratingCount?: number;
  tagSlugs?: string[]; // array of tag slugs, max 8
  tags?: CourseTag[]; // denormalized for rendering
  seoTitle?: string;
  seoDescription?: string;
  shareImage?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Lesson {
  id: string;
  title: string;
  videoId: string;
  duration?: string;
  order?: number;
  creator?: string;
  channelUrl?: string;
  videoUrl?: string;
  resources?: ResourceLink[];
  lastChecked?: any;
  broken?: boolean;
}

export interface QuizQuestion { question: string; options: string[]; answerIndex: number; explanation?: string; }
export interface Quiz {
  id: string;
  title: string;
  passingScore: number;
  questions: QuizQuestion[];
  lessonId?: string;
  timeLimitMinutes?: number;
  shuffle?: boolean;
  wrongCounts?: number[];
}

export interface Enrollment {
  courseId?: string;
  enrolledAt?: any;
  completedLessons: string[];
  progressPercent?: number;
  lastLessonId?: string;
  lastTime?: number;
  positions?: Record<string, number>;
  lastActiveAt?: any;
}

export interface QuizAttempt {
  id?: string;
  quizId: string;
  courseId: string;
  score: number;
  total: number;
  passed: boolean;
  answers: number[];
  missedOnly?: boolean;
  quizTitle?: string;
  courseTitle?: string;
  passingScore?: number;
  createdAt?: any;
}

export interface Note { id: string; content: string; updatedAt?: any; }
export interface Announcement { id: string; message: string; courseId?: string; expiresAt?: any; createdAt?: any; }
export interface Report { id: string; courseId?: string; lessonId?: string; reason: string; details: string; email: string; resolved?: boolean; createdAt?: any; }
export interface LearnPath { id: string; title: string; description: string; courseIds: string[]; }
export interface UserProfile { uid: string; name?: string; email?: string; photo?: string; status?: string; createdAt?: any; streakDays?: string[]; badges?: string[]; lastActiveAt?: any; }
export interface CourseComment { id: string; courseId: string; lessonId: string; uid: string; displayName?: string; text: string; createdAt?: any; reported?: boolean; hidden?: boolean; }

export interface Review {
  uid: string;
  displayName?: string;
  rating: number;
  text: string;
  createdAt?: any;
}