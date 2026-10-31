// The public content source (content/site-content.mjs) is plain JavaScript; the app reads only its FAQ list.
declare module '*site-content.mjs' {
  export const faqs: { id: string; category: string; question: string; answer: string }[];
}
