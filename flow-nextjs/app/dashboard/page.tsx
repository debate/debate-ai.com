"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { CardDisplay } from "@/components/cards/card-display";
import { CardData } from "@/lib/types/card";
import { Plus, LogOut, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [cards, setCards] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      fetchCards();
    }
  }, [session]);

  const fetchCards = async () => {
    try {
      const response = await fetch("/api/cards");
      if (response.ok) {
        const data = await response.json();
        setCards(data);
        if (data.length > 0 && !selectedCard) {
          transformAndSetCard(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const transformAndSetCard = (dbCard: any) => {
    const cardData: CardData = {
      id: dbCard.id,
      tag: dbCard.tag,
      title: dbCard.title,
      url: dbCard.url,
      siteName: dbCard.siteName,
      date: dbCard.date,
      accessDate: dbCard.accessDate,
      paras: dbCard.paras,
      isPrivate: dbCard.isPrivate,
      authors: dbCard.cardAuthors?.map((ca: any) => ({
        id: ca.author.id,
        name: ca.author.name,
        isPerson: ca.author.isPerson,
        description: ca.author.description,
      })) || [],
    };
    setSelectedCard(cardData);
  };

  const handleCreateCard = async () => {
    const newCard: CardData = {
      tag: "New research card",
      title: "Untitled Source",
      authors: [{ id: "", name: "Author Name", isPerson: true, description: null }],
      date: { month: "", day: "", year: new Date().getFullYear().toString() },
      url: "https://example.com",
      paras: [
        [{ text: "Start typing your research notes here...", underline: false, highlight: false }],
      ],
      siteName: "Website",
      accessDate: {
        month: new Date().toLocaleString('default', { month: 'long' }),
        day: new Date().getDate().toString(),
        year: new Date().getFullYear().toString(),
      },
      isPrivate: false,
    };

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCard),
      });

      if (response.ok) {
        const createdCard = await response.json();
        await fetchCards();
        transformAndSetCard(createdCard);
      }
    } catch (error) {
      console.error("Error creating card:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (isPending || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">FLOW Research Manager</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {session.user.name || session.user.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateCard}>
              <Plus className="h-4 w-4 mr-2" />
              New Card
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[300px_1fr] gap-6">
          {/* Sidebar - Card List */}
          <div className="space-y-2">
            <h2 className="text-lg font-semibold mb-4">Your Cards ({cards.length})</h2>
            <div className="space-y-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => transformAndSetCard(card)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedCard?.id === card.id
                      ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                      : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="font-medium truncate">{card.tag}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {card.title}
                  </div>
                </button>
              ))}
              {cards.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No cards yet. Create your first card!
                </div>
              )}
            </div>
          </div>

          {/* Main Area - Card Display */}
          <div>
            {selectedCard ? (
              <CardDisplay
                card={selectedCard}
                onUpdate={(updatedCard) => {
                  setSelectedCard(updatedCard);
                  // TODO: Save to backend
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                Select a card or create a new one to get started
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
