import type { FAQItem } from '@/data/faq';

export const SCREENSHOT_TOOL_FAQ: FAQItem[] = [
  {
    question: 'Is this screenshot tool really free?',
    answer:
      'Yes. You can capture your screen or upload an image and download a PNG locally without creating a Nucleas account. Signing up is optional and unlocks saving screenshots to projects, tasks, and your asset library.',
  },
  {
    question: 'Do you upload my screenshots to your servers?',
    answer:
      'Not when you use the free download flow. Captures are processed in your browser and saved to your device. Nothing is uploaded unless you sign in to Nucleas and choose to save a screenshot to your workspace.',
  },
  {
    question: 'Which browsers support screen capture?',
    answer:
      'Modern Chromium browsers (Chrome, Edge, Brave) and Firefox support the screen capture APIs this tool uses. Safari support varies by version. If capture is unavailable, you can still upload an image file and download a renamed PNG.',
  },
  {
    question: 'What is the difference between full window and area selection?',
    answer:
      'Full window capture saves everything visible in the tab or window you share in the browser picker. Area selection lets you drag a rectangle over the shared content so you only keep the region you need — ideal for UI details, bug reports, and cropped social images.',
  },
  {
    question: 'What file format do I get?',
    answer:
      'Downloads are PNG images, which preserve sharp text and UI elements. You name the file before downloading so it is easy to organize on your computer.',
  },
  {
    question: 'Why use Nucleas instead of a browser extension?',
    answer:
      'Extensions require installation, permissions, and often sync to third-party servers. Nucleas runs in the browser with no install for the free tool, keeps downloads local, and — when you sign up — links captures directly to projects and tasks so your team finds them in context.',
  },
  {
    question: 'Can I save screenshots to my projects?',
    answer:
      'Yes, with a Nucleas account. Workspace screenshots attach to projects, tasks, and content items so bug reports, design reviews, and documentation stay where your team is already working.',
  },
];
