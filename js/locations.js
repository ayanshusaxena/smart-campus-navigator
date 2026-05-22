// Campus locations configuration for Dr. B. R. Ambedkar Polytechnic College, Gwalior
// Tier 0 = college name overview pin (zoom 16-17)
// Tier 1 = major landmarks (zoom 18+): main gate, parking, sports ground, academic block, principal office, boys hostel, workshop
// Tier 2 = secondary (zoom 19+): library, canteen, computer lab, washrooms

const CAMPUS_LOCATIONS = [
  // ── TIER 1 (major landmarks, visible from zoom 18+) ─────────────────
  {
    id: 'main-gate',
    nameEn: 'Main Gate',
    nameHi: 'मुख्य प्रवेश द्वार',
    category: 'admin',
    visibleTiers: [1, 2, 3],
    lat: 26.1915,
    lng: 78.1745,
    floor: 'Ground',
    block: 'Entrance',
    description:
      'Primary entry gate to the campus from Jhansi Road, used by students, staff, and visitors.',
    photo: null,
  },
  {
    id: 'parking',
    nameEn: 'Parking Area',
    nameHi: 'पार्किंग क्षेत्र',
    category: 'parking',
    visibleTiers: [1, 2, 3],
    lat: 26.1913,
    lng: 78.1748,
    floor: 'Ground',
    block: 'Vehicle Zone',
    description:
      'Designated parking area for two-wheelers and four-wheelers of students, staff, and visitors.',
    photo: null,
  },
  {
    id: 'sports-ground',
    nameEn: 'Sports Ground',
    nameHi: 'खेल मैदान',
    category: 'sports',
    visibleTiers: [1, 2, 3],
    lat: 26.1919,
    lng: 78.1755,
    floor: 'Open',
    block: 'Playfield',
    description:
      'Open sports ground for cricket, football, and other outdoor activities, used for events and tournaments.',
    photo: null,
  },
  {
    id: 'academic-block',
    nameEn: 'Main Academic Block',
    nameHi: 'मुख्य शैक्षणिक भवन',
    category: 'academic',
    visibleTiers: [1, 2, 3],
    lat: 26.192300,
    lng: 78.174300,
    floor: 'G + 2',
    block: 'Central Block',
    description:
      'Central academic building housing classrooms, department offices, and lecture halls for multiple diploma programs.',
    photo: null,
  },

  // ── TIER 2 (secondary amenities, visible from zoom 19+) ─────────────
  {
    id: 'principal-office',
    nameEn: 'Principal Office',
    nameHi: 'प्राचार्य कार्यालय',
    category: 'admin',
    visibleTiers: [1, 2, 3],
    lat: 26.192300,
    lng: 78.174820,
    floor: 'First',
    block: 'Administrative Wing',
    description:
      'Office of the Principal and core administration for approvals, official meetings, and student administration.',
    photo: null,
  },
  {
    id: 'library',
    nameEn: 'Library',
    nameHi: 'पुस्तकालय',
    category: 'library',
    visibleTiers: [2, 3],
    lat: 26.192100,
    lng: 78.174390,
    floor: 'Ground',
    block: 'Knowledge Centre',
    description:
      'Central library with technical books, reference materials, and a quiet study area for students and faculty.',
    photo: null,
  },
  {
    id: 'canteen',
    nameEn: 'Canteen',
    nameHi: 'कैंटीन',
    category: 'canteen',
    visibleTiers: [2, 3],
    lat: 26.191950,
    lng: 78.174150,
    floor: 'Ground',
    block: 'Student Zone',
    description:
      'Campus canteen serving snacks, meals, and refreshments for students and staff during college hours.',
    photo: null,
  },
  {
    id: 'boys-hostel',
    nameEn: 'Boys Hostel',
    nameHi: 'लड़कों का छात्रावास',
    category: 'hostel',
    visibleTiers: [1, 2, 3],
    lat: 26.1928,
    lng: 78.1738,
    floor: 'G + 2',
    block: 'Residential Block',
    description:
      'On-campus residential facility for male students, providing accommodation and basic amenities.',
    photo: null,
  },
  {
    id: 'workshop',
    nameEn: 'Workshop',
    nameHi: 'वर्कशॉप',
    category: 'lab',
    visibleTiers: [1, 2, 3],
    lat: 26.192350,
    lng: 78.175400,
    floor: 'Ground',
    block: 'Practical Training Block',
    description:
      'Engineering workshop area equipped for hands-on practical sessions, machining, and fabrication work.',
    photo: null,
  },

  // ── TIER 2 continued ─────────────────────────────────────────────────
  {
    id: 'computer-lab',
    nameEn: 'Computer Lab',
    nameHi: 'कंप्यूटर प्रयोगशाला',
    category: 'lab',
    visibleTiers: [3],
    lat: 26.192250,
    lng: 78.174800,
    floor: 'First',
    block: 'Computer Science Wing',
    description:
      'Equipped with computers and internet for programming practice, software labs, and digital learning sessions.',
    photo: null,
  },
  {
    id: 'washrooms',
    nameEn: 'Washrooms',
    nameHi: 'शौचालय',
    category: 'washroom',
    visibleTiers: [3],
    lat: 26.192200,
    lng: 78.174650,
    floor: 'Ground',
    block: 'Common Area',
    description:
      'Common washroom facilities for students and staff across campus.',
    photo: null,
  },
];
