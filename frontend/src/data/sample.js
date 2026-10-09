// Demo content shown until the Phase 2 API is wired in. Shapes match backend/app/api/serializers.py.

// Top of the hierarchy: Subject -> Country -> Chat Room / Discussion -> Mentors / Content.
// Only Study Abroad is live in Phase 1; the rest render as "coming soon".
export const subjects = [
  { slug: 'study-abroad', name: 'Study Abroad', description: 'Universities, visas, money and life in a new country.', isActive: true },
  { slug: 'career', name: 'Career', description: 'First jobs, internships and switching fields.', isActive: false },
  { slug: 'education', name: 'Education', description: 'Courses, exams and choosing what to study.', isActive: false },
  { slug: 'entrepreneurship', name: 'Entrepreneurship', description: 'Starting and running something of your own.', isActive: false },
  { slug: 'life', name: 'Life & Experiences', description: 'Everything else that comes with growing up.', isActive: false },
]

export const countries = [
  { slug: 'uk', name: 'United Kingdom', isoCode: 'GB', airport: 'LHR', members: 12480, description: 'Universities, visas, housing and life in the UK.', official: { label: 'Student visa on GOV.UK', url: 'https://www.gov.uk/student-visa' } },
  { slug: 'usa', name: 'United States', isoCode: 'US', airport: 'JFK', members: 9310, description: 'Applications, F-1 visas, funding and campus life.', official: { label: 'Student visas on travel.state.gov', url: 'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html' } },
  { slug: 'canada', name: 'Canada', isoCode: 'CA', airport: 'YYZ', members: 7105, description: 'Study permits, co-op programmes and PR pathways.', official: { label: 'Study permits on Canada.ca', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html' } },
  { slug: 'australia', name: 'Australia', isoCode: 'AU', airport: 'SYD', members: 4820, description: 'Subclass 500 visas, scholarships and part-time work.', official: { label: 'Student visa (subclass 500) on Home Affairs', url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' } },
  { slug: 'ireland', name: 'Ireland', isoCode: 'IE', airport: 'DUB', members: 2290, description: 'Stamp 2 visas, Dublin housing and graduate routes.', official: { label: 'Coming to study in Ireland on irishimmigration.ie', url: 'https://www.irishimmigration.ie/coming-to-study-in-ireland/' } },
  { slug: 'germany', name: 'Germany', isoCode: 'DE', airport: 'FRA', members: 3640, description: 'Tuition-free programmes, blocked accounts and APS.', official: { label: 'Study in Germany, the official DAAD guide', url: 'https://www.study-in-germany.de/en/' } },
]

export const categories = [
  { slug: 'visas', name: 'Visas' },
  { slug: 'scholarships', name: 'Scholarships' },
  { slug: 'accommodation', name: 'Accommodation' },
  { slug: 'sops', name: 'SOPs' },
  { slug: 'universities', name: 'Universities' },
  { slug: 'jobs', name: 'Part-time work' },
]

export const users = {
  aisha: { username: 'aisha.k', displayName: 'Aisha Khan', avatar: '/images/people/aisha.k.jpg', role: 'student', bio: 'MSc Marketing offer from Leeds. Sorting out my visa file.', targetCountry: 'uk', studyLevel: 'Postgraduate' },
  rohan: { username: 'rohan.m', displayName: 'Rohan Mehta', avatar: '/images/people/rohan.m.jpg', role: 'student', bio: 'Undergrad, CS. Manchester or Glasgow, still deciding.', targetCountry: 'uk', studyLevel: 'Undergraduate' },
  priya: { username: 'priya.s', displayName: 'Priya Sharma', avatar: '/images/people/priya.s.jpg', role: 'mentor', bio: 'Leeds MSc Data Science 2025. I review SOPs and visa files.', targetCountry: 'uk', studyLevel: 'Postgraduate' },
  daniel: { username: 'daniel.o', displayName: 'Daniel Okafor', avatar: '/images/people/daniel.o.jpg', role: 'mentor', bio: 'Toronto Metropolitan, co-op student.', targetCountry: 'canada', studyLevel: 'Undergraduate' },
  meera: { username: 'meera.n', displayName: 'Meera Nair', avatar: '/images/people/meera.n.jpg', role: 'student', bio: 'Applying for Fall intake in the US.', targetCountry: 'usa', studyLevel: 'Postgraduate' },
  kavya: { username: 'kavya.r', displayName: 'Kavya Reddy', avatar: '/images/people/kavya.r.jpg', role: 'student', bio: 'Accepted at Humber College for January. Waiting on my permit.', targetCountry: 'canada', studyLevel: 'Postgraduate' },
  ishaan: { username: 'ishaan.g', displayName: 'Ishaan Gupta', avatar: '/images/people/ishaan.g.jpg', role: 'student', bio: 'Master of IT offer from Monash. Filling in my visa application.', targetCountry: 'australia', studyLevel: 'Postgraduate' },
  neha: { username: 'neha.j', displayName: 'Neha Joshi', role: 'student', bio: 'Starting an MSc at Trinity College Dublin in September.', targetCountry: 'ireland', studyLevel: 'Postgraduate' },
  varun: { username: 'varun.p', displayName: 'Varun Pillai', role: 'student', bio: 'Applying to TU Munich and RWTH for the winter intake.', targetCountry: 'germany', studyLevel: 'Postgraduate' },
  tanvi: { username: 'tanvi.d', displayName: 'Tanvi Deshpande', role: 'student', bio: 'Admitted to RWTH Aachen for an MSc in Robotics.', targetCountry: 'germany', studyLevel: 'Postgraduate' },
  farhan: { username: 'farhan.a', displayName: 'Farhan Ali', role: 'student', bio: 'MS Computer Science offer from Arizona State.', targetCountry: 'usa', studyLevel: 'Postgraduate' },
  sneha: { username: 'sneha.k', displayName: 'Sneha Kulkarni', role: 'student', bio: 'Starting a Master of Public Health in Sydney.', targetCountry: 'australia', studyLevel: 'Postgraduate' },
  aditya: { username: 'aditya.v', displayName: 'Aditya Verma', avatar: '/images/people/aditya.v.jpg', role: 'student', bio: 'MSc Computer Science at Trinity. Moved to Dublin in 2025.', targetCountry: 'ireland', studyLevel: 'Postgraduate' },
  arjun: { username: 'arjun.r', displayName: 'Arjun Rao', avatar: '/images/people/arjun.r.jpg', role: 'mentor', bio: "LLM at King's College London.", targetCountry: 'uk', studyLevel: 'Postgraduate' },
  sara: { username: 'sara.t', displayName: 'Sara Thomas', avatar: '/images/people/sara.t.jpg', role: 'mentor', bio: 'MS Information Systems at Northeastern.', targetCountry: 'usa', studyLevel: 'Postgraduate' },
  kabir: { username: 'kabir.s', displayName: 'Kabir Singh', avatar: '/images/people/kabir.s.jpg', role: 'mentor', bio: 'MSc Mechanical Engineering at TU Munich.', targetCountry: 'germany', studyLevel: 'Postgraduate' },
  hannah: { username: 'hannah.l', displayName: 'Hannah Lee', avatar: '/images/people/hannah.l.jpg', role: 'mentor', bio: 'Master of Teaching at the University of Melbourne.', targetCountry: 'australia', studyLevel: 'Postgraduate' },
  admin: { username: 'tym.team', displayName: 'TYM Team', role: 'admin' },
  tymai: { username: 'tymai', displayName: 'TYMAi', role: 'bot' },
}

const h = (hours) => new Date(Date.now() - hours * 3600_000).toISOString()

export const posts = [
  {
    id: 101, country: 'uk', category: 'visas', author: users.aisha, score: 42, commentCount: 3, createdAt: h(5),
    title: 'How much money do I need to show for a UK student visa outside London?',
    body: 'My course is in Leeds and starts in September. Do I need to show nine months of living costs on top of the remaining tuition, and how long does the money have to sit in my account before I apply? My father is the sponsor, so it is in his account.',
  },
  {
    id: 102, country: 'uk', category: 'accommodation', author: users.rohan, score: 18, commentCount: 6, createdAt: h(20),
    title: 'Private halls or a shared house for first year in Manchester?',
    body: 'Budget is around 650 GBP a month including bills. Halls feel easier for making friends but a house near Fallowfield is cheaper. What would you pick if you were starting again?',
  },
  {
    id: 103, country: 'usa', category: 'scholarships', author: users.meera, score: 27, commentCount: 4, createdAt: h(9), isPinned: false,
    title: 'Did anyone get a graduate assistantship after admission, not with the offer?',
    body: 'My offer from a state school has no funding. Seniors say you can find GA roles once you are on campus. How realistic is that in the first semester?',
  },
  {
    id: 104, country: 'canada', category: 'jobs', author: users.daniel, score: 15, commentCount: 2, createdAt: h(30),
    title: 'Working 24 hours a week off campus: what the new rule means in practice',
    body: 'A short write-up of how my co-op and part-time hours fit together this term, and what to check with your DSO before you take a second job.',
  },
  {
    id: 105, country: 'uk', category: 'sops', author: users.rohan, score: 9, commentCount: 0, createdAt: h(2),
    title: 'Is it fine to mention a gap year spent preparing for exams in my personal statement?',
    body: 'I took a year to prepare for JEE and it did not work out. I would rather be honest about it. Will UCAS readers see it as a weakness?',
  },
  {
    id: 106, country: 'germany', category: 'universities', author: users.varun, score: 21, commentCount: 5, createdAt: h(40),
    title: 'APS certificate timeline from India in 2026, how long did yours take?',
    body: 'Planning for the winter intake. Trying to work out whether to book the APS interview before or after my final semester results.',
  },
  {
    id: 107, country: 'ireland', category: 'accommodation', author: users.neha, score: 12, commentCount: 3, createdAt: h(14),
    title: 'Realistic rent for a room in Dublin within 40 minutes of Trinity?',
    body: 'Listings swing between 700 and 1,400 EUR. Where are students actually living?',
  },
  {
    id: 108, country: 'canada', category: 'visas', author: users.kavya, score: 24, commentCount: 2, createdAt: h(11),
    title: 'How long did your Canadian study permit take to come through this year?',
    body: 'Applied online six weeks ago for the January intake. Biometrics done. Is it normal to hear nothing at this point?',
  },
  {
    id: 109, country: 'australia', category: 'visas', author: users.ishaan, score: 19, commentCount: 2, createdAt: h(26),
    title: 'Has the GTE statement really been replaced by the Genuine Student questions?',
    body: 'Older blogs still talk about a 300 word GTE statement. My application form shows separate questions instead. Which one is right?',
  },
  {
    id: 110, country: 'germany', category: 'visas', author: users.varun, score: 14, commentCount: 3, createdAt: h(28),
    title: 'Blocked account provider: Expatrio, Fintiba or Coracle, does it matter?',
    body: 'All three seem to be accepted by the embassy. Is there any real difference in fees or in how fast the confirmation letter comes?',
  },
  {
    id: 111, country: 'germany', category: 'jobs', author: users.tanvi, score: 11, commentCount: 2, createdAt: h(50),
    title: 'How many hours can students really work in Germany, and do Werkstudent jobs count differently?',
    body: 'I keep reading different numbers of full days and half days per year, and that working student jobs follow other rules. Can someone who has done it explain how it works in practice?',
  },
  {
    id: 112, country: 'usa', category: 'visas', author: users.farhan, score: 33, commentCount: 7, createdAt: h(16),
    title: 'F-1 interview in Mumbai next week, what did they actually ask you?',
    body: 'I am prepared for funding and why this university, but nervous about questions on my plans after graduation. What came up in yours?',
  },
  {
    id: 113, country: 'usa', category: 'accommodation', author: users.meera, score: 8, commentCount: 1, createdAt: h(60),
    title: 'Is on-campus housing worth it for the first semester?',
    body: 'Off-campus is about 300 USD a month cheaper near my university, but I have no credit history and no car.',
  },
  {
    id: 114, country: 'ireland', category: 'jobs', author: users.aditya, score: 16, commentCount: 4, createdAt: h(30),
    title: 'How long did it take you to find part-time work in Dublin?',
    body: 'Arriving in September with retail experience from back home. Is it realistic to find something in the first month?',
  },
  {
    id: 115, country: 'ireland', category: 'visas', author: users.neha, score: 9, commentCount: 2, createdAt: h(70),
    title: 'Do I need my IRP appointment booked before I land?',
    body: 'The portal shows no slots for weeks. Is it a problem if my first appointment is after my course starts?',
  },
  {
    id: 116, country: 'australia', category: 'accommodation', author: users.sneha, score: 13, commentCount: 3, createdAt: h(18),
    title: 'Rooms near UNSW for under 400 AUD a week, realistic?',
    body: 'Looking at Kensington and Kingsford, but most listings are well above my budget. Where do students actually find rooms?',
  },
  {
    id: 117, country: 'australia', category: 'jobs', author: users.ishaan, score: 10, commentCount: 2, createdAt: h(44),
    title: 'Is the fortnightly work-hours limit counted strictly during exam weeks?',
    body: 'My course starts in February and I have a part-time offer. I want to understand the rule properly before I say yes.',
  },
  {
    id: 118, country: 'canada', category: 'accommodation', author: users.kavya, score: 12, commentCount: 3, createdAt: h(36),
    title: 'Best way to find a room in Toronto before arriving?',
    body: 'I am wary of paying a deposit to someone I have never met. How did you find your first place?',
  },
]

export const comments = {
  103: [
    { id: 11, parentId: null, author: users.sara, score: 22, createdAt: h(7),
      body: 'It happens, but plan as if it will not. I found mine in week three by emailing labs and the library directly, not through the job portal. Most roles are filled before term starts, so write to your graduate coordinator now and ask what is still open. The tuition waiver that comes with it matters more than the stipend.' },
  ],
  106: [
    { id: 21, parentId: null, author: users.kabir, score: 17, createdAt: h(37),
      body: 'Mine took about seven weeks from submitting documents to getting the certificate, and waiting for the interview slot was the slow part. I applied with transcripts up to my last completed semester instead of waiting for final results. Carry every original to the interview, they checked each page.' },
  ],
  107: [
    { id: 31, parentId: null, author: users.aditya, score: 14, createdAt: h(13),
      body: 'Most of my class lives in Phibsborough, Rathmines or Drumcondra and pays 850 to 1,100 EUR for a room. Anything under 700 near the centre is usually a scam, so never pay a deposit before you have seen the room in person. Daft.ie and the college accommodation board were the only places that worked for me.' },
  ],
  108: [
    { id: 41, parentId: null, author: users.daniel, score: 20, createdAt: h(9),
      body: 'Six weeks with no news is normal, mine came through in just under eight. The biometrics appointment is usually the slow part and you are past it. Most refusals in our group were a missing provincial attestation letter or thin proof of funds, so check both are in your upload while you wait.' },
  ],
  109: [
    { id: 51, parentId: null, author: users.hannah, score: 16, createdAt: h(24.5),
      body: 'Yes, the single statement is gone. You now answer a few Genuine Student questions inside the application: why this course, why this provider, and how it fits what you have done so far. Keep each answer specific and in your own words. Templates copied from blogs are easy to spot.' },
  ],
  101: [
    { id: 1, parentId: null, author: users.priya, score: 31, createdAt: h(4),
      body: 'Outside London it is 1,171 GBP per month for up to nine months, so 10,539 GBP, plus whatever tuition you still owe after your deposit. The full amount has to be held for 28 consecutive days, and the statement must be dated within 31 days of your application. A parent account is fine, but include a letter of consent and your birth certificate.' },
    { id: 2, parentId: 1, author: users.aisha, score: 4, createdAt: h(3.5),
      body: 'That clears it up. Does the 28 day period have to end exactly on the day I apply?' },
    { id: 3, parentId: 2, author: users.priya, score: 6, createdAt: h(3),
      body: 'It has to end no more than 31 days before you submit. Most people apply a few days after the 28 days are complete.' },
    { id: 4, parentId: null, author: users.tymai, score: 3, createdAt: h(1),
      body: 'Summary for anyone landing here later: 10,539 GBP living costs for courses outside London, held 28 days, statement no older than 31 days. Check the latest figures on gov.uk before you apply.' },
  ],
}

export const mentors = [
  { id: 1, subject: 'study-abroad', user: users.priya, country: 'uk', university: 'University of Leeds', course: 'MSc Data Science', headline: 'I help with SOPs, CAS and visa files.', experience: 'Moved from Hyderabad to Leeds in 2024. Data analyst intern at a Leeds fintech.', price: 1499, sessionMinutes: 30, sessions: 86, rating: 4.9 },
  { id: 2, subject: 'study-abroad', user: users.arjun, country: 'uk', university: "King's College London", course: 'LLM International Law', headline: 'London living costs, part-time work and law applications.', experience: 'Two years in London. Works part-time at a legal aid clinic.', price: 1799, sessionMinutes: 30, sessions: 54, rating: 4.8 },
  { id: 3, subject: 'study-abroad', user: users.daniel, country: 'canada', university: 'Toronto Metropolitan University', course: 'BEng Computer Engineering', headline: 'Co-op search, study permits and first-month setup.', experience: 'Third-year co-op student. Has helped 40 students settle in Toronto.', price: 1299, sessionMinutes: 30, sessions: 41, rating: 4.7 },
  { id: 4, subject: 'study-abroad', user: users.sara, country: 'usa', university: 'Northeastern University', course: 'MS Information Systems', headline: 'Shortlisting, funding and F-1 interview prep.', experience: 'Got into 4 of 6 US programmes with a partial scholarship.', price: 1999, sessionMinutes: 45, sessions: 112, rating: 4.9 },
  { id: 5, subject: 'study-abroad', user: users.kabir, country: 'germany', university: 'TU Munich', course: 'MSc Mechanical Engineering', headline: 'APS, blocked accounts and finding a WG room.', experience: 'Cleared APS in 2025. Working student at an automotive supplier.', price: 1199, sessionMinutes: 30, sessions: 29, rating: 4.8 },
  { id: 6, subject: 'study-abroad', user: users.hannah, country: 'australia', university: 'University of Melbourne', course: 'Master of Teaching', headline: 'GTE statements and Subclass 500 checklists.', experience: 'Former school teacher, now training in Melbourne.', price: 1399, sessionMinutes: 30, sessions: 37, rating: 4.6 },
]

export const rooms = [
  { slug: 'study-abroad', name: 'Study Abroad', description: 'Open room for every destination.', online: 184 },
  { slug: 'uk', name: 'United Kingdom', description: 'Visas, CAS, housing and life in the UK.', online: 96 },
  { slug: 'usa', name: 'United States', description: 'Applications, F-1 and funding.', online: 61 },
  { slug: 'canada', name: 'Canada', description: 'Permits, co-op and PR pathways.', online: 38 },
]

export const roomMessages = [
  { id: 1, author: users.rohan, body: 'Anyone else waiting on a CAS from Manchester? Paid my deposit 9 days ago.', createdAt: h(0.4) },
  { id: 2, author: users.aisha, body: 'Mine took 12 working days from Leeds. They emailed a pre-CAS checklist first.', createdAt: h(0.35) },
  { id: 3, author: users.rohan, body: '@TYMAi how long does a CAS usually take after the deposit?', createdAt: h(0.3) },
  { id: 4, author: users.tymai, body: 'Usually 1 to 3 weeks after the deposit and documents are cleared. If it has been longer than 15 working days, email the international admissions team with your student ID.', createdAt: h(0.3) },
  { id: 5, author: users.meera, body: 'Is anyone here going to Boston in January?', createdAt: h(0.1) },
]

export const notifications = [
  { id: 1, kind: 'answer', actor: users.priya, text: 'answered your question', target: 'How much money do I need to show for a UK student visa...', postId: 101, createdAt: h(4), unread: true },
  { id: 2, kind: 'upvote', actor: null, text: '12 people upvoted your question', target: 'How much money do I need to show for a UK student visa...', postId: 101, createdAt: h(3), unread: true },
  { id: 3, kind: 'reply', actor: users.priya, text: 'replied to your comment', target: 'It has to end no more than 31 days before you submit...', postId: 101, createdAt: h(3), unread: false },
  { id: 4, kind: 'followed_post', actor: users.rohan, text: 'posted in United Kingdom', target: 'Private halls or a shared house for first year in Manchester?', postId: 102, createdAt: h(20), unread: false },
]

export const faqs = [
  ['What is TYM?', 'The Youth Matters (TYM) is a community where young people talk to each other about studying abroad: free chat rooms, questions and answers, Ask TYM AI and one-to-one sessions with mentors.'],
  ['How do I sign up?', 'Choose Sign up on this website and create an account with your email address or Google. We send a code to confirm your email, then ask for a photo ID once to confirm your age.'],
  ['Is TYM free to use?', 'Yes. Asking questions, answering, the community hubs, the Study Abroad chatroom and Ask TYM AI are free. Only one-to-one sessions with TYM Mentors are paid: you buy counselling hours and spend them with any mentor.'],
  ['How do counselling hours work?', 'Every mentor costs the same. You buy a package of counselling hours once, and each session you book takes its length from your hours: a 30 minute session uses half an hour. Hours work with any TYM mentor and do not expire.'],
  ['Why do you ask for a photo ID?', 'The community is for adults only, so every member must be 18 or older. We read the date of birth from your passport, driving licence or national ID on our own servers. The photo is never stored: we keep the date of birth, not the document.'],
  ['Who are TYM Mentors?', 'Current students and recent graduates of universities abroad. Each one is verified by our team before they can take bookings.'],
  ['What is TYMAi?', 'Our study abroad assistant. It joins a chat room when you type @TYMAi, and answers privately in Ask TYM AI, where you can also ask for a person from our team. It can be wrong, so check official sources for visa rules.'],
  ['Can I share photos and files?', 'You can add photos to your questions and to your profile. The chat rooms are text only.'],
  ['How do I manage my notifications?', 'The bell at the top of the page shows new answers and updates. Open it to read them and mark them as read.'],
  ['How do I report a user?', 'Use Report on any question or answer. Our team reviews every report. Offensive words are hidden automatically, and repeat behaviour leads to a warning, then a 24 hour mute, then suspension.'],
  ['Can I cancel a mentor session?', 'You can cancel up to 24 hours before the session. The time goes straight back on your counselling hours, to book another time.'],
  ['Is my data secure on TYM?', 'We take your privacy and security seriously. Your connection to TYM is encrypted, passwords are never stored in readable form, and your photo ID is not kept. See our Privacy Policy and Terms for the details.'],
  ['Can I use TYM on more than one device?', 'Yes. Sign in with the same account on each device and your questions, chats and sessions are there.'],
  ['What if I forget my password?', 'Choose Forgot password on the sign-in page and follow the instructions sent to your registered email address.'],
  ['How do I delete my account?', 'Write to support@theyouthmatters.com from your registered email address and we will delete your account and your data.'],
  ['Who can I contact for support, or to give feedback?', 'Ask for a person in Ask TYM AI, use the Contact us page, or write to support@theyouthmatters.com. We welcome suggestions.'],
]

export const caseStudies = [
  { name: 'Aisha Khan', route: 'Hyderabad to Leeds', course: 'MSc Marketing', quote: 'I had my visa financials wrong by two months. One answer here saved my application.' },
  { name: 'Rohan Mehta', route: 'Pune to Manchester', course: 'BSc Computer Science', quote: 'The UK chatroom found me three flatmates before I had even booked my flight.' },
  { name: 'Meera Nair', route: 'Kochi to Boston', course: 'MS Information Systems', quote: 'A 30 minute mentor session reshaped my shortlist and my SOP.' },
]

export const countryBySlug = Object.fromEntries(countries.map((c) => [c.slug, c]))
export const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]))
