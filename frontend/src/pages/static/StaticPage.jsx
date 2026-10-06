import { useLocation } from 'react-router-dom'

// Footer pages. Final legal copy comes from the client; these are placeholders in the right structure.
const PAGES = {
  '/news': ['Latest news', 'Updates from the TYM team: new destinations, features and community events.', [
    'We are launching with the United Kingdom hub and will open more destinations as the community grows.',
  ]],
  '/careers': ['Work for us', 'We are a small team building a calmer way to prepare for studying abroad.', [
    'We do not have open roles right now. Send your CV and a short note to careers@theyouthmatters.org and we will keep you in mind.',
  ]],
  '/volunteer': ['Volunteer', 'Help moderate the community, welcome new members or run a country chatroom.', [
    'Volunteers are experienced members with a good standing record. Write to volunteer@theyouthmatters.org with the hub you would like to help with.',
  ]],
  '/queries': ['Queries and suggestions', 'Found a bug, missing a country, or have an idea that would make TYM better?', [
    'Write to hello@theyouthmatters.org. We read every message and reply to questions within two working days.',
  ]],
  '/guidelines': ['Community guidelines', 'How we keep TYM useful, kind and safe for everyone.', [
    'Answer from experience, say when you are unsure, and link official sources for visa or money rules.',
    'No harassment, hate, threats or personal attacks. Disagree with ideas, not people.',
    'Never post passport numbers, bank details or anyone else\'s private information.',
    'Offensive words are hidden automatically. Repeat behaviour leads to a warning, then a 24 hour mute, then suspension pending review.',
  ]],
  '/payment-terms': ['Payment terms', 'How paying for mentor sessions works.', [
    'Sessions are paid in advance through Razorpay by UPI, card or net banking. Prices are shown in INR.',
    'Cancel or reschedule up to 24 hours before a session for a full refund.',
    'An invoice is emailed automatically after every successful payment.',
  ]],
  '/help-safety': ['Help and safety', 'What to do if something goes wrong.', [
    'Use Report on any post, comment, message or profile. Our team reviews every report.',
    'Blocking hides someone\'s posts and messages from you and stops them contacting you.',
    'Never send money to anyone you met on TYM outside of mentor bookings.',
  ]],
  '/terms': ['Terms and conditions', 'The rules for using The Youth Matters.', [
    'You must be 18 or older to create an account.',
    'Do not post personal identity documents, abusive content or advertising.',
    'Mentor sessions are agreements between you and the mentor; TYM processes the payment.',
  ]],
  '/privacy': ['Privacy statement', 'What we collect, why, and how we protect it.', [
    'To confirm every member is 18 or over, we read the date of birth from a photo ID and match the face on it to a live selfie, on our own servers. The ID photo is deleted once you are verified; we keep the date of birth, not the document. A selfie is only kept if a person needs to review your check, and is then visible only to our verification team.',
    'We follow the Indian IT Act and GDPR principles. You can ask us to export or delete your data at any time.',
  ]],
  '/cookies': ['Cookie policy', 'The cookies we use and how to control them.', [
    'We use essential cookies to keep you logged in and to protect against abuse. We do not use advertising cookies.',
  ]],
}

export default function StaticPage() {
  const [title, intro, body] = PAGES[useLocation().pathname]
  return (
    <div className="container page narrow">
      <header className="page-head">
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <div className="card card-pad stack prose">
        {body.map((p) => <p key={p}>{p}</p>)}
      </div>
    </div>
  )
}

export const STATIC_PATHS = Object.keys(PAGES)
