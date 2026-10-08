// The client's Study Abroad Mentor Registration Form, as data: the apply page draws these sections and the
// admin panel lists the answers under the same labels. They are stored together in the application's
// `details`. What the booking system needs (university, course, price, weekly hours, CV, proof) and what
// the account already knows (email, date of birth from the ID check, photo) have their own fields on the page.
//
// A field is [key, label, kind, options]: kind is text | area | select | many | yesno, and a label ending
// in * must be answered (the API checks the same keys: REQUIRED in api/mentor_applications.py).

const COUNTRIES = ['USA', 'UK', 'Canada', 'Australia', 'New Zealand', 'Germany', 'France', 'Ireland', 'Netherlands', 'Sweden',
  'Switzerland', 'Singapore', 'UAE', 'Italy', 'Spain', 'Other']
const STUDY_AREAS = ['Business & Management', 'Finance', 'Economics', 'Engineering', 'Computer Science / IT',
  'Artificial Intelligence / Data Science', 'Medicine / Healthcare', 'Law', 'Architecture', 'Design', 'Media & Communication',
  'Psychology', 'Social Sciences', 'Hospitality & Tourism', 'Biotechnology / Life Sciences', 'Environmental Sciences', 'Other']

// "What you help with" on the mentor profile: the client's key areas of expertise
export const KEY_AREAS = ['University Selection', 'Course / Programme Selection', 'Country Selection', 'Application Strategy',
  'SOP / Personal Statement', 'CV / Resume Guidance', 'Scholarship Guidance', 'Admission Interviews', 'Standardised Tests',
  'Visa Guidance', 'Financial Planning', 'Accommodation / Student Life', 'Pre-Departure Guidance', 'Career Planning',
  'Post-Study Opportunities', 'International Student Experience']

export const PERSONAL = [
  ['firstName', 'First name *', 'text'], ['middleName', 'Middle name', 'text'], ['lastName', 'Last name *', 'text'],
  ['preferredName', 'Preferred name', 'text'],
  ['gender', 'Gender', 'select', ['Male', 'Female', 'Prefer not to say', 'Other']],
  ['mobileCode', 'Country code *', 'text'], ['mobile', 'Mobile number *', 'text'],
  ['city', 'Current city *', 'text'], ['currentCountry', 'Current country *', 'text'],
  ['website', 'Professional or personal website', 'text'],
]
export const EDUCATION = [
  ['qualification', 'Highest educational qualification *', 'select',
    ['Diploma', "Bachelor's Degree", "Master's Degree", 'MBA', 'PhD / Doctorate', 'Professional Qualification', 'Other']],
  ['field', 'Field or specialisation *', 'text'],
  ['additionalQualifications', 'Additional qualifications or certifications', 'area'],
  ['studiedAbroad', 'Have you personally studied outside your home country? *', 'yesno'],
  ['abroadCountries', 'If yes: country or countries', 'text'], ['abroadInstitution', 'If yes: university or institution', 'text'],
  ['abroadProgramme', 'If yes: programme or degree', 'text'], ['abroadDuration', 'If yes: duration', 'text'],
]
export const PROFESSIONAL = [
  ['totalExperience', 'Total professional experience *', 'select', ['Less than 1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years']],
  ['employment', 'Current employment status *', 'select', ['Employed full-time', 'Employed part-time', 'Self-employed',
    'Entrepreneur / Business Owner', 'Freelancer / Consultant', 'Academic / Education Professional', 'Student', 'Currently not employed', 'Other']],
  ['organisation', 'Current organisation or company *', 'text'], ['jobTitle', 'Current job title *', 'text'],
  ['jobDescription', 'Your current role, responsibilities and areas of professional expertise *', 'area'],
  ['previousEmployers', 'Previous organisations, positions and how long you were there', 'area'],
]
export const EXPERTISE = [
  ['mentorCountries', 'Countries you can mentor students for *', 'many', COUNTRIES],
  ['studyAreas', 'Areas of study you can mentor *', 'many', STUDY_AREAS],
  ['expertise', 'Your expertise in helping students with international education *', 'area'],
]
export const MENTORING = [
  ['mentoredBefore', 'Have you previously mentored or guided students?', 'yesno'],
  ['mentoringExperience', 'If yes, describe your mentoring experience', 'area'],
  ['mentoredCount', 'Approximate number of students or individuals mentored', 'select', ['1–10', '11–25', '26–50', '51–100', '100+']],
  ['helpedInternational', 'Have you previously helped students with international education?', 'yesno'],
  ['helpedDescription', 'If yes, please describe', 'area'],
  ['mentoringPlatforms', 'Organisations or platforms where you have mentored', 'text'],
]
export const MOTIVATION = [
  ['whyMentor', 'Why do you want to become a mentor at The Youth Matters? *', 'area'],
  ['studentsLearn', 'What can students learn from you? *', 'area'],
  ['approach', 'How would you describe your approach when mentoring students? *', 'area'],
]
export const AVAILABILITY = [
  ['formats', 'Preferred mentoring format *', 'many',
    ['Video Call', 'Audio Call', 'Chat / Messaging', 'In-person', 'Workshops / Webinars', 'Group Sessions', 'Open to all formats']],
  ['availability', 'Availability *', 'many', ['Weekdays', 'Weekday Evenings', 'Weekends', 'Flexible']],
  ['hoursPerWeek', 'Approximate hours available per week', 'select', ['1–2 hours', '3–5 hours', '5–10 hours', '10+ hours']],
]
export const DECLARATION = [
  ['communication', 'I agree to receive communications from The Youth Matters about my application, onboarding, mentoring opportunities and platform updates', 'yesno'],
  ['confirmName', 'Full name, as your electronic signature *', 'text'],
]

export const CODE_OF_CONDUCT = [
  'Provide honest and responsible guidance based on my actual knowledge and experience.',
  'Clearly communicate the limits of my expertise.',
  'Avoid making guarantees regarding university admission, scholarships, visas or employment.',
  "Respect students' privacy and confidentiality.",
  'Not misuse student information.',
  'Not request unnecessary sensitive personal information from students.',
  'Not engage in harassment, discrimination or inappropriate behaviour.',
  'Not use my position as a mentor for misleading commercial purposes.',
  'Maintain professional boundaries with students.',
  "Follow The Youth Matters' Community Guidelines, Terms & Conditions and Help & Safety policies.",
]
// Each must be ticked before the application can be sent
export const AGREEMENTS = [
  'I agree to the Mentor Code of Conduct.',
  'I confirm that the information provided in this application is accurate and complete to the best of my knowledge. I understand that providing false, misleading or fraudulent information may result in rejection or termination of my mentor profile.',
  'I understand that The Youth Matters may contact me or verify information provided in my application, including my professional and educational background, where reasonably necessary.',
  'I acknowledge that the personal information submitted through this application will be processed for the purpose of evaluating, onboarding, managing and communicating with me as a potential or approved mentor, in accordance with The Youth Matters Privacy Policy.',
]

export const ALL_FIELDS = [...PERSONAL, ...EDUCATION, ...PROFESSIONAL, ...EXPERTISE, ...MENTORING, ...MOTIVATION, ...AVAILABILITY, ...DECLARATION]
export const required = ([, label]) => label.endsWith('*')
export const plain = (label) => label.replace(/ \*$/, '')
