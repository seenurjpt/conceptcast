/**
 * Shown on the landing page and emitted as FAQPage structured data from the
 * same array, so the two can never disagree (search engines check that the
 * marked-up answers are visible on the page).
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is conceptcast free?',
    a: 'The app itself does not charge you. Research and writing run on your own AI key, so you pay your provider for the model calls. Google Gemini offers a free API key with no card, so the whole loop can cost nothing.',
  },
  {
    q: 'Which AI providers does it work with?',
    a: 'Anthropic, OpenAI and Google Gemini. Add any one of them in Settings and it gets used. Add more than one and the app falls through to the next if a key fails.',
  },
  {
    q: 'Does it post to LinkedIn on its own?',
    a: 'No. Nothing runs on a schedule and nothing is published without your click. Every draft waits for you to read, edit, approve or reject it.',
  },
  {
    q: 'Where do the facts in a post come from?',
    a: 'Each subtopic is researched on the web against primary sources such as official docs, papers and source code. Every fact carries its source URL, unsourced claims are dropped, and a critic rejects drafts that state anything the research does not support.',
  },
  {
    q: 'What can I write about?',
    a: 'Any technical subject you are learning: system design, databases, Kubernetes, networking, AI engineering and more. Name a topic and it suggests about ten subtopics, or you add your own.',
  },
  {
    q: 'Will the posts sound like me?',
    a: 'Paste a handful of your own LinkedIn posts once. The app extracts a style guide from them, and the writer copies your rhythm and structure without copying your content.',
  },
];
