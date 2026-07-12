// Bump whenever GUEST_SHELVES or the server's curated guest book list changes shape/content —
// guests with an older version cached in localStorage get reseeded instead of stuck on stale data.
export const GUEST_DATA_VERSION = '2026-releases-v9-static-metadata';

// Shared mock location data for guest sessions (2 rooms, 5 shelves total).
export const GUEST_SHELVES = [
  { id: 'guest-shelf-1', room: 'Living Room', bookshelf: 'Tall Shelf' },
  { id: 'guest-shelf-2', room: 'Living Room', bookshelf: 'Window Nook' },
  { id: 'guest-shelf-3', room: 'Living Room', bookshelf: 'Reading Corner' },
  { id: 'guest-shelf-4', room: 'Bedroom', bookshelf: 'Bedside Table' },
  { id: 'guest-shelf-5', room: 'Bedroom', bookshelf: 'Headboard Shelf' },
];

export interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  description?: string | null;
  cover_url?: string | null;
  location?: {
    room: string;
    bookshelf: string;
  } | null;
  genres?: string[];
  status?: 'Completed' | 'Reading' | 'To Read';
  notes?: string | null;
  favorite?: boolean;
}

// Hardcoded static guest catalog metadata. This removes all dependency on runtime
// Google Books API calls on the server/client for guests, making guest mode
// resilient to API limits and network issues.
export const GUEST_BOOKS: Book[] = [
  {
    "id": "WPlrEQAAQBAJ",
    "title": "Yesteryear",
    "authors": [
      "Caro Claire Burke"
    ],
    "isbn": "9781039057937",
    "publisher": "Knopf Canada",
    "published_date": "2026-04-07",
    "description": "Natalie Heller Mills has built an empire livestreaming her perfect pioneer lifestyle — the rustic farmhouse, the handsome husband, the six delightful children — to eight million followers. Then she wakes up one morning in 1855, filthy and terrified, with no idea whether it's an elaborate hoax or something far more sinister.",
    "cover_url": "https://books.google.com/books/content?id=WPlrEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Tall Shelf"
    },
    "genres": [
      "Fiction / Humorous / Dark Humor",
      "Fiction / Feminist",
      "Fiction / Thrillers / Psychological"
    ],
    "status": "Completed",
    "notes": null,
    "favorite": true
  },
  {
    "id": "Dw5UEQAAQBAJ",
    "title": "My Husband's Wife",
    "authors": [
      "Alice Feeney"
    ],
    "isbn": "9781250337825",
    "publisher": "Flatiron Books",
    "published_date": "2026-01-20",
    "description": "Eden Fox returns from a run before her first gallery exhibition to find her house, her husband, and her whole life claimed by another woman who looks eerily like her. As the line between the two women blurs, buried secrets tied to the house and its previous owner start to surface.",
    "cover_url": "https://books.google.com/books/content?id=Dw5UEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Window Nook"
    },
    "genres": [
      "Fiction / Thrillers / Domestic",
      "Fiction / Thrillers / Psychological",
      "Fiction / Family Life / Marriage & Divorce"
    ],
    "status": "Reading",
    "notes": null,
    "favorite": false
  },
  {
    "id": "8yOGEQAAQBAJ",
    "title": "The Night We Met",
    "authors": [
      "Abby Jimenez"
    ],
    "isbn": "9780349442853",
    "publisher": "Little, Brown Book Group",
    "published_date": "2026-03-24",
    "description": "For Larissa, it all traces back to one split-second decision the night she met Chris. Years later, the two are co-parenting and slowly figuring out what they actually still mean to each other.",
    "cover_url": "https://books.google.com/books/content?id=8yOGEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Reading Corner"
    },
    "genres": [
      "Fiction / Romance / Contemporary"
    ],
    "status": "To Read",
    "notes": null,
    "favorite": false
  },
  {
    "id": "z-h9EQAAQBAJ",
    "title": "Our Perfect Storm",
    "authors": [
      "Carley Fortune"
    ],
    "isbn": "9781037800016",
    "publisher": "Penguin",
    "published_date": "2026-05-05",
    "description": "Best friends since childhood, Frankie and George have always orbited each other without quite landing. When Frankie's fiancé leaves her the morning after her wedding weekend, George convinces her to take the honeymoon anyway — with him.",
    "cover_url": "https://books.google.com/books/content?id=z-h9EQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Bedside Table"
    },
    "genres": [
      "Fiction / Romance / General",
      "Fiction / Women",
      "Fiction / Coming of Age"
    ],
    "status": "Completed",
    "notes": null,
    "favorite": true
  },
  {
    "id": "T9BMEQAAQBAJ",
    "title": "The Calamity Club",
    "authors": [
      "Kathryn Stockett"
    ],
    "isbn": "9781954118829",
    "publisher": "Spiegel & Grau LLC",
    "published_date": "2026-05-05",
    "description": "Oxford, Mississippi, 1933: eleven-year-old Meg has learned to rely on no one since her mother abandoned her at the orphanage. When her path crosses with two women running out of options of their own, the three hatch an audacious plan to take back what's rightfully theirs.",
    "cover_url": "https://books.google.com/books/content?id=T9BMEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Headboard Shelf"
    },
    "genres": [
      "Fiction / Southern",
      "Fiction / Historical / General",
      "Fiction / Literary",
      "Fiction / Women",
      "Fiction / Friendship",
      "Fiction / Historical / 20th Century / General"
    ],
    "status": "Reading",
    "notes": null,
    "favorite": false
  },
  {
    "id": "XsOBEQAAQBAJ",
    "title": "Half His Age",
    "authors": [
      "Jennette McCurdy"
    ],
    "isbn": "9780008617714",
    "publisher": "HarperCollins Publishers",
    "published_date": "2026-01-20",
    "description": "Waldo is a teenager who wants her creative writing teacher, Mr. Korgy — married, unremarkable, twice her age — more than she can explain or justify. A novel about desire, power, and the lengths people go to for the things they've convinced themselves they need.",
    "cover_url": "https://books.google.com/books/content?id=XsOBEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Tall Shelf"
    },
    "genres": [
      "Fiction / Coming of Age",
      "Fiction / Women",
      "Fiction / Humorous / Dark Humor",
      "Fiction / Literary",
      "Fiction / Family Life / Parenthood & Children",
      "Fiction / General",
      "Fiction / Erotica / General"
    ],
    "status": "To Read",
    "notes": null,
    "favorite": false
  },
  {
    "id": "vllyEQAAQBAJ",
    "title": "Anatomy of an Alibi",
    "authors": [
      "Ashley Elston"
    ],
    "isbn": "9798217294718",
    "publisher": "Random House",
    "published_date": "2026-01-13",
    "description": "Camille Bayliss has the picture-perfect life, except her husband tracks her every move and she can't prove what she suspects he's hiding. Aubrey Price has spent a decade haunted by a night she believes he knows more about than he admits — and the two women hatch a plan that intertwines their fates for good.",
    "cover_url": "https://books.google.com/books/content?id=vllyEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Window Nook"
    },
    "genres": [
      "Fiction / Thrillers / Suspense",
      "Fiction / Thrillers / Psychological",
      "Fiction / Women"
    ],
    "status": "Completed",
    "notes": null,
    "favorite": true
  },
  {
    "id": "0dNUEQAAQBAJ",
    "title": "In Her Own League",
    "authors": [
      "Liz Tomforde"
    ],
    "isbn": "9781399746458",
    "publisher": "Hodder & Stoughton",
    "published_date": "2026-03-03",
    "description": "As the first female team owner in Major League Baseball, Reese Remington has spent her life preparing to be taken seriously in a job everyone assumes she doesn't deserve. Her toughest test isn't the front office — it's the team's field manager, who questions her every call and gets under her skin in ways she didn't plan for.",
    "cover_url": "https://books.google.com/books/content?id=0dNUEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Reading Corner"
    },
    "genres": [
      "Fiction / Romance / Contemporary",
      "Fiction / Romance / Romantic Comedy",
      "Fiction / Romance / New Adult",
      "Fiction / Romance / Sports",
      "Fiction / Romance / Workplace",
      "Fiction / Romance / General"
    ],
    "status": "Reading",
    "notes": null,
    "favorite": false
  },
  {
    "id": "y6WHEQAAQBAJ",
    "title": "Land",
    "authors": [
      "Maggie O'Farrell"
    ],
    "isbn": "9781039058903",
    "publisher": "Knopf Canada",
    "published_date": "2026-06-02",
    "description": "Ireland, 1865: Tomás and his son Liam are mapping the country for the Ordnance Survey in the long shadow of the Great Hunger, Tomás determined that the maps will stand as a record of the disaster. An unsettling encounter sends his life, and his family's, off course for good.",
    "cover_url": "https://books.google.com/books/content?id=y6WHEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Bedside Table"
    },
    "genres": [
      "Fiction / Literary"
    ],
    "status": "To Read",
    "notes": null,
    "favorite": false
  },
  {
    "id": "7PNyEQAAQBAJ",
    "title": "Vigil",
    "authors": [
      "George Saunders"
    ],
    "isbn": "9780525509622",
    "publisher": "Random House",
    "published_date": "2026-01-27",
    "description": "Jill “Doll” Blaine is a psychopomp, ferrying souls into the afterlife — this is her 343rd charge. But the dying oil executive at her side refuses to be consoled, because unlike everyone before him, he insists he has nothing to regret.",
    "cover_url": "https://books.google.com/books/content?id=7PNyEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Headboard Shelf"
    },
    "genres": [
      "Fiction / Literary",
      "Fiction / Ghost",
      "Fiction / Nature & the Environment"
    ],
    "status": "Completed",
    "notes": null,
    "favorite": true
  },
  {
    "id": "5wcAEQAAQBAJ",
    "title": "Wild Dark Shore",
    "authors": [
      "Charlotte McConaghy"
    ],
    "isbn": "9781250827999",
    "publisher": "Flatiron Books",
    "published_date": "2025-03-04",
    "description": "Shipwrecked and washed ashore on Shearwater Island, a remote outpost near Antarctica that houses a research station and a global seed vault, Rowan finds herself entangled with the family charged with keeping it running — and the secrets they are each keeping from one another.",
    "cover_url": "https://books.google.com/books/content?id=5wcAEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Tall Shelf"
    },
    "genres": [
      "Fiction / Nature & the Environment",
      "Fiction / Places / Polar Regions",
      "Fiction / Women"
    ],
    "status": "Reading",
    "notes": null,
    "favorite": false
  },
  {
    "id": "506EEQAAQBAJ",
    "title": "Dungeon Crawler Carl",
    "authors": [
      "Matt Dinniman"
    ],
    "isbn": "9780593820254",
    "publisher": "Penguin Group",
    "published_date": "2025-12-30",
    "description": "When an alien intelligence demolishes every building on Earth except basements, Carl and his ex-girlfriend's cat, Princess Donut, are dropped into a monster-filled dungeon and forced to compete in a galaxy-wide reality show just to survive.",
    "cover_url": "https://books.google.com/books/content?id=506EEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Window Nook"
    },
    "genres": [
      "Fiction / Science Fiction / Action & Adventure",
      "Fiction / Fantasy / Action & Adventure",
      "Fiction / LitRPG (Literary Role-Playing Game)"
    ],
    "status": "To Read",
    "notes": null,
    "favorite": false
  },
  {
    "id": "E-OLEAAAQBAJ",
    "title": "Fourth Wing",
    "authors": [
      "Rebecca Yarros"
    ],
    "isbn": "9781649374080",
    "publisher": "Entangled Publishing, LLC",
    "published_date": "2023-05-02",
    "description": "Violet Sorrengail was supposed to live a quiet life among books, until her mother forces her into the brutal war college for dragon riders, where the odds of surviving the first year are stacked firmly against her.",
    "cover_url": "https://books.google.com/books/content?id=E-OLEAAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Reading Corner"
    },
    "genres": [
      "Fiction / Fantasy / Romance",
      "Fiction / Fantasy / Epic",
      "Fiction / Fantasy / Dragons & Mythical Creatures"
    ],
    "status": "Completed",
    "notes": null,
    "favorite": true
  },
  {
    "id": "xIS9EAAAQBAJ",
    "title": "Iron Flame",
    "authors": [
      "Rebecca Yarros"
    ],
    "isbn": "9781649375858",
    "publisher": "Entangled Publishing, LLC",
    "published_date": "2023-11-07",
    "description": "Violet Sorrengail survived her first year at Basgiath War College, but the real fight is only beginning — with new enemies inside the walls and a rebellion brewing that could change everything she thought she knew.",
    "cover_url": "https://books.google.com/books/content?id=xIS9EAAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Bedside Table"
    },
    "genres": [
      "Fiction / Fantasy / Epic",
      "Fiction / Fantasy / Romance"
    ],
    "status": "Reading",
    "notes": null,
    "favorite": false
  },
  {
    "id": "PDJBEQAAQBAJ",
    "title": "Lessons in Chemistry",
    "authors": [
      "Bonnie Garmus"
    ],
    "isbn": "9780593314487",
    "publisher": "Random House",
    "published_date": "2025-04-01",
    "description": "Elizabeth Zott is a brilliant chemist in 1960s America who keeps getting pushed out of the lab for being a woman. When she's unexpectedly given her own cooking show, she turns it into a lesson in chemistry, self-respect, and quiet rebellion.",
    "cover_url": "https://books.google.com/books/content?id=PDJBEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Headboard Shelf"
    },
    "genres": [
      "Fiction / Feminist",
      "Fiction / Humorous / General",
      "Fiction / Literary"
    ],
    "status": "To Read",
    "notes": null,
    "favorite": false
  },
  {
    "id": "wcHMEAAAQBAJ",
    "title": "Funny Story",
    "authors": [
      "Emily Henry"
    ],
    "isbn": "9780593441282",
    "publisher": "Penguin",
    "published_date": "2024-04-23",
    "description": "Daphne's fiancé leaves her for his childhood best friend, and she ends up sharing an apartment with that best friend's own jilted ex, Miles. What starts as two heartbroken roommates keeping each other company slowly turns into something neither of them expected.",
    "cover_url": "https://books.google.com/books/content?id=wcHMEAAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Tall Shelf"
    },
    "genres": [
      "Fiction / Romance / Romantic Comedy",
      "Fiction / Women",
      "Fiction / Romance / Contemporary"
    ],
    "status": "Completed",
    "notes": null,
    "favorite": true
  },
  {
    "id": "M68tEQAAQBAJ",
    "title": "Atmosphere",
    "authors": [
      "Taylor Jenkins Reid"
    ],
    "isbn": "9780385695824",
    "publisher": "Random House",
    "published_date": "2025-06-03",
    "description": "Joan Goodwin joins NASA's astronaut training program in the early 1980s, where she falls for a fellow astronaut candidate that no one — including Joan herself — expected. A mission gone wrong forces her to choose what she's willing to risk to get home.",
    "cover_url": "https://books.google.com/books/content?id=M68tEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Window Nook"
    },
    "genres": [
      "Fiction / Women",
      "Fiction / Literary",
      "Fiction / Sagas"
    ],
    "status": "Reading",
    "notes": null,
    "favorite": false
  },
  {
    "id": "CnSJEQAAQBAJ",
    "title": "Project Hail Mary (Movie Tie-In)",
    "authors": [
      "Andy Weir"
    ],
    "isbn": "9798217299461",
    "publisher": "Random House",
    "published_date": "2025-12-02",
    "description": "Ryland Grace wakes up alone on a spacecraft millions of miles from home with no memory of who he is or why he's there. As his memory returns, he realizes he's humanity's last chance to stop an extinction-level threat — and that he may not be as alone out there as he thinks.",
    "cover_url": "https://books.google.com/books/content?id=CnSJEQAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Reading Corner"
    },
    "genres": [
      "Fiction / Science Fiction / Action & Adventure",
      "Fiction / Science Fiction / Hard Science Fiction",
      "Fiction / Thrillers / Suspense"
    ],
    "status": "To Read",
    "notes": null,
    "favorite": false
  },
  {
    "id": "dyikEAAAQBAJ",
    "title": "Circe",
    "authors": [
      "Madeline Miller"
    ],
    "isbn": "9786020665931",
    "publisher": "Gramedia Pustaka Utama",
    "published_date": "2022-12-23",
    "description": "Born an outcast in the halls of her father Helios, Circe discovers she possesses the power of witchcraft and is banished to a deserted island, where she hones her craft, tangles with figures out of Greek mythology, and finally starts to choose a fate of her own.",
    "cover_url": "https://books.google.com/books/content?id=dyikEAAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Bedside Table"
    },
    "genres": [
      "Young Adult Fiction / Literary"
    ],
    "status": "Completed",
    "notes": null,
    "favorite": true
  },
  {
    "id": "szMU9omwV0wC",
    "title": "The Song of Achilles",
    "authors": [
      "Madeline Miller"
    ],
    "isbn": "9781408826133",
    "publisher": "A&C Black",
    "published_date": "2012-04-12",
    "description": "Exiled prince Patroclus forms an inseparable bond with the golden, godlike Achilles, following him to the shores of Troy where prophecy says the greatest warrior of the age is fated to die.",
    "cover_url": "https://books.google.com/books/content?id=szMU9omwV0wC&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Headboard Shelf"
    },
    "genres": [
      "Fiction / General"
    ],
    "status": "Reading",
    "notes": null,
    "favorite": false
  },
  {
    "id": "YMpQEAAAQBAJ",
    "title": "Babel: Or the Necessity of Violence: An Arcane History of the Oxford Translators’ Revolution",
    "authors": [
      "R.F. Kuang"
    ],
    "isbn": "9780008501839",
    "publisher": "HarperCollins Publishers",
    "published_date": "2022-09-01",
    "description": "Robin Swift is brought from Canton to Oxford to study at the Royal Institute of Translation, where silver-working — the magic of languages — powers the British Empire. As he grows closer to the truth of what that magic costs the rest of the world, he has to decide where his loyalties actually lie.",
    "cover_url": "https://books.google.com/books/content?id=YMpQEAAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Tall Shelf"
    },
    "genres": [
      "Fiction / Fantasy / Historical",
      "Fiction / Fantasy / Dark Fantasy",
      "Fiction / Fantasy / Gaslamp",
      "Fiction / Fantasy / Urban",
      "Fiction / Historical / General",
      "Fiction / Fantasy / General",
      "Fiction / Classics"
    ],
    "status": "To Read",
    "notes": null,
    "favorite": false
  },
  {
    "id": "TJZWEAAAQBAJ",
    "title": "Verity",
    "authors": [
      "Colleen Hoover"
    ],
    "isbn": "9789895648269",
    "publisher": "TOPSELLER",
    "published_date": "2021-09-27",
    "description": "Struggling writer Lowen Ashleigh is hired to finish the remaining books in a bestselling series after its author, Verity Crawford, is left incapacitated. While going through Verity's notes, Lowen finds a hidden, unfinished autobiography that reveals a side of Verity she never expected.",
    "cover_url": "https://books.google.com/books/content?id=TJZWEAAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Window Nook"
    },
    "genres": [
      "Fiction / Romance / Contemporary",
      "Fiction / Thrillers / Psychological"
    ],
    "status": "Completed",
    "notes": null,
    "favorite": true
  },
  {
    "id": "tLdiDwAAQBAJ",
    "title": "The Silent Patient",
    "authors": [
      "Alex Michaelides"
    ],
    "isbn": "9781250301710",
    "publisher": "Celadon Books",
    "published_date": "2019-02-05",
    "description": "Alicia Berenson shoots her husband five times and never speaks another word again. Criminal psychotherapist Theo Faber becomes obsessed with uncovering the truth behind her silence — and what really happened the night her husband died.",
    "cover_url": "https://books.google.com/books/content?id=tLdiDwAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Living Room",
      "bookshelf": "Reading Corner"
    },
    "genres": [
      "Fiction / Thrillers / Psychological",
      "Fiction / Thrillers / Suspense",
      "Fiction / Thrillers / Domestic"
    ],
    "status": "Reading",
    "notes": null,
    "favorite": false
  },
  {
    "id": "LmRlEAAAQBAJ",
    "title": "Where the Crawdads Sing (Movie Tie-In)",
    "authors": [
      "Delia Owens"
    ],
    "isbn": "9780593540350",
    "publisher": "Penguin",
    "published_date": "2022-06-28",
    "description": "Abandoned by her family and raised alone in the marshes of North Carolina, Kya Clark becomes a local legend — the “Marsh Girl.” When a young man is found dead, the town's suspicion falls immediately on her.",
    "cover_url": "https://books.google.com/books/content?id=LmRlEAAAQBAJ&printsec=frontcover&img=1&zoom=0",
    "location": {
      "room": "Bedroom",
      "bookshelf": "Bedside Table"
    },
    "genres": [
      "Fiction / Literary",
      "Fiction / Coming of Age",
      "Fiction / Women"
    ],
    "status": "To Read",
    "notes": null,
    "favorite": false
  }
];
