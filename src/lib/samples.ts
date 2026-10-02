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
    description: 'Learn the basics.',
    topic: 'Web Development',
    instructor: 'Jane Doe',
    thumbnail: '',
    level: 'Beginner',
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

export const QUIZ_AI_PROMPT = `Generate quiz JSON for my course video transcript. Return ONLY valid JSON matching this schema: {"title": string, "passingScore": 70, "timeLimitMinutes": optional number, "shuffle": true, "questions": [{"question": string, "options": [4 strings], "answerIndex": 0-3, "explanation": string}]}. 5-10 questions, one correct answer each. PASTE TRANSCRIPT BELOW:`;

export const COURSE_AI_PROMPT = `Generate a full course JSON for my training platform. Return ONLY valid JSON: {"title","description","topic","instructor","level":"Beginner|Intermediate|Advanced","outcomes":[string],"credits":[{"creator","channelUrl","videoUrl"}],"schedule":[{"day","time","topic"}],"lessons":[{"title","youtube":"YouTube URL or ID","duration":"mm:ss"}],"quizzes":[{"title","passingScore":70,"questions":[{"question","options":[4],"answerIndex":0,"explanation"}]}]}. COURSE DESCRIPTION BELOW:`;
