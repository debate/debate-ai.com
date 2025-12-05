import { AuthForm } from "@/components/auth/auth-form";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            FLOW Research Manager
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Modern citation card management for academic research and debate.
            Create, organize, and cite your sources with ease.
          </p>
        </div>

        <div className="flex justify-center">
          <AuthForm />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Smart Citations</h3>
            <p className="text-sm text-muted-foreground">
              Automatically format citations in MLA style with author, title, and date management.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Highlight & Organize</h3>
            <p className="text-sm text-muted-foreground">
              Mark important passages with highlighting and underlining. Filter to show only what matters.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Collections</h3>
            <p className="text-sm text-muted-foreground">
              Group related cards into collections for different research topics or debates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
