export const SAMPLE_QUIZ_JSON = JSON.stringify(
  {
    title: 'Sample quiz',
    passingScore: 70,
    timeLimitMinutes: 10,
    shuffle: true,
    questions: [
      {
        question: 'What does HTML stand for?',
        options: [
          'Hyper Text Markup Language',
          'High Tech Modern Language',
          'Hyperlinks Text Mode Logic',
          'Home Tool Markup Language'
        ],
        answerIndex: 0,
        explanation: 'HTML = Hyper Text Markup Language.'
      }
    ]
  },
  null,
  2
);

export const SAMPLE_COURSE_JSON = JSON.stringify(
  {
    title: 'Intro to Web Dev',
    description: 'Learn the basics of building websites with HTML and CSS, from your first tag to a published page.',
    instructor: 'Jane Doe',
    thumbnail: '',
    level: 'Beginner',
    tags: ['web-development', 'html-css'],
    outcomes: ['Build a page', 'Understand HTML/CSS'],
    credits: [{ creator: 'Creator', channelUrl: 'https://youtube.com/@x', videoUrl: 'https://youtube.com/watch?v=xxxx' }],
    schedule: [{ day: 'Monday', time: '18:00', topic: 'HTML basics' }],
    lessons: [{ title: 'Lesson 1', youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', duration: '10:00' }],
    quizzes: [
      {
        title: 'Quiz 1',
        passingScore: 70,
        questions: [{ question: 'Q?', options: ['A', 'B'], answerIndex: 0, explanation: '' }]
      }
    ]
  },
  null,
  2
);

export const QUIZ_AI_PROMPT = `You create quiz JSON for my free online course platform. Follow these rules exactly.

OUTPUT: return ONLY valid JSON, no markdown fences, no commentary. It must validate against this schema:
{
  "title": "short quiz title",
  "passingScore": 70,
  "timeLimitMinutes": 10,
  "shuffle": true,
  "questions": [
    { "question": "clear question text", "options": ["correct answer", "plausible distractor", "plausible distractor", "plausible distractor"], "answerIndex": 0, "explanation": "one sentence: why the answer is right" }
  ]
}

QUESTION RULES:
- 8-12 questions covering the transcript evenly (beginning, middle, end — not all from the intro).
- Exactly 4 options per question, exactly one correct. Distractors must be plausible (common mistakes, related terms), never jokes or obviously-wrong fillers.
- Vary the position of the correct answer across questions (don't always use index 0).
- Mix recall ("What does X stand for?") with application ("Which formula totals A1:A5?").
- Every explanation is one sentence a beginner understands.
- No questions about the video itself ("In this video…", "The presenter says…") — test the subject.
- Set timeLimitMinutes to roughly 1 minute per 2 questions. passingScore stays 70 unless the topic is safety-critical.

MY AVAILABLE TAGS (use only these slugs nowhere in quiz JSON — quizzes don't take tags; listed so questions match my catalog vocabulary):
[none needed for quizzes]

NOW GENERATE from this video transcript. First line of your reply must be {. PASTE TRANSCRIPT BELOW:`;

export const COURSE_AI_PROMPT = `You create full course JSON for my free online course platform (FreeLMS). Follow these rules exactly.

OUTPUT: return ONLY valid JSON, no markdown fences, no commentary. Schema:
{
  "title": "course title, max 60 chars",
  "description": "2-4 sentences, 200+ characters, plain text, no timestamps, no 'subscribe/like/comment' lines",
  "instructor": "presenter name if known, else the channel name",
  "level": "one of Beginner, Intermediate, Advanced",
  "tags": ["tag-slugs from MY TAG LIST ONLY, max 4, most specific first"],
  "outcomes": ["4-8 concrete skills, each starting with a verb: Build…, Write…, Explain…"],
  "credits": [{ "creator": "channel name", "channelUrl": "https://youtube.com/@handle", "videoUrl": "full watch URL per lesson" }],
  "schedule": [{ "day": "Monday", "time": "18:00", "topic": "lesson topic" }],
  "lessons": [{ "title": "numbered like '#1 Intro to X' when order is known", "youtube": "the YouTube URL I give you", "duration": "mm:ss from the video" }],
  "quizzes": [{ "title": "Quiz 1: <topic>", "passingScore": 70, "questions": [{ "question": "…", "options": ["A","B","C","D"], "answerIndex": 0, "explanation": "one sentence" }] }]
}

RULES:
- lessons: one entry per video/URL I paste, in the order I paste them. Never invent video URLs or IDs — use exactly what I give you. Number titles #1, #2, … unless I provide titles.
- quizzes: one quiz per 3-5 lessons (or one per video if I ask), 5-8 questions each, exactly 4 options, exactly one correct answer, varied answer positions, one-sentence explanations, no "in this video…" questions.
- description: no timestamps like 00:35, no calls to action. outcomes must be concrete, not "Learn stuff".
- tags: pick ONLY from MY TAG LIST below. If none fits, use [] and I will create tags myself — never invent slugs.

MY TAG LIST (slug — display name):
[PASTE YOUR TAG LIST HERE, e.g. "python — Python", one per line]

PASTE YOUR VIDEO URLS (one per line, in course order), then TRANSCRIPTS below:`;
