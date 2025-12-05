import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, authors, cardAuthors } from "@/lib/db/schema";
import { auth } from "@/lib/auth/auth";
import { eq } from "drizzle-orm";

// GET /api/cards - Get all cards for the current user
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userCards = await db.query.cards.findMany({
      where: eq(cards.userId, session.user.id),
      with: {
        cardAuthors: {
          with: {
            author: true,
          },
        },
      },
      orderBy: (cards, { desc }) => [desc(cards.createdAt)],
    });

    return NextResponse.json(userCards);
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}

// POST /api/cards - Create a new card
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      tag,
      title,
      url,
      siteName,
      date,
      accessDate,
      paras,
      isPrivate,
      authors: cardAuthorsData,
    } = body;

    // Create the card
    const [newCard] = await db
      .insert(cards)
      .values({
        userId: session.user.id,
        tag,
        title,
        url,
        siteName,
        date,
        accessDate,
        paras,
        isPrivate: isPrivate || false,
      })
      .returning();

    // Create authors and link them to the card
    if (cardAuthorsData && cardAuthorsData.length > 0) {
      for (let i = 0; i < cardAuthorsData.length; i++) {
        const authorData = cardAuthorsData[i];

        // Check if author exists
        const existingAuthor = await db.query.authors.findFirst({
          where: eq(authors.name, authorData.name),
        });

        let authorId;
        if (existingAuthor) {
          authorId = existingAuthor.id;
        } else {
          // Create new author
          const [newAuthor] = await db
            .insert(authors)
            .values({
              name: authorData.name,
              isPerson: authorData.isPerson ?? true,
              description: authorData.description,
            })
            .returning();
          authorId = newAuthor.id;
        }

        // Link author to card
        await db.insert(cardAuthors).values({
          cardId: newCard.id,
          authorId,
          order: i,
        });
      }
    }

    // Fetch the complete card with authors
    const completeCard = await db.query.cards.findFirst({
      where: eq(cards.id, newCard.id),
      with: {
        cardAuthors: {
          with: {
            author: true,
          },
        },
      },
    });

    return NextResponse.json(completeCard, { status: 201 });
  } catch (error) {
    console.error("Error creating card:", error);
    return NextResponse.json(
      { error: "Failed to create card" },
      { status: 500 }
    );
  }
}
