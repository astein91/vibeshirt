import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/UserMenu";

export default async function MyProjectsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/");
  }

  const supabase = createServiceClient();

  const { data: projects } = await supabase
    .from("design_sessions")
    .select("*, artifacts(*), messages(count)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  // Post-process: filter artifacts and count
  const enrichedProjects = (projects ?? []).map((project) => {
    const allArtifacts = project.artifacts as Array<{ type: string; created_at: string; storage_url: string }>;
    const relevantArtifacts = allArtifacts
      .filter((a) => a.type === "GENERATED" || a.type === "NORMALIZED")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return {
      ...project,
      thumbnail: relevantArtifacts[0] ?? null,
      _count: {
        artifacts: allArtifacts.length,
        messages: (project.messages as Array<{ count: number }>)?.[0]?.count ?? 0,
      },
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Vibeshirting" width={28} height={28} className="rounded" />
            <Image src="/wordmark.png" alt="Vibeshirting" width={120} height={28} className="object-contain" />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="outline" size="sm">
              + New Design
            </Button>
          </Link>
          <UserMenu />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">My Projects</h1>

        {enrichedProjects.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-muted-foreground">No projects yet.</p>
            <Link href="/">
              <Button>Start Your First Design</Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrichedProjects.map((project) => (
              <Link key={project.id} href={`/design/${project.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <div className="aspect-square bg-muted relative overflow-hidden rounded-t-lg">
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail.storage_url}
                        alt={project.vibe_description || "Design"}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        No artwork yet
                      </div>
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium truncate">
                        {project.vibe_description || "Untitled"}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {project._count.artifacts} images &middot;{" "}
                      {project._count.messages} messages &middot;{" "}
                      {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
