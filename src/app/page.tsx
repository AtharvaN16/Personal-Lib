import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Dashboard from '@/components/Dashboard';
import { Book } from '@/components/BookModal';
import { GUEST_SHELVES } from '@/lib/guestData';
import { resolveGoogleBooksCoverServer } from '@/lib/googleBooksCover';

// A fixed, pre-verified guest catalog: 18 real 2026 releases plus 6 well-known bestsellers for
// variety. Each Google Books volume ID below was individually checked (during development) to
// have a real, sharp JPEG cover on file — not Google's blank "cover unavailable" placeholder —
// so guests get a deterministic, good-looking catalog instead of one built from a live title
// search that can match the wrong book or come back cover-less depending on the day.
//
// Descriptions are hardcoded too, hand-written from each book's real publisher synopsis with all
// marketing fluff removed (bestseller badges, review-quote pull-lines, "also available as a
// deluxe edition" blurbs). Google's live description for a given edition is often dominated by
// that fluff, and Open Library's cleaner work-level descriptions depend on a service that isn't
// reliably reachable — hardcoding removes both problems for a fixed, known-good catalog.
const GUEST_BOOK_CATALOG: Array<{ title: string; author: string; id: string; description: string }> = [
  {
    title: 'Yesteryear', author: 'Caro Claire Burke', id: 'WPlrEQAAQBAJ',
    description: "Natalie Heller Mills has built an empire livestreaming her perfect pioneer lifestyle — the rustic farmhouse, the handsome husband, the six delightful children — to eight million followers. Then she wakes up one morning in 1855, filthy and terrified, with no idea whether it's an elaborate hoax or something far more sinister.",
  },
  {
    title: "My Husband's Wife", author: 'Alice Feeney', id: 'Dw5UEQAAQBAJ',
    description: 'Eden Fox returns from a run before her first gallery exhibition to find her house, her husband, and her whole life claimed by another woman who looks eerily like her. As the line between the two women blurs, buried secrets tied to the house and its previous owner start to surface.',
  },
  {
    title: 'The Night We Met', author: 'Abby Jimenez', id: '8yOGEQAAQBAJ',
    description: "For Larissa, it all traces back to one split-second decision the night she met Chris. Years later, the two are co-parenting and slowly figuring out what they actually still mean to each other.",
  },
  {
    title: 'Our Perfect Storm', author: 'Carley Fortune', id: 'z-h9EQAAQBAJ',
    description: "Best friends since childhood, Frankie and George have always orbited each other without quite landing. When Frankie's fiancé leaves her the morning after her wedding weekend, George convinces her to take the honeymoon anyway — with him.",
  },
  {
    title: 'The Calamity Club', author: 'Kathryn Stockett', id: 'T9BMEQAAQBAJ',
    description: "Oxford, Mississippi, 1933: eleven-year-old Meg has learned to rely on no one since her mother abandoned her at the orphanage. When her path crosses with two women running out of options of their own, the three hatch an audacious plan to take back what's rightfully theirs.",
  },
  {
    title: 'Half His Age', author: 'Jennette McCurdy', id: 'XsOBEQAAQBAJ',
    description: "Waldo is a teenager who wants her creative writing teacher, Mr. Korgy — married, unremarkable, twice her age — more than she can explain or justify. A novel about desire, power, and the lengths people go to for the things they've convinced themselves they need.",
  },
  {
    title: 'Anatomy of an Alibi', author: 'Ashley Elston', id: 'vllyEQAAQBAJ',
    description: "Camille Bayliss has the picture-perfect life, except her husband tracks her every move and she can't prove what she suspects he's hiding. Aubrey Price has spent a decade haunted by a night she believes he knows more about than he admits — and the two women hatch a plan that intertwines their fates for good.",
  },
  {
    title: 'In Her Own League', author: 'Liz Tomforde', id: '0dNUEQAAQBAJ',
    description: "As the first female team owner in Major League Baseball, Reese Remington has spent her life preparing to be taken seriously in a job everyone assumes she doesn't deserve. Her toughest test isn't the front office — it's the team's field manager, who questions her every call and gets under her skin in ways she didn't plan for.",
  },
  {
    title: 'Land', author: "Maggie O'Farrell", id: 'y6WHEQAAQBAJ',
    description: "Ireland, 1865: Tomás and his son Liam are mapping the country for the Ordnance Survey in the long shadow of the Great Hunger, Tomás determined that the maps will stand as a record of the disaster. An unsettling encounter sends his life, and his family's, off course for good.",
  },
  {
    title: 'Vigil', author: 'George Saunders', id: '7PNyEQAAQBAJ',
    description: "Jill “Doll” Blaine is a psychopomp, ferrying souls into the afterlife — this is her 343rd charge. But the dying oil executive at her side refuses to be consoled, because unlike everyone before him, he insists he has nothing to regret.",
  },
  {
    title: 'Wild Dark Shore', author: 'Charlotte McConaghy', id: '5wcAEQAAQBAJ',
    description: 'Shipwrecked and washed ashore on Shearwater Island, a remote outpost near Antarctica that houses a research station and a global seed vault, Rowan finds herself entangled with the family charged with keeping it running — and the secrets they are each keeping from one another.',
  },
  {
    title: 'Dungeon Crawler Carl', author: 'Matt Dinniman', id: '506EEQAAQBAJ',
    description: "When an alien intelligence demolishes every building on Earth except basements, Carl and his ex-girlfriend's cat, Princess Donut, are dropped into a monster-filled dungeon and forced to compete in a galaxy-wide reality show just to survive.",
  },
  {
    title: 'Fourth Wing', author: 'Rebecca Yarros', id: 'E-OLEAAAQBAJ',
    description: 'Violet Sorrengail was supposed to live a quiet life among books, until her mother forces her into the brutal war college for dragon riders, where the odds of surviving the first year are stacked firmly against her.',
  },
  {
    title: 'Iron Flame', author: 'Rebecca Yarros', id: 'xIS9EAAAQBAJ',
    description: 'Violet Sorrengail survived her first year at Basgiath War College, but the real fight is only beginning — with new enemies inside the walls and a rebellion brewing that could change everything she thought she knew.',
  },
  {
    title: 'Lessons in Chemistry', author: 'Bonnie Garmus', id: 'PDJBEQAAQBAJ',
    description: "Elizabeth Zott is a brilliant chemist in 1960s America who keeps getting pushed out of the lab for being a woman. When she's unexpectedly given her own cooking show, she turns it into a lesson in chemistry, self-respect, and quiet rebellion.",
  },
  {
    title: 'Funny Story', author: 'Emily Henry', id: 'wcHMEAAAQBAJ',
    description: "Daphne's fiancé leaves her for his childhood best friend, and she ends up sharing an apartment with that best friend's own jilted ex, Miles. What starts as two heartbroken roommates keeping each other company slowly turns into something neither of them expected.",
  },
  {
    title: 'Atmosphere', author: 'Taylor Jenkins Reid', id: 'M68tEQAAQBAJ',
    description: "Joan Goodwin joins NASA's astronaut training program in the early 1980s, where she falls for a fellow astronaut candidate that no one — including Joan herself — expected. A mission gone wrong forces her to choose what she's willing to risk to get home.",
  },
  {
    title: 'Project Hail Mary', author: 'Andy Weir', id: 'CnSJEQAAQBAJ',
    description: "Ryland Grace wakes up alone on a spacecraft millions of miles from home with no memory of who he is or why he's there. As his memory returns, he realizes he's humanity's last chance to stop an extinction-level threat — and that he may not be as alone out there as he thinks.",
  },
  {
    title: 'Circe', author: 'Madeline Miller', id: 'dyikEAAAQBAJ',
    description: 'Born an outcast in the halls of her father Helios, Circe discovers she possesses the power of witchcraft and is banished to a deserted island, where she hones her craft, tangles with figures out of Greek mythology, and finally starts to choose a fate of her own.',
  },
  {
    title: 'The Song of Achilles', author: 'Madeline Miller', id: 'szMU9omwV0wC',
    description: 'Exiled prince Patroclus forms an inseparable bond with the golden, godlike Achilles, following him to the shores of Troy where prophecy says the greatest warrior of the age is fated to die.',
  },
  {
    title: 'Babel', author: 'R. F. Kuang', id: 'YMpQEAAAQBAJ',
    description: 'Robin Swift is brought from Canton to Oxford to study at the Royal Institute of Translation, where silver-working — the magic of languages — powers the British Empire. As he grows closer to the truth of what that magic costs the rest of the world, he has to decide where his loyalties actually lie.',
  },
  {
    title: 'Verity', author: 'Colleen Hoover', id: 'TJZWEAAAQBAJ',
    description: "Struggling writer Lowen Ashleigh is hired to finish the remaining books in a bestselling series after its author, Verity Crawford, is left incapacitated. While going through Verity's notes, Lowen finds a hidden, unfinished autobiography that reveals a side of Verity she never expected.",
  },
  {
    title: 'The Silent Patient', author: 'Alex Michaelides', id: 'tLdiDwAAQBAJ',
    description: 'Alicia Berenson shoots her husband five times and never speaks another word again. Criminal psychotherapist Theo Faber becomes obsessed with uncovering the truth behind her silence — and what really happened the night her husband died.',
  },
  {
    title: 'Where the Crawdads Sing', author: 'Delia Owens', id: 'LmRlEAAAQBAJ',
    description: "Abandoned by her family and raised alone in the marshes of North Carolina, Kya Clark becomes a local legend — the “Marsh Girl.” When a young man is found dead, the town's suspicion falls immediately on her.",
  },
];

interface GoogleBookVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    imageLinks?: {
      thumbnail?: string;
    };
    categories?: string[];
  };
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isGuest = cookieStore.get('guest_session')?.value === 'true';

  if (!user && isGuest) {
    let parsedBooks: Book[] = [];
    try {
      // Server-only key (no HTTP referrer restriction), distinct from the
      // NEXT_PUBLIC_ key used client-side, which Google blocks on server requests.
      const serverApiKey = process.env.GOOGLE_BOOKS_API_KEY;
      const keyParam = serverApiKey ? `&key=${serverApiKey}` : '';

      // Fetch each pinned volume directly by ID — no search/matching involved, so there's no
      // risk of matching the wrong book or getting a different result depending on the day.
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const fetchVolumeById = async (id: string): Promise<GoogleBookVolume | null> => {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await sleep(400 * attempt);
          try {
            const res = await fetch(
              `https://www.googleapis.com/books/v1/volumes/${id}${keyParam ? `?${keyParam.slice(1)}` : ''}`,
              { next: { revalidate: 86400 } }
            );
            if (!res.ok) continue;
            return await res.json();
          } catch {
            // retry
          }
        }
        return null;
      };

      // Cap concurrency — firing all 24 lookups at once trips Google's backend rate limiting
      // far more than the same 24 requests spread across a few small batches.
      const results: (GoogleBookVolume | null)[] = [];
      const batchSize = 6;
      for (let i = 0; i < GUEST_BOOK_CATALOG.length; i += batchSize) {
        const batch = GUEST_BOOK_CATALOG.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(({ id }) => fetchVolumeById(id)));
        results.push(...batchResults);
      }

      // Cycle statuses so the shelf shows a mix of read/reading/unread books, and mark every
      // third book a favorite. Every ID above was pre-verified to have a real cover, but keep a
      // minimal title/author fallback in case Google's API hiccups on a given request — the UI
      // already falls back to a generated placeholder cover whenever cover_url is null.
      const statusCycle: Array<'Completed' | 'Reading' | 'To Read'> = ['Completed', 'Reading', 'To Read'];
      parsedBooks = await Promise.all(
        results.map(async (item, index) => {
          const release = GUEST_BOOK_CATALOG[index];
          const info = item?.volumeInfo || {};
          const industryIdentifiers = info.industryIdentifiers || [];
          const isbnObj = industryIdentifiers.find((id) => id.type === 'ISBN_13') || industryIdentifiers.find((id) => id.type === 'ISBN_10');

          const shelf = GUEST_SHELVES[index % GUEST_SHELVES.length];
          const isbn = isbnObj ? isbnObj.identifier : null;

          return {
            id: item?.id || `guest-fallback-${index}`,
            title: info.title || release.title,
            authors: info.authors?.length ? info.authors : [release.author],
            isbn,
            publisher: info.publisher || null,
            published_date: info.publishedDate || null,
            description: release.description,
            cover_url: await resolveGoogleBooksCoverServer(info.imageLinks?.thumbnail),
            location: { room: shelf.room, bookshelf: shelf.bookshelf },
            genres: info.categories || [],
            status: statusCycle[index % statusCycle.length],
            notes: null,
            favorite: index % 3 === 0,
          };
        })
      );
    } catch (err) {
      console.error('Failed to fetch guest books from Google Books API:', err);
    }

    return <Dashboard isGuest={true} initialGuestBooks={parsedBooks} />;
  }

  if (!user) {
    redirect('/login');
  }

  return <Dashboard userEmail={user.email ?? null} />;
}
